"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const odbc = require("odbc");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const os = require("os");
const axios = require("axios");
const fs = require("fs");
const icon = path.join(__dirname, "../../resources/icon.png");
const CONNECTION_STRING = "DSN=PixelSqlbase;UID=DBA;ENP=28f3cd0c3ddcfc32;";
async function getConnection() {
  try {
    const connection = await odbc.connect(CONNECTION_STRING);
    return connection;
  } catch (error) {
    const err = error;
    throw new Error(
      `Cannot connect to database: ${err.message || "Check DSN/Server configuration"}`
    );
  }
}
class EmployeeService {
  static async getEmployeeBySwipe(swipe, statNum = 1) {
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
      const employee = empResult[0];
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
          `SELECT ISNULL(MAX(NEXTNUM), 2000) + 1 as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_PunchClockUNQ'`
        );
        const punchClockUnique = getNextPunchClockUnq[0].NEXTNUM;
        const getNextPunchIndex = await connection.query(
          `SELECT ISNULL(MAX(NEXTNUM), 2000) + 1 as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_PUNCHCLOCK'`
        );
        const punchIndex = getNextPunchIndex[0].NEXTNUM;
        const getMaxTransact = await connection.query(
          `SELECT ISNULL(MAX(TRANSACT), 0) as MAX_TRANSACT FROM DBA.POSHEADER`
        );
        const maxTransact = getMaxTransact[0].MAX_TRANSACT;
        const getMaxUniqueId = await connection.query(
          `SELECT ISNULL(MAX(UNIQUEID), 0) as MAX_UNIQUEID FROM DBA.POSDETAIL`
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
          revCenter
        ]);
        await connection.query(
          `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = (SELECT ISNULL(MAX(UniqueID), 2000) FROM DBA.PUNCHCLOCK) WHERE INCNAME = 'GETNEXT_PunchClockUNQ'`
        );
        await connection.query(
          `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = (SELECT ISNULL(MAX(Punchindex), 2000) FROM DBA.PUNCHCLOCK) WHERE INCNAME = 'GETNEXT_PUNCHCLOCK'`
        );
        const updateEmployee = `
          UPDATE DBA.EMPLOYEE 
          SET ISCLOCKEDIN = 4, PunchIndex = ?, STARTWORK = GETDATE(), ENDWORK = GETDATE(), LASTSTAT = ? 
          WHERE SWIPE = ? AND IsActive = 1
        `;
        await connection.query(updateEmployee, [punchIndex, statNum, swipe]);
      } else if (isClockedIn === 4 && lastStat === statNum) {
        const updateEmployee = `
          UPDATE DBA.EMPLOYEE 
          SET ENDWORK = GETDATE(), LASTSTAT = ? 
          WHERE SWIPE = ? AND IsActive = 1
        `;
        await connection.query(updateEmployee, [statNum, swipe]);
      } else if (isClockedIn === 4 && lastStat !== 0 && lastStat !== statNum) {
        throw new Error(
          `Employee is currently logged in at station ${lastStat}`
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
  static async logoutEmployee(swipe) {
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
      const employee = empResult[0];
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
class TransactionService {
  static async getTransactionByTransact(transact) {
    let connection;
    try {
      connection = await getConnection();
      let searchTransact = transact;
      if (searchTransact.startsWith("696")) {
        searchTransact = searchTransact.substring(3);
      }
      const queryHeader = `
        SELECT TOP 1 
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 0 ELSE TPA.STATUS END AS POSAudioStatus,
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 'New' 
               ELSE CASE WHEN (TPA.STATUS = 1) THEN 'Out' 
                         WHEN (TPA.STATUS = 3) THEN 'Expired' 
                         ELSE 'Return' END 
          END AS POSAudioStatusName, 
          E.EMPNAME AS EMPNAME,
          PH.* FROM DBA.POSHEADER PH 
        LEFT JOIN DBA.TransactionPOSAudio TPA ON PH.TRANSACT = TPA.TRANSACT 
        INNER JOIN DBA.EMPLOYEE E ON PH.WHOCLOSE = E.EMPNUM 
        WHERE (PH.TRANSACT = ? OR TPA.PHONENUMBER = ?) 
          AND PH.STATUS = 3 
        ORDER BY PH.TIMEEND DESC
      `;
      const headerResult = await connection.query(queryHeader, [
        searchTransact,
        searchTransact
      ]);
      if (headerResult.length > 0) {
        const posHeader = headerResult[0];
        const queryDetail = `
          SELECT P.DESCRIPT AS DESCRIPT, POAP.REFCODE AS REFCODE, PD.* FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PRODUCT P ON PD.PRODNUM = P.PRODNUM 
          LEFT JOIN DBA.ProductPOSAudio POAP ON PD.PRODNUM = POAP.PRODNUM
          WHERE PD.TRANSACT = ? AND PD.PRODTYPE not in (100,101) 
          UNION ALL 
          SELECT P.DESCRIPT AS DESCRIPT, POAP.REFCODE AS REFCODE, PD.* FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PROMO P ON PD.PRODNUM = P.PROMONUM 
          LEFT JOIN DBA.ProductPOSAudio POAP ON PD.PRODNUM = POAP.PRODNUM
          WHERE PD.TRANSACT = ? AND PD.PRODTYPE not in (100)
        `;
        const detailResult = await connection.query(queryDetail, [
          posHeader.TRANSACT,
          posHeader.TRANSACT
        ]);
        posHeader.POSDETAILS = detailResult;
        await connection.commit();
        return JSON.parse(JSON.stringify(posHeader));
      }
      await connection.commit();
      return null;
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (e) {
        }
      }
      console.error("Lỗi khi lấy thông tin Transaction By Transact:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
  static async getTransaction() {
    let connection;
    try {
      connection = await getConnection();
      const query = `
        SELECT 
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 0 ELSE TPA.STATUS END AS POSAudioStatus,
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 'New' 
               ELSE CASE WHEN (TPA.STATUS = 1) THEN 'Out' 
                         WHEN (TPA.STATUS = 3) THEN 'Expired'
                         ELSE 'Return' END 
          END AS POSAudioStatusName, 
          ISNULL(AudioSum.Total, 0) AS FILTERED_TOTAL,
          PH.* 
        FROM DBA.POSHEADER PH 
        LEFT JOIN DBA.TransactionPOSAudio TPA ON PH.TRANSACT = TPA.TRANSACT
        LEFT JOIN (
            SELECT PD2.TRANSACT, SUM(PD2.QUAN * PD2.COSTEACH) AS Total
            FROM DBA.POSDETAIL PD2
            INNER JOIN DBA.PRODUCT P2 ON PD2.PRODNUM = P2.PRODNUM
            WHERE P2.REFCODE like '%_F:POS_AUDIO%'
            GROUP BY PD2.TRANSACT
        ) AudioSum ON PH.TRANSACT = AudioSum.TRANSACT
        WHERE PH.TRANSACT IN (
          SELECT PD.TRANSACT 
          FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PRODUCT P ON PD.PRODNUM = P.PRODNUM 
            AND PD.OPENDATE = (select OPENDATE from dba.CurrentOpenDay) 
          WHERE PD.PRODTYPE NOT IN (100,101) 
            AND P.REFCODE like '%_F:POS_AUDIO%' 
          GROUP BY PD.TRANSACT
        ) 
        AND PH.STATUS = 3 
        AND PH.FINALTOTAL > 0 
        ORDER BY PH.TIMEEND DESC
      `;
      const result = await connection.query(query);
      await connection.commit();
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (e) {
        }
      }
      console.error("Lỗi khi lấy thông tin Transaction list:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
class ProductService {
  static async getProductPOSAudio() {
    let connection;
    try {
      connection = await getConnection();
      const query = `
        SELECT 
          POAP.PRODNUM, 
          POAP.DESCRIPT, 
          POAP.REFCODE, 
          ISNULL(POAP.STORAGE, 0) AS STORAGE, 
          POAP.QUANTITY AS QUANTITY 
        FROM DBA.ProductPOSAudio POAP
        WHERE POAP.ISPRIMARY = 1
      `;
      const result = await connection.query(query);
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
      console.error("Lỗi khi lấy danh sách Product POS Audio:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
  static async outProduct(products) {
    let connection;
    try {
      connection = await getConnection();
      const querySecondary = `
        SELECT PRODNUM, DESCRIPT, REFCODE, ISPRIMARY, QUANTITY, ISNULL(STORAGE,0) AS STORAGE, PRODNUMLINK 
        FROM DBA.ProductPOSAudio 
        WHERE ISPRIMARY = 0 AND PRODNUMLINK IS NOT NULL AND QUANTITY <> 0
      `;
      const linkedProducts = await connection.query(querySecondary);
      for (const prod of products) {
        if (prod.COUNT && prod.COUNT !== 0) {
          prod.STORAGE = (prod.STORAGE || 0) - prod.COUNT;
          prod.OUT = (prod.OUT || 0) - prod.COUNT;
          const sqlBatch = `
            UPDATE DBA.PRODUCT SET COUNTDOWN=${prod.STORAGE} WHERE PRODNUM=${prod.PRODNUM};
            INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${prod.PRODNUM}\\x0D\\x0A');
            UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
            
            INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,2,'UPDATEPROD\\x0D\\x0A${prod.PRODNUM}\\x0D\\x0A');
            UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
            
            UPDATE DBA.ProductPOSAudio SET STORAGE=${prod.STORAGE}, OUT=${prod.OUT} WHERE PRODNUM=${prod.PRODNUM};
          `;
          await connection.query(sqlBatch);
          const links = linkedProducts.filter(
            (p) => p.PRODNUMLINK === prod.PRODNUM
          );
          for (const link of links) {
            const count = Math.floor(prod.STORAGE / link.QUANTITY);
            const countDown = count > 0 ? count : -1;
            const sqlLink = `
              UPDATE DBA.PRODUCT SET COUNTDOWN=${countDown} WHERE PRODNUM=${link.PRODNUMLINK};
              INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${link.PRODNUMLINK}\\x0D\\x0A');
              UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
              
              INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,2,'UPDATEPROD\\x0D\\x0A${link.PRODNUMLINK}\\x0D\\x0A');
              UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
            `;
            await connection.query(sqlLink);
          }
        }
      }
      return true;
    } catch (error) {
      console.error("Lỗi khi Out Product:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
  static async resetProduct(products) {
    let connection;
    try {
      connection = await getConnection();
      const querySecondary = `
        SELECT PRODNUM, DESCRIPT, REFCODE, ISPRIMARY, QUANTITY, ISNULL(STORAGE,0) AS STORAGE, PRODNUMLINK 
        FROM DBA.ProductPOSAudio 
        WHERE ISPRIMARY = 0 AND PRODNUMLINK IS NOT NULL AND QUANTITY <> 0
      `;
      const linkedProducts = await connection.query(querySecondary);
      for (const prod of products) {
        const sqlBatch = `
          UPDATE DBA.PRODUCT SET COUNTDOWN=${prod.COUNT} WHERE PRODNUM=${prod.PRODNUM};
          INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${prod.PRODNUM}\\x0D\\x0A');
          UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
          
          INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,2,'UPDATEPROD\\x0D\\x0A${prod.PRODNUM}\\x0D\\x0A');
          UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
          
          UPDATE DBA.PRODUCTPOSAUDIO SET STORAGE=${prod.COUNT}, OUT=0, DATEMODIFIED=GETDATE() WHERE PRODNUM=${prod.PRODNUM};
          UPDATE DBA.PRODUCTPOSAUDIO SET DATEMODIFIED=GETDATE() WHERE PRODNUMLINK=${prod.PRODNUM};
        `;
        await connection.query(sqlBatch);
        const links = linkedProducts.filter(
          (p) => p.PRODNUMLINK === prod.PRODNUM
        );
        for (const link of links) {
          const count = Math.floor(prod.COUNT / link.QUANTITY);
          const countDown = count > 0 ? count : -1;
          const sqlLink = `
            UPDATE DBA.PRODUCT SET COUNTDOWN=${countDown} WHERE PRODNUM=${link.PRODNUM};
            INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${link.PRODNUM}\\x0D\\x0A');
            UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
            
            INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,2,'UPDATEPROD\\x0D\\x0A${link.PRODNUM}\\x0D\\x0A');
            UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
          `;
          await connection.query(sqlLink);
        }
      }
      return true;
    } catch (error) {
      console.error("Lỗi khi Reset Product:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
const isWindows = os.platform() === "win32";
const logDir = isWindows ? "C:\\BTCTCT" : path.join(os.homedir(), "BTCTCT");
const errorDir = isWindows ? "C:\\BTCTCT\\errors" : path.join(os.homedir(), "BTCTCT", "errors");
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    winston.format.printf((info) => {
      let msg = `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`;
      if (info.query) msg += `
Query: ${info.query}`;
      if (info.params) msg += `
Params: ${JSON.stringify(info.params)}`;
      if (info.body) msg += `
Body: ${JSON.stringify(info.body)}`;
      if (info.response) msg += `
Response: ${JSON.stringify(info.response)}`;
      if (info.error) {
        if (typeof info.error === "object") {
          msg += `
Error Message: ${info.error.message || info.error}`;
          if (info.error.stack) msg += `
Stack Trace: ${info.error.stack}`;
          if (info.error.odbcErrors) msg += `
ODBC Details: ${JSON.stringify(info.error.odbcErrors)}`;
        } else {
          msg += `
Error: ${info.error}`;
        }
      }
      return msg;
    })
  ),
  transports: [
    new DailyRotateFile({
      dirname: logDir,
      filename: "app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "7d"
    }),
    new DailyRotateFile({
      level: "error",
      dirname: errorDir,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d"
    }),
    new winston.transports.Console()
  ]
});
class TransactionPOSAudioService {
  static async createUpdateTransaction(data) {
    let connection;
    let lastQuery = "Khởi tạo kết nối";
    try {
      connection = await getConnection();
      try {
        await connection.query(
          `SET TEMPORARY OPTION blocking_timeout = '3000'`
        );
      } catch (e) {
      }
      await connection.beginTransaction();
      lastQuery = "SELECT TRANSACTIONPOSAUDIO";
      const existing = await connection.query(
        `SELECT * FROM DBA.TRANSACTIONPOSAUDIO WHERE TRANSACT = ?`,
        [data.Transact]
      );
      if (existing.length > 0) {
        lastQuery = "UPDATE TRANSACTIONPOSAUDIO";
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET STATUS = ? WHERE TRANSACT = ?`,
          [data.Status, data.Transact]
        );
      } else {
        lastQuery = "INSERT TRANSACTIONPOSAUDIO";
        await connection.query(
          `INSERT INTO DBA.TRANSACTIONPOSAUDIO(TRANSACT,STATUS,PHONENUMBER,DATEOUT,DATERETURN) VALUES (?, ?, ?, GETDATE(), GETDATE())`,
          [data.Transact, data.Status, data.PhoneNumber]
        );
      }
      if (data.Status === 2) {
        lastQuery = "UPDATE DATERETURN";
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET DATERETURN = GETDATE() WHERE TRANSACT = ?`,
          [data.Transact]
        );
      }
      const productCountdownChanges = /* @__PURE__ */ new Map();
      const posAudioStorageChanges = /* @__PURE__ */ new Map();
      const detailOutQueries = [];
      const detailRetQueries = [];
      if (data.TransactionDetailPOSAudios && data.TransactionDetailPOSAudios.length > 0) {
        for (const detail of data.TransactionDetailPOSAudios) {
          lastQuery = `SELECT TRANSACTIONDETAILPOSAUDIO (PRODNUM=${detail.PRODNUM})`;
          const existingDetail = await connection.query(
            `SELECT * FROM DBA.TRANSACTIONDETAILPOSAUDIO WHERE TRANSACT = ? AND PRODNUM = ?`,
            [data.Transact, detail.PRODNUM]
          );
          lastQuery = `SELECT ProductPOSAudio (PRODNUM=${detail.PRODNUM})`;
          const prodLinkResult = await connection.query(
            `SELECT PRODNUMLINK, QUANTITY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`,
            [detail.PRODNUM]
          );
          let linkNum = detail.PRODNUM;
          let linkQty = 1;
          if (prodLinkResult && prodLinkResult.length > 0) {
            const row = prodLinkResult[0];
            linkNum = row.PRODNUMLINK || detail.PRODNUM;
            linkQty = row.QUANTITY || 1;
          }
          const totalOutQty = (detail.QuantityOut || 0) * linkQty;
          const totalRetQty = (detail.QuantityReturn || 0) * linkQty;
          const isUpdate = existingDetail.length > 0;
          if (data.Status === 1 && detail.QuantityOut > 0) {
            if (isUpdate) {
              detailOutQueries.push({
                sql: `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ? WHERE TRANSACT = ? AND PRODNUM = ?`,
                params: [detail.QuantityOut, data.Transact, detail.PRODNUM]
              });
            } else {
              detailOutQueries.push({
                sql: `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (?,?,?)`,
                params: [data.Transact, detail.PRODNUM, detail.QuantityOut]
              });
            }
            if (linkNum !== detail.PRODNUM) {
              productCountdownChanges.set(
                linkNum,
                (productCountdownChanges.get(linkNum) || 0) - totalOutQty
              );
            }
            posAudioStorageChanges.set(
              linkNum,
              (posAudioStorageChanges.get(linkNum) || 0) - totalOutQty
            );
          }
          if (data.Status === 2 && detail.QuantityReturn > 0) {
            if (isUpdate) {
              detailRetQueries.push({
                sql: `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ? WHERE TRANSACT = ? AND PRODNUM = ?`,
                params: [detail.QuantityReturn, data.Transact, detail.PRODNUM]
              });
            } else {
              detailRetQueries.push({
                sql: `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (?,?,?)`,
                params: [data.Transact, detail.PRODNUM, detail.QuantityReturn]
              });
            }
            productCountdownChanges.set(
              detail.PRODNUM,
              (productCountdownChanges.get(detail.PRODNUM) || 0) + detail.QuantityReturn
            );
            if (linkNum !== detail.PRODNUM) {
              productCountdownChanges.set(
                linkNum,
                (productCountdownChanges.get(linkNum) || 0) + totalRetQty
              );
            }
            posAudioStorageChanges.set(
              linkNum,
              (posAudioStorageChanges.get(linkNum) || 0) + totalRetQty
            );
          }
        }
        let productSql = "";
        if (productCountdownChanges.size > 0) {
          let caseStr = "";
          let ids = [];
          for (const [pNum, qty] of productCountdownChanges.entries()) {
            if (qty !== 0) {
              caseStr += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              ids.push(pNum);
            }
          }
          if (ids.length > 0) {
            productSql = `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + CASE ${caseStr} ELSE 0 END WHERE PRODNUM IN (${ids.join(",")})`;
            lastQuery = productSql;
            await connection.query(productSql);
          }
        }
        let posAudioSql = "";
        if (posAudioStorageChanges.size > 0) {
          let caseStrStorage = "";
          let caseStrOut = "";
          let ids = [];
          for (const [pNum, qty] of posAudioStorageChanges.entries()) {
            if (qty !== 0) {
              caseStrStorage += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              caseStrOut += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              ids.push(pNum);
            }
          }
          if (ids.length > 0) {
            posAudioSql = `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE + CASE ${caseStrStorage} ELSE 0 END, OUT = OUT - CASE ${caseStrOut} ELSE 0 END WHERE PRODNUM IN (${ids.join(",")})`;
            lastQuery = posAudioSql;
            await connection.query(posAudioSql);
          }
        }
        const allDetails = [...detailOutQueries, ...detailRetQueries];
        for (const q of allDetails) {
          lastQuery = q.sql + " | Biến: " + JSON.stringify(q.params);
          await connection.query(q.sql, q.params);
        }
      }
      lastQuery = "Đang Commit Database";
      await connection.commit();
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (e) {
        }
      }
      logger.error("Lỗi khi Create/Update Transaction POS Audio:", { error });
      let errMsg = error.message || error.toString();
      if (error.odbcErrors && error.odbcErrors.length > 0) {
        errMsg += " | ODBC Details: " + error.odbcErrors.map((e) => e.message).join(", ");
      }
      throw new Error("Loi DB: " + errMsg);
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
const DEFAULT_CONFIG = {
  hoangVanURL: "https://demobtctct.soatvetudong.vn/api/speedpos",
  hoangVanUser: "speedpos",
  hoangVanPass: "SpeedHoangVan"
};
class ConfigManager {
  static getConfig() {
    try {
      const configPath = electron.app.isPackaged ? path.join(path.dirname(electron.app.getPath("exe")), "config.json") : path.join(process.cwd(), "config.json");
      if (!fs.existsSync(configPath)) {
        try {
          fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf8");
        } catch (writeErr) {
          console.error("Could not auto-create config file (permission issue?)", writeErr);
        }
      }
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(data);
        if (!parsed.hoangVanURL || !parsed.hoangVanUser || !parsed.hoangVanPass) {
          return null;
        }
        return parsed;
      } else {
        return null;
      }
    } catch (e) {
      console.error("Error reading config", e);
      return null;
    }
  }
}
const AppConfig = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ConfigManager
}, Symbol.toStringTag, { value: "Module" }));
class HoangVanService {
  token = null;
  handleApiError(error, context) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      if (status === 400) {
        throw new Error(data?.message || "Invalid data (400).");
      }
      if (status === 401 || status === 403) {
        throw new Error(`Session expired or access denied (${status}).`);
      }
      if (status === 404) {
        throw new Error("Order not found on Hoang Van system (404).");
      }
      if (status === 500) {
        throw new Error(
          "Hoang Van server is experiencing issues (500). Please try again later."
        );
      }
      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        throw new Error(
          "Connection to Hoang Van timed out. Please check your network."
        );
      }
      throw new Error(
        `Hoang Van connection error: ${data?.message || error.message}`
      );
    }
    throw new Error(`Unknown error (${context}): ${error.message}`);
  }
  async login() {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    try {
      const payload = {
        Username: config.hoangVanUser,
        Password: config.hoangVanPass,
        username: config.hoangVanUser,
        password: config.hoangVanPass
      };
      logger.info(`HoangVanAPI Login Request to ${config.hoangVanURL}/login`, {
        payload
      });
      const res = await axios.post(`${config.hoangVanURL}/login`, payload);
      logger.info("HoangVanAPI Login Response", { data: res.data });
      if (res.data.success && res.data.data?.token) {
        this.token = res.data.data.token;
      } else {
        throw new Error(res.data.message || "Login failed");
      }
    } catch (error) {
      console.error("HoangVanAPI Login Error:", error);
      this.handleApiError(error, "login");
    }
  }
  async getSlots(date, isRetry = false) {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) {
      await this.login();
    }
    try {
      const url = `${config.hoangVanURL}/slots?date=${date}`;
      logger.info(`HoangVanAPI GetSlots Request to ${url}`);
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      logger.info("HoangVanAPI GetSlots Response", { data: res.data });
      if (res.data.success && res.data.data?.slots) {
        return res.data.data.slots;
      } else {
        throw new Error(res.data.message || "Failed to fetch slots");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.getSlots(date, true);
        }
      }
      console.error("HoangVanAPI getSlots Error:", error);
      this.handleApiError(error, "getSlots");
    }
  }
  async checkOrder(orderNo, isRetry = false) {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) {
      await this.login();
    }
    try {
      const url = `${config.hoangVanURL}/orders/${orderNo}/status`;
      logger.info(`HoangVanAPI CheckOrder Request to ${url}`);
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${this.token}` },
        timeout: 1e4
      });
      logger.info("HoangVanAPI CheckOrder Response", { data: res.data });
      if (res.data.success && res.data.data) {
        return res.data.data;
      } else {
        throw new Error(res.data.message || "Failed to check order");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.checkOrder(orderNo, true);
        }
      }
      console.error("HoangVanAPI checkOrder Error:", error);
      this.handleApiError(error, "checkOrder");
    }
  }
  async useOrder(orderNo, staffId, isRetry = false) {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) {
      await this.login();
    }
    try {
      const url = `${config.hoangVanURL}/orders/${orderNo}/use`;
      const payload = {
        orderNo,
        staffId,
        usedTime: (/* @__PURE__ */ new Date()).toISOString()
      };
      logger.info(`HoangVanAPI UseOrder Request to ${url}`, { payload });
      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      logger.info("HoangVanAPI UseOrder Response", { data: res.data });
      if (res.data.success && res.data.data) {
        return res.data.data;
      } else {
        throw new Error(res.data.message || "Failed to use order");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.useOrder(orderNo, staffId, true);
        }
      }
      console.error("HoangVanAPI useOrder Error:", error);
      this.handleApiError(error, "useOrder");
    }
  }
  async getTransactions(orderNo, isRetry = false) {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) {
      await this.login();
    }
    try {
      const url = `${config.hoangVanURL}/orders/${orderNo}/transactions`;
      logger.info(`HoangVanAPI GetTransactions Request to ${url}`);
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      logger.info("HoangVanAPI GetTransactions Response", { data: res.data });
      if (res.data.success) {
        return res.data;
      } else {
        throw new Error(res.data.message || "Failed to fetch transactions");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.getTransactions(orderNo, true);
        }
      }
      console.error("HoangVanAPI getTransactions Error:", error);
      this.handleApiError(error, "getTransactions");
    }
  }
  async getExpiredOrders(page = 1, pageSize = 50, isRetry = false) {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) {
      await this.login();
    }
    try {
      const url = `${config.hoangVanURL}/orders/expired?page=${page}&pageSize=${pageSize}`;
      logger.info(`HoangVanAPI GetExpiredOrders Request to ${url}`);
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      logger.info("HoangVanAPI GetExpiredOrders Response", { data: res.data });
      if (res.data.success && res.data.data) {
        return res.data;
      } else {
        throw new Error(res.data.message || "Failed to fetch expired orders");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.getExpiredOrders(page, pageSize, true);
        }
      }
      console.error("HoangVanAPI getExpiredOrders Error:", error);
      this.handleApiError(error, "getExpiredOrders");
    }
  }
  async confirmExpiredOrders(orderNos, isRetry = false) {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) {
      await this.login();
    }
    try {
      const url = `${config.hoangVanURL}/orders/expired/confirm`;
      const payload = { orderNos };
      logger.info(`HoangVanAPI ConfirmExpiredOrders Request to ${url}`, {
        payload
      });
      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      logger.info("HoangVanAPI ConfirmExpiredOrders Response", {
        data: res.data
      });
      if (res.data.success) {
        return res.data;
      } else {
        throw new Error(res.data.message || "Failed to confirm expired orders");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.confirmExpiredOrders(orderNos, true);
        }
      }
      console.error("HoangVanAPI confirmExpiredOrders Error:", error);
      this.handleApiError(error, "confirmExpiredOrders");
    }
  }
}
const HoangVanService$1 = new HoangVanService();
class OrderService {
  async createOrder(refCode, quantity, costEach, swipe, status = 1, onlineOrderId) {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();
      const STATNUM = 1;
      const empResult = await connection.query(
        `SELECT EmpNum, ISNULL(PunchIndex, 0) as PunchIndex FROM dba.employee WHERE SWIPE = ? AND IsActive = 1`,
        [swipe]
      );
      if (empResult.length === 0)
        throw new Error(`Employee not found for swipe: ${swipe}`);
      const empRow = empResult[0];
      const WHOSTART = empRow.EmpNum;
      const PUNCHINDEX = empRow.PunchIndex;
      const prodResult = await connection.query(
        `
        SELECT Product.ProdNum, Product.ProdType, Product.CountDown, Product.Descript, ISNULL(Product.PrepTemp, 0) AS PrepTemp,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.PRINTLOC ELSE PRODUCT.PRINTLOC END) AS PrintLoc,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX1 ELSE PRODUCT.TAX1 END) AS Tax1,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX2 ELSE PRODUCT.TAX2 END) AS Tax2,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX3 ELSE PRODUCT.TAX3 END) AS Tax3,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX4 ELSE PRODUCT.TAX4 END) AS Tax4,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX5 ELSE PRODUCT.TAX5 END) AS Tax5
        FROM dba.Product
        LEFT JOIN dba.ReportCat ON (Product.ReportNo = ReportCat.ReportNo)
        WHERE Product.IsActive = 1 AND Product.RefCode = ?
      `,
        [refCode]
      );
      if (prodResult.length === 0)
        throw new Error(`Product not found for refCode: ${refCode}`);
      const product = prodResult[0];
      const PRODNUM = product.ProdNum;
      const LineDes = product.Descript;
      const stationResult = await connection.query(
        `
        SELECT QuickOrderTable, MAX(SaleTypeIndex) as SaleTypeIndex, MAX(RevCenter) as RevCenter
        FROM dba.StationInfo WHERE StatNum = ? AND IsActive = 1 GROUP BY QuickOrderTable
      `,
        [STATNUM]
      );
      if (stationResult.length === 0)
        throw new Error(`Station not found for StatNum: ${STATNUM}`);
      const stationRow = stationResult[0];
      const TABLENUM = stationRow.QuickOrderTable || 0;
      const SALETYPEINDEX = stationRow.SaleTypeIndex || 0;
      const REVCENTER = stationRow.RevCenter || 0;
      const openDateResult = await connection.query(
        `SELECT OpenDate FROM dba.CurrentOpenDay WHERE CurDayStatus = 1`
      );
      if (openDateResult.length === 0) throw new Error("No open day found");
      const OPENDATE = openDateResult[0].OpenDate;
      const sysInfoResult = await connection.query(`
        SELECT ISNULL(TAXRATE1, 0) AS TaxRate1, ISNULL(TAXRATE2, 0) AS TaxRate2, 
               ISNULL(TAXRATE3, 0) AS TaxRate3, ISNULL(TAXRATE4, 0) AS TaxRate4, 
               ISNULL(TAXRATE5, 0) AS TaxRate5, UseVAT
        FROM dba.SysInfo
      `);
      const sysInfo = sysInfoResult[0];
      let tax1 = 0, tax2 = 0, tax3 = 0, tax4 = 0, tax5 = 0;
      const useVat = sysInfo.UseVAT === 1;
      const calcTax = (rate, amount, hasTax) => {
        if (!hasTax || rate === 0) return 0;
        if (useVat) {
          return amount - amount / (1 + rate / 100);
        } else {
          return amount * (rate / 100);
        }
      };
      const finalTotalAmount = costEach * quantity;
      let netTotalAmount = finalTotalAmount;
      const t1 = calcTax(
        sysInfo.TaxRate1,
        finalTotalAmount,
        product.Tax1 === 1
      );
      const t2 = calcTax(
        sysInfo.TaxRate2,
        finalTotalAmount,
        product.Tax2 === 1
      );
      const t3 = calcTax(
        sysInfo.TaxRate3,
        finalTotalAmount,
        product.Tax3 === 1
      );
      const t4 = calcTax(
        sysInfo.TaxRate4,
        finalTotalAmount,
        product.Tax4 === 1
      );
      const t5 = calcTax(
        sysInfo.TaxRate5,
        finalTotalAmount,
        product.Tax5 === 1
      );
      if (useVat) netTotalAmount = finalTotalAmount - (t1 + t2 + t3 + t4 + t5);
      else netTotalAmount = finalTotalAmount;
      tax1 = t1;
      tax2 = t2;
      tax3 = t3;
      tax4 = t4;
      tax5 = t5;
      const FINALTOTAL = useVat ? finalTotalAmount : netTotalAmount + tax1 + tax2 + tax3 + tax4 + tax5;
      const NETTOTAL = netTotalAmount;
      const nextHeaderRes = await connection.query(
        `SELECT MAX(NEXTNUM) as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_POSHEADER'`
      );
      const TRANSACT = nextHeaderRes[0].NEXTNUM + 1;
      const posHeaderSql = `
        INSERT INTO DBA.POSHEADER (
          TRANSACT, TABLENUM, TIMESTART, TIMEEND, NUMCUST,
          TAX1, TAX2, TAX3, TAX4, TAX5,
          TAX1ABLE, TAX2ABLE, TAX3ABLE, TAX4ABLE, TAX5ABLE,
          NETTOTAL, WHOSTART, WHOCLOSE, ISSPLIT, SALETYPEINDEX,
          EXP, WAITINGAUTH, STATNUM, STATUS, FINALTOTAL, StoreNum,
          PUNCHINDEX, Gratuity, OPENDATE, MemCode, TotalPoints, PointsApplied,
          UpdateStatus, ISDelivery, ScheduleDate, Tax1Exempt, Tax2Exempt,
          Tax3Exempt, Tax4Exempt, Tax5Exempt, MEMRATE, MealTime,
          IsInternet, RevCenter, PunchIdxStart, StatNumStart, SecNum,
          GratAmount, ShipTo, EnforcedGrat, NumPrintedFinal, RefId,
          RstOrdNum
        ) VALUES (
          ?, ?, GETDATE(), GETDATE(), 1,
          ?, ?, ?, ?, ?,
          0, 0, 0, 0, 0,
          ?, ?, ?, 1, ?,
          1, NULL, ?, ?, ?, NULL,
          ?, 0, ?, 0, 0, 0,
          1, 1, '1899-12-30 00:00:00.000', 0, 0,
          0, 0, 0, 0, 1,
          0, ?, ?, ?, 0,
          0, 0, 0, 1, ?, NULL
        )
      `;
      const posHeaderParams = [
        TRANSACT,
        TABLENUM,
        tax1,
        tax2,
        tax3,
        tax4,
        tax5,
        NETTOTAL,
        WHOSTART,
        WHOSTART,
        SALETYPEINDEX,
        STATNUM,
        3,
        // ALWAYS 3 for POSHEADER (Closed)
        FINALTOTAL,
        PUNCHINDEX,
        OPENDATE,
        REVCENTER,
        PUNCHINDEX,
        STATNUM,
        refCode
      ];
      logger.info("Executed Database Query", {
        query: posHeaderSql,
        params: posHeaderParams
      });
      await connection.query(posHeaderSql, posHeaderParams);
      await connection.query(
        `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = ? WHERE INCNAME = 'GETNEXT_POSHEADER'`,
        [TRANSACT]
      );
      const nextDetailRes = await connection.query(
        `SELECT MAX(NEXTNUM) as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_POSDETAIL'`
      );
      const UNIQUEID = nextDetailRes[0].NEXTNUM + 1;
      await connection.query(
        `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = ? WHERE INCNAME = 'GETNEXT_POSDETAIL'`,
        [UNIQUEID]
      );
      const recPosRes = await connection.query(
        `SELECT ISNULL(MAX(RECPOS), -1) as RECPOS FROM DBA.POSDETAIL WHERE TRANSACT = ?`,
        [TRANSACT]
      );
      const RECPOS = recPosRes[0].RECPOS + 1;
      const posDetailSql = `
        INSERT INTO DBA.POSDETAIL (
          UNIQUEID, TRANSACT, PRODNUM, WHOORDER, WHOAUTH, COSTEACH, QUAN, TIMEORD, PRINTLOC, SEATNUM, Minutes, NOTAX, HOWORDERED, STATUS, NEXTPOS, PRIORPOS, RECPOS, PRODTYPE, ApplyTax1, Applytax2, Applytax3, Applytax4, Applytax5, ReduceInventory, StoreNum, STATNUM, RecipeCostEach, OpenDate, MealTime, LineDes, REVCENTER, MasterItem, QuestionId, OrigCostEach, NetCostEach, Discount, UpdateStatus, GratExempt, AuthCode
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, GETDATE(), ?, 0, 0, 0, 32, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 1, ?, ?, ?, 0, ?, ?, NULL, 1, 0, GETDATE()
        )
      `;
      const posDetailParams = [
        UNIQUEID,
        TRANSACT,
        PRODNUM,
        WHOSTART,
        WHOSTART,
        costEach,
        quantity,
        product.PrintLoc,
        RECPOS,
        product.ProdType,
        product.Tax1,
        product.Tax2,
        product.Tax3,
        product.Tax4,
        product.Tax5,
        status === 3 ? 0 : 1,
        STATNUM,
        OPENDATE,
        LineDes,
        REVCENTER,
        UNIQUEID,
        costEach,
        useVat ? netTotalAmount / quantity : costEach
      ];
      logger.info("Executed Database Query", {
        query: posDetailSql,
        params: posDetailParams
      });
      await connection.query(posDetailSql, posDetailParams);
      if (status === 1) {
        const sql = `
          INSERT INTO DBA.TransactionPOSAudio (Transact, PhoneNumber, Status, DateOut, DateReturn, OnlineOrderTransaction)
          VALUES (?, '', ?, GETDATE(), NULL, ?)
        `;
        logger.info("Executed Database Query", {
          query: sql,
          params: [TRANSACT, status, onlineOrderId || null]
        });
        await connection.query(sql, [TRANSACT, status, onlineOrderId || null]);
      } else {
        const sql = `
          INSERT INTO DBA.TransactionPOSAudio (Transact, PhoneNumber, Status, DateOut, DateReturn, OnlineOrderTransaction)
          VALUES (?, '', ?, NULL, GETDATE(), ?)
        `;
        logger.info("Executed Database Query", {
          query: sql,
          params: [TRANSACT, status, onlineOrderId || null]
        });
        await connection.query(sql, [TRANSACT, status, onlineOrderId || null]);
      }
      const tdSql = `
        INSERT INTO DBA.TransactionDetailPOSAudio (Transact, PRODNUM, QuantityOut, QuantityReturn)
        VALUES (?, ?, ?, ?)
      `;
      const tdParams = [
        TRANSACT,
        PRODNUM,
        quantity,
        status === 2 || status === 3 ? quantity : 0
      ];
      logger.info("Executed Database Query", {
        query: tdSql,
        params: tdParams
      });
      await connection.query(tdSql, tdParams);
      if (status === 1) {
        const prodLinkQuery = `SELECT PRODNUMLINK, QUANTITY, ISPRIMARY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`;
        const prodLinkResult = await connection.query(prodLinkQuery, [PRODNUM]);
        let linkNum = PRODNUM;
        let linkQty = 1;
        let isPrimary = 1;
        if (prodLinkResult && prodLinkResult.length > 0) {
          const row = prodLinkResult[0];
          linkNum = row.PRODNUMLINK;
          linkQty = row.QUANTITY || 1;
          isPrimary = row.ISPRIMARY;
        }
        const outQty = quantity * linkQty;
        if (isPrimary === 1) {
          const updateProductSql = `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN - ? WHERE PRODNUM = ?`;
          logger.info("Executed Database Query", {
            query: updateProductSql,
            params: [outQty, linkNum]
          });
          await connection.query(updateProductSql, [outQty, linkNum]);
        }
        const updateStorageSql = `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE - ?, OUT = OUT + ? WHERE PRODNUM = ?`;
        logger.info("Executed Database Query", {
          query: updateStorageSql,
          params: [outQty, outQty, linkNum]
        });
        await connection.query(updateStorageSql, [outQty, outQty, linkNum]);
      }
      const methodRes = await connection.query(
        `SELECT METHODNUM FROM DBA.MethodPay WHERE ISACTIVE = 1 AND SwipeStarts like '%HOANGVAN%'`
      );
      if (methodRes.length === 0)
        throw new Error("No payment method found for HoangVan");
      const methodNum = methodRes[0].METHODNUM;
      const nextHowPaidRes = await connection.query(
        `SELECT MAX(NEXTNUM) as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_HowPaid'`
      );
      const HowPaidLink = nextHowPaidRes[0].NEXTNUM + 1;
      await connection.query(
        `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = ? WHERE INCNAME = 'GETNEXT_HowPaid'`,
        [HowPaidLink]
      );
      const hpSql = `
        INSERT INTO DBA.Howpaid(
          HowPaidLink, TRANSDATE, EMPNUM, TENDER, METHODNUM, CHANGE,
          AUTHORIZED, AUTHCODE, MEMCODE, ExchangeRate, TRANSACT, PayType, OPENDATE,
          PUNCHINDEX, UpdateStatus, Settled, Status, Approved, STATNUM, IsPayInOut,
          PayReason, MealTime, RevCenter, Voided, VoidedLink, LCUDiff, EnforcedGrat,
          GratAmount, OrigMethodNum, CardType
        ) VALUES (
          ?, GETDATE(), ?, ?, ?, 0,
          199, '', 0, 1, ?, 101, ?,
          ?, 1, 1, 3, 1, ?, 0,
          '', 1, 999, 0, 0, 0, 0,
          0, ?, ''
        )
      `;
      const hpParams = [
        HowPaidLink,
        WHOSTART,
        FINALTOTAL,
        methodNum,
        TRANSACT,
        OPENDATE,
        PUNCHINDEX,
        STATNUM,
        methodNum
      ];
      logger.info("Executed Database Query", {
        query: hpSql,
        params: hpParams
      });
      await connection.query(hpSql, hpParams);
      if (PUNCHINDEX > 0) {
        const updateTillSql = `
          UPDATE DBA.PUNCHCLOCK 
          SET TillBalance = ISNULL(TillBalance, 0) + ? 
          WHERE Punchindex = ?
        `;
        logger.info("Executed Database Query", {
          query: updateTillSql,
          params: [FINALTOTAL, PUNCHINDEX]
        });
        await connection.query(updateTillSql, [FINALTOTAL, PUNCHINDEX]);
      }
      const updateNeedsCashoutSql = `UPDATE DBA.EMPLOYEE SET NEEDSCASHOUT = 1 WHERE EMPNUM = ?`;
      logger.info("Executed Database Query", {
        query: updateNeedsCashoutSql,
        params: [WHOSTART]
      });
      await connection.query(updateNeedsCashoutSql, [WHOSTART]);
      await connection.commit();
      return {
        success: true,
        transact: TRANSACT,
        message: "Order inserted successfully"
      };
    } catch (error) {
      console.error("OrderService createOrder error:", error);
      if (connection) {
        try {
          await connection.rollback();
        } catch (e) {
        }
      }
      const err = error;
      return { success: false, error: err.message };
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
  static async getOnlineOrderStatus(orderId) {
    try {
      const connection = await getConnection();
      const sql = `
        SELECT TOP 1 Status 
        FROM DBA.TransactionPOSAudio 
        WHERE OnlineOrderTransaction = ? 
        ORDER BY Transact DESC
      `;
      const result = await connection.query(sql, [orderId]);
      await connection.close();
      if (result && result.length > 0) {
        return { success: true, status: result[0].Status };
      }
      return { success: true, status: void 0 };
    } catch (error) {
      console.error("OrderService getOnlineOrderStatus error:", error);
      const err = error;
      return { success: false, error: err.message };
    }
  }
  static async returnOnlineOrder(orderId) {
    let connection;
    try {
      connection = await getConnection();
      const sql = `
        SELECT TOP 1 Transact 
        FROM DBA.TransactionPOSAudio 
        WHERE OnlineOrderTransaction = ? AND Status = 1
        ORDER BY Transact DESC
      `;
      const result = await connection.query(sql, [orderId]);
      if (result && result.length > 0) {
        const transactId = result[0].Transact;
        const detailsSql = `SELECT PRODNUM, QuantityOut FROM DBA.TransactionDetailPOSAudio WHERE Transact = ?`;
        const details = await connection.query(detailsSql, [transactId]);
        await connection.close();
        const { TransactionPOSAudioService: TransactionPOSAudioService2 } = require("./TransactionPOSAudioService");
        await TransactionPOSAudioService2.createUpdateTransaction({
          Transact: transactId,
          Status: 2,
          // Return
          PhoneNumber: "",
          TransactionDetailPOSAudios: details.map((d) => ({
            PRODNUM: d.PRODNUM,
            QuantityOut: d.QuantityOut,
            QuantityReturn: d.QuantityOut
            // Return all out quantity
          }))
        });
        return { success: true };
      }
      if (connection) await connection.close();
      return { success: false, error: "Transaction not found or already returned." };
    } catch (error) {
      console.error("OrderService returnOnlineOrder error:", error);
      if (connection) {
        try {
          await connection.close();
        } catch (e) {
        }
      }
      const err = error;
      return { success: false, error: err.message };
    }
  }
}
const OrderService$1 = new OrderService();
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    resizable: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  electron.ipcMain.on("window:minimize", () => {
    mainWindow.minimize();
  });
  electron.ipcMain.on("window:close", () => {
    mainWindow.close();
  });
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.handle("employee:getBySwipe", async (_, swipe) => {
    try {
      const employee = await EmployeeService.getEmployeeBySwipe(swipe);
      return { success: true, data: employee };
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("employee:logout", async (_, swipe) => {
    try {
      const result = await EmployeeService.logoutEmployee(swipe);
      return { success: true, data: result };
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("transaction:get", async () => {
    try {
      const data = await TransactionService.getTransaction();
      return { success: true, data };
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("transaction:getByTransact", async (_, transact) => {
    try {
      const data = await TransactionService.getTransactionByTransact(transact);
      return { success: true, data };
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("config:get", async () => {
    try {
      const { ConfigManager: ConfigManager2 } = await Promise.resolve().then(() => AppConfig);
      const config = ConfigManager2.getConfig();
      return { success: true, data: config };
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("product:getPOSAudio", async () => {
    try {
      const data = await ProductService.getProductPOSAudio();
      return { success: true, data };
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle(
    "reset-product",
    async (_, products) => {
      try {
        const result = await ProductService.resetProduct(products);
        return { success: true, data: result };
      } catch (error) {
        const err = error;
        return { success: false, error: err.message };
      }
    }
  );
  electron.ipcMain.handle("hoangvan:getSlots", async (_, date) => {
    try {
      const data = await HoangVanService$1.getSlots(date);
      return { success: true, data };
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("hoangvan:checkOrder", async (_, orderNo) => {
    try {
      const data = await HoangVanService$1.checkOrder(orderNo);
      return { success: true, data };
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle(
    "hoangvan:useOrder",
    async (_, { orderNo, staffId }) => {
      try {
        const data = await HoangVanService$1.useOrder(orderNo, staffId);
        return { success: true, data };
      } catch (error) {
        const err = error;
        return { success: false, error: err.message };
      }
    }
  );
  electron.ipcMain.handle(
    "hoangvan:getExpiredOrders",
    async (_, { page, pageSize }) => {
      try {
        const data = await HoangVanService$1.getExpiredOrders(page, pageSize);
        return { success: true, data };
      } catch (error) {
        const err = error;
        return { success: false, error: err.message };
      }
    }
  );
  electron.ipcMain.handle(
    "hoangvan:confirmExpiredOrders",
    async (_, { orderNos }) => {
      try {
        const data = await HoangVanService$1.confirmExpiredOrders(orderNos);
        return { success: true, data };
      } catch (error) {
        const err = error;
        return { success: false, error: err.message };
      }
    }
  );
  electron.ipcMain.handle(
    "posAudio:createUpdate",
    async (_, data) => {
      try {
        await TransactionPOSAudioService.createUpdateTransaction(data);
        return { success: true };
      } catch (error) {
        const err = error;
        return { success: false, error: err.message };
      }
    }
  );
  electron.ipcMain.handle(
    "order:create",
    async (_, {
      refCode,
      quantity,
      costEach,
      swipe,
      status,
      onlineOrderId
    }) => {
      try {
        const result = await OrderService$1.createOrder(
          refCode,
          quantity,
          costEach,
          swipe,
          status,
          onlineOrderId
        );
        return result;
      } catch (error) {
        const err = error;
        return { success: false, error: err.message };
      }
    }
  );
  electron.ipcMain.handle("order:getOnlineStatus", async (_, orderId) => {
    try {
      const result = await OrderService$1.getOnlineOrderStatus(orderId);
      return result;
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("order:returnLocal", async (_, orderId) => {
    try {
      const result = await OrderService$1.returnOnlineOrder(orderId);
      return result;
    } catch (error) {
      const err = error;
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("print:html", async (_, htmlContent) => {
    return new Promise((resolve) => {
      const printWindow = new electron.BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true
        }
      });
      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      printWindow.webContents.on("did-finish-load", () => {
        printWindow.webContents.print(
          {
            silent: true,
            printBackground: false,
            margins: { marginType: "none" }
          },
          (success, failureReason) => {
            printWindow.close();
            resolve({ success, error: failureReason });
          }
        );
      });
    });
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
