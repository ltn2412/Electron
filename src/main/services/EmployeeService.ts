import { getConnection } from "@/main/config/database";
import type { Connection } from "odbc";

export interface EmployeeInfo {
  EMPNUM: number;
  EMPNAME: string;
  SWIPE: string;
  POSNAME: string;
  ISACTIVE: number;
  DateEntered: string;
  STARTWORK: string;
  ENDWORK: string;
  ISCLOCKEDIN: number;
  LASTSTAT: number;
  JOBTYPE: number;
  PAYRATE: number;
}

export class EmployeeService {
  static async getEmployeeBySwipe(
    swipe: string,
    statNum: number = 1,
  ): Promise<EmployeeInfo> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      await connection.beginTransaction();

      const empResult = (await connection.query(
        `
        SELECT e.EMPNUM, e.EMPNAME, e.SWIPE, e.POSNAME, e.ISACTIVE, 
               e.DateEntered, e.STARTWORK, e.ENDWORK, e.ISCLOCKEDIN, e.LASTSTAT,
               jp.JOBPOS as JOBTYPE, ISNULL(pr.PAYRATE, 0) as PAYRATE
        FROM DBA.employee e
        LEFT JOIN DBA.PayRoll pr ON e.EMPNUM = pr.EMPNUM
        LEFT JOIN DBA.Jobpos jp ON pr.JOBPOS = jp.JOBPOS
        WHERE e.ISACTIVE = 1 AND e.SWIPE = ?
        `,
        [swipe],
      )) as EmployeeInfo[];
      if (empResult.length === 0)
        throw new Error("Employee not found or inactive.");

      const employee = empResult[0];

      const openDayResult = (await connection.query(
        `
        SELECT OpenDate 
        FROM dba.CurrentOpenDay 
        WHERE CurDayStatus = 1 AND OpenDate > '1900-01-01'
        `,
      )) as {
        OpenDate: string;
      }[];
      if (openDayResult.length === 0) {
        throw new Error("Current Day is not opened.");
      }

      const isClockedIn = parseInt(String(employee.ISCLOCKEDIN)) || 0;
      const lastStat = parseInt(String(employee.LASTSTAT)) || 0;

      if (isClockedIn === 0 && lastStat === 0) {
        await this.handleClockIn(connection, employee, statNum, swipe);
      } else if (isClockedIn === 4 && lastStat === statNum) {
        await connection.query(
          `
          UPDATE DBA.EMPLOYEE 
          SET ENDWORK = GETDATE(), LASTSTAT = ? 
          WHERE SWIPE = ? AND IsActive = 1
          `,
          [statNum, swipe],
        );
      } else if (isClockedIn === 4 && lastStat !== 0 && lastStat !== statNum) {
        throw new Error(
          `Employee is currently logged in at station ${lastStat}`,
        );
      }

      await connection.commit();
      return employee;
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  static async logoutEmployee(swipe: string): Promise<boolean> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      await connection.beginTransaction();

      const empResult = (await connection.query(
        `
        SELECT e.EMPNUM, e.EMPNAME, e.SWIPE, e.POSNAME, e.ISACTIVE, 
               e.DateEntered, e.STARTWORK, e.ENDWORK, e.ISCLOCKEDIN, e.LASTSTAT,
               jp.JOBPOS as JOBTYPE, ISNULL(pr.PAYRATE, 0) as PAYRATE
        FROM DBA.employee e
        LEFT JOIN DBA.PayRoll pr ON e.EMPNUM = pr.EMPNUM
        LEFT JOIN DBA.Jobpos jp ON pr.JOBPOS = jp.JOBPOS
        WHERE e.ISACTIVE = 1 AND e.SWIPE = ?
        `,
        [swipe],
      )) as EmployeeInfo[];
      if (empResult.length === 0)
        throw new Error("Employee not found or inactive.");

      const employee = empResult[0];
      if (parseInt(String(employee.LASTSTAT)) !== 0) {
        await connection.query(
          `
          UPDATE DBA.EMPLOYEE
          SET ISCLOCKEDIN = 0, LASTSTAT = 0, ENDWORK = GETDATE()
          WHERE SWIPE = ? AND IsActive = 1
          `,
          [swipe],
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  private static async handleClockIn(
    connection: Connection,
    employee: EmployeeInfo,
    statNum: number,
    swipe: string,
  ): Promise<void> {
    const unqRes = (await connection.query(
      "SELECT ISNULL(MAX(NEXTNUM), 2000) + 1 as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_PunchClockUNQ'",
    )) as {
      NEXTNUM: number;
    }[];
    const punchClockUnique = unqRes[0].NEXTNUM;

    const idxRes = (await connection.query(
      "SELECT ISNULL(MAX(NEXTNUM), 2000) + 1 as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_PUNCHCLOCK'",
    )) as {
      NEXTNUM: number;
    }[];
    const punchIndex = idxRes[0].NEXTNUM;

    const maxTxRes = (await connection.query(
      "SELECT ISNULL(MAX(TRANSACT), 0) as MAX_TRANSACT FROM DBA.POSHEADER",
    )) as {
      MAX_TRANSACT: number;
    }[];
    const maxTransact = maxTxRes[0].MAX_TRANSACT;

    const maxUnqRes = (await connection.query(
      "SELECT ISNULL(MAX(UNIQUEID), 0) as MAX_UNIQUEID FROM DBA.POSDETAIL",
    )) as {
      MAX_UNIQUEID: number;
    }[];
    const maxUniqueId = maxUnqRes[0].MAX_UNIQUEID;

    const revRes = (await connection.query(
      "SELECT MAX(RevCenter) as RevCenter FROM dba.StationInfo WHERE StatNum = ? AND IsActive = 1",
      [statNum],
    )) as {
      RevCenter: number;
    }[];
    const revCenter = revRes.length > 0 ? revRes[0].RevCenter : 999;

    await connection.query(
      `
      INSERT INTO DBA.PUNCHCLOCK(
        UniqueID, Punchindex, EmpNum, TypePunch, PunchIn, OriginalPUNCHIN, Opendate,
        PAYRATE, JOBTYPE, StoreNum, POSDetailStart, TRANSTART, UpdateStatus, ShiftIndex, 
        MealTime, RevCenter, IsPaid, ShiftRuleId
      )
      VALUES (
        ?, ?, ?, 4, GETDATE(), GETDATE(), (SELECT OpenDate FROM dba.CurrentOpenDay WHERE CurDayStatus = 1),
        ?, ?, 0, ?, ?, 1, 0, 
        3, ?, 1, 0
      )
      `,
      [
        punchClockUnique,
        punchIndex,
        employee.EMPNUM,
        employee.PAYRATE,
        employee.JOBTYPE,
        maxUniqueId,
        maxTransact,
        revCenter,
      ],
    );

    await connection.query(
      "UPDATE DBA.AUTOINCINDEX SET NEXTNUM = (SELECT ISNULL(MAX(UniqueID), 2000) FROM DBA.PUNCHCLOCK) WHERE INCNAME = 'GETNEXT_PunchClockUNQ'",
    );
    await connection.query(
      "UPDATE DBA.AUTOINCINDEX SET NEXTNUM = (SELECT ISNULL(MAX(Punchindex), 2000) FROM DBA.PUNCHCLOCK) WHERE INCNAME = 'GETNEXT_PUNCHCLOCK'",
    );
    await connection.query(
      `
      UPDATE DBA.EMPLOYEE 
      SET ISCLOCKEDIN = 4, PunchIndex = ?, STARTWORK = GETDATE(), ENDWORK = GETDATE(), LASTSTAT = ? 
      WHERE SWIPE = ? AND IsActive = 1
      `,
      [punchIndex, statNum, swipe],
    );
  }
}
