import { getConnection } from "@/main/config/database";

export class EmployeeService {
  static async getEmployeeBySwipe(
    swipe: string,
    statNum: number = 1,
  ): Promise<unknown> {
    let connection;
    try {
      connection = await getConnection();
      await connection.beginTransaction();

      const empQuery = `
        SELECT e.EMPNUM, e.EMPNAME, e.SWIPE, e.POSNAME, e.ISACTIVE, 
               e.DateEntered, e.STARTWORK, e.ENDWORK, e.ISCLOCKEDIN, e.LASTSTAT,
               jp.JOBPOS as JOBTYPE, ISNULL(pr.PAYRATE, 0) as PAYRATE
        FROM DBA.employee e
        LEFT JOIN DBA.PayRoll pr ON e.EMPNUM = pr.EMPNUM
        LEFT JOIN DBA.Jobpos jp ON pr.JOBPOS = jp.JOBPOS
        WHERE e.ISACTIVE = 1 AND e.SWIPE = ?
      `;
      const empResult = await connection.query(empQuery, [swipe]);

      if (empResult.length === 0) {
        throw new Error("Employee not found or inactive.");
      }

      const employee: Record<string, string | number> = empResult[0] as Record<
        string,
        string | number
      >;

      const openDayQuery = `
        SELECT OpenDate 
        FROM dba.CurrentOpenDay 
        WHERE CurDayStatus = 1 AND OpenDate > '1900-01-01'
      `;
      const openDayResult = await connection.query(openDayQuery);

      if (openDayResult.length === 0) {
        throw new Error("Current Day is not opened.");
      }

      const isClockedIn = parseInt(employee.ISCLOCKEDIN) || 0;
      const lastStat = parseInt(employee.LASTSTAT) || 0;

      if (isClockedIn === 0 && lastStat === 0) {
        const getNextPunchClockUnq = await connection.query(
          `SELECT ISNULL(MAX(NEXTNUM), 2000) + 1 as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_PunchClockUNQ'`,
        );
        const punchClockUnique = getNextPunchClockUnq[0].NEXTNUM;

        const getNextPunchIndex = await connection.query(
          `SELECT ISNULL(MAX(NEXTNUM), 2000) + 1 as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_PUNCHCLOCK'`,
        );
        const punchIndex = getNextPunchIndex[0].NEXTNUM;

        // Get max transact and uniqueid for POSDetailStart and TRANSTART
        const getMaxTransact = await connection.query(
          `SELECT ISNULL(MAX(TRANSACT), 0) as MAX_TRANSACT FROM DBA.POSHEADER`,
        );
        const maxTransact = getMaxTransact[0].MAX_TRANSACT;

        const getMaxUniqueId = await connection.query(
          `SELECT ISNULL(MAX(UNIQUEID), 0) as MAX_UNIQUEID FROM DBA.POSDETAIL`,
        );
        const maxUniqueId = getMaxUniqueId[0].MAX_UNIQUEID;

        const revQuery = `SELECT MAX(RevCenter) as RevCenter FROM dba.StationInfo WHERE StatNum = ? AND IsActive = 1`;
        const revResult = await connection.query(revQuery, [statNum]);
        const revCenter = revResult.length > 0 ? revResult[0].RevCenter : 999;

        const insertPunchClock = `
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
        `;
        await connection.query(insertPunchClock, [
          punchClockUnique,
          punchIndex,
          employee.EMPNUM,
          employee.PAYRATE,
          employee.JOBTYPE,
          maxUniqueId,
          maxTransact,
          revCenter,
        ]);

        await connection.query(
          `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = (SELECT ISNULL(MAX(UniqueID), 2000) FROM DBA.PUNCHCLOCK) WHERE INCNAME = 'GETNEXT_PunchClockUNQ'`,
        );
        await connection.query(
          `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = (SELECT ISNULL(MAX(Punchindex), 2000) FROM DBA.PUNCHCLOCK) WHERE INCNAME = 'GETNEXT_PUNCHCLOCK'`,
        );

        const updateEmployee = `
          UPDATE DBA.EMPLOYEE 
          SET ISCLOCKEDIN = 4, PunchIndex = ?, STARTWORK = GETDATE(), ENDWORK = GETDATE(), LASTSTAT = ? 
          WHERE SWIPE = ? AND IsActive = 1
        `;
        await connection.query(updateEmployee, [punchIndex, statNum, swipe]);
      } else if (isClockedIn === 4 && lastStat === statNum) {
        // Case error logged out but not properly closed
        const updateEmployee = `
          UPDATE DBA.EMPLOYEE 
          SET ENDWORK = GETDATE(), LASTSTAT = ? 
          WHERE SWIPE = ? AND IsActive = 1
        `;
        await connection.query(updateEmployee, [statNum, swipe]);
      } else if (isClockedIn === 4 && lastStat !== 0 && lastStat !== statNum) {
        throw new Error(
          `Employee is currently logged in at station ${lastStat}`,
        );
      }

      await connection.commit();
      return employee;
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error("Error logging in Employee:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  static async logoutEmployee(swipe: string): Promise<boolean> {
    let connection;
    try {
      connection = await getConnection();
      await connection.beginTransaction();

      const empQuery = `
        SELECT EMPNUM, ISCLOCKEDIN, LASTSTAT, PunchIndex
        FROM DBA.employee 
        WHERE ISACTIVE = 1 AND SWIPE = ?
      `;
      const empResult = await connection.query(empQuery, [swipe]);

      if (empResult.length === 0) {
        throw new Error("Employee not found or inactive.");
      }

      const employee: Record<string, string | number> = empResult[0] as Record<
        string,
        string | number
      >;

      if (parseInt(employee.LASTSTAT) !== 0) {
        const updateEmployee = `
          UPDATE DBA.EMPLOYEE
          SET ISCLOCKEDIN = 0,
              LASTSTAT = 0,
              ENDWORK = GETDATE()
          WHERE SWIPE = ? AND IsActive = 1
        `;
        await connection.query(updateEmployee, [swipe]);
      }

      await connection.commit();
      return true;
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error("Error logging out Employee:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
