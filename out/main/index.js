"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const odbc = require("odbc");
const axios = require("axios");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const os = require("os");
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
  static async getEmployeeBySwipe(swipe) {
    let connection;
    try {
      connection = await getConnection();
      const query = `SELECT EMPNUM, EMPNAME FROM DBA.EMPLOYEE WHERE SWIPE = ? AND ISACTIVE = 1`;
      const result = await connection.query(query, [swipe]);
      if (result.length > 0) return result[0];
      return null;
    } catch (error) {
      console.error("Lỗi khi lấy thông tin Employee:", error);
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
               ELSE CASE WHEN (TPA.STATUS = 1) THEN 'Out' ELSE 'Return' END 
          END AS POSAudioStatusName, 
          E.EMPNAME AS EMPNAME,
          PH.* 
        FROM DBA.POSHEADER PH 
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
          SELECT P.DESCRIPT AS DESCRIPT, PD.* 
          FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PRODUCT P ON PD.PRODNUM = P.PRODNUM 
          WHERE PD.TRANSACT = ? AND PD.PRODTYPE not in (100,101) 
          UNION ALL 
          SELECT P.DESCRIPT AS DESCRIPT, PD.* 
          FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PROMO P ON PD.PRODNUM = P.PROMONUM 
          WHERE PD.TRANSACT = ? AND PD.PRODTYPE not in (100)
        `;
        const detailResult = await connection.query(queryDetail, [
          posHeader.TRANSACT,
          posHeader.TRANSACT
        ]);
        posHeader.POSDETAILS = detailResult;
        return JSON.parse(JSON.stringify(posHeader));
      }
      return null;
    } catch (error) {
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
               ELSE CASE WHEN (TPA.STATUS = 1) THEN 'Out' ELSE 'Return' END 
          END AS POSAudioStatusName, 
          PH.* 
        FROM DBA.POSHEADER PH 
        LEFT JOIN DBA.TransactionPOSAudio TPA ON PH.TRANSACT = TPA.TRANSACT
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
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
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
          ISNULL(CAST(ISNULL(POAP.STORAGE, 0) - ISNULL(T.QUANTITY, 0) AS INTEGER), 0) AS STORAGE, 
          POAP.QUANTITY AS QUANTITY 
        FROM DBA.ProductPOSAudio POAP
        LEFT JOIN (
          SELECT 
            POA.PRODNUMLINK AS PRODNUMLINK, 
            SUM(PD.QUAN * POA.QUANTITY) AS QUANTITY 
          FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PRODUCTPOSAUDIO POA ON PD.PRODNUM = POA.PRODNUM
          WHERE PD.OPENDATE = (SELECT OPENDATE FROM DBA.CURRENTOPENDAY) 
            AND PD.TIMEORD >= POA.DATEMODIFIED
          GROUP BY POA.PRODNUMLINK
        ) T ON POAP.PRODNUM = T.PRODNUMLINK
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
class TransactionPOSAudioService {
  static async createUpdateTransaction(data) {
    let connection;
    try {
      connection = await getConnection();
      const queryCheck = `SELECT * FROM DBA.TRANSACTIONPOSAUDIO WHERE TRANSACT = ${data.Transact}`;
      const existing = await connection.query(queryCheck);
      if (existing.length > 0) {
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET STATUS = ${data.Status} WHERE TRANSACT = ${data.Transact}`
        );
      } else {
        await connection.query(
          `INSERT INTO DBA.TRANSACTIONPOSAUDIO(TRANSACT,STATUS,PHONENUMBER,DATEOUT,DATERETURN) VALUES (${data.Transact},${data.Status},'${data.PhoneNumber}',GETDATE(),GETDATE())`
        );
      }
      if (data.Status === 2) {
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET DATERETURN = GETDATE() WHERE TRANSACT = ${data.Transact}`
        );
      }
      if (data.TransactionDetailPOSAudios && data.TransactionDetailPOSAudios.length > 0) {
        for (const detail of data.TransactionDetailPOSAudios) {
          const detailQuery = `SELECT * FROM DBA.TRANSACTIONDETAILPOSAUDIO WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`;
          const existingDetail = await connection.query(detailQuery);
          let sqlBatch = "";
          if (existingDetail.length > 0) {
            if (data.Status === 1 && detail.QuantityOut > 0) {
              sqlBatch += `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ${detail.QuantityOut} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM};`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM};`;
              sqlBatch += `INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${detail.PRODNUM}\\x0D\\x0A');`;
              sqlBatch += `UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';`;
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${detail.QuantityOut},OUT=OUT+${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM};`;
            }
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              sqlBatch += `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ${detail.QuantityReturn} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM};`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM};`;
              sqlBatch += `INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${detail.PRODNUM}\\x0D\\x0A');`;
              sqlBatch += `UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';`;
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${detail.QuantityReturn},OUT=OUT-${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM};`;
            }
          } else {
            if (data.Status === 1 && detail.QuantityOut > 0) {
              sqlBatch += `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityOut});`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM};`;
              sqlBatch += `INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${detail.PRODNUM}\\x0D\\x0A');`;
              sqlBatch += `UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';`;
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${detail.QuantityOut},OUT=OUT+${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM};`;
            }
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              sqlBatch += `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityReturn});`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM};`;
              sqlBatch += `INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${detail.PRODNUM}\\x0D\\x0A');`;
              sqlBatch += `UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';`;
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${detail.QuantityReturn},OUT=OUT-${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM};`;
            }
          }
          if (sqlBatch !== "") {
            await connection.query(sqlBatch);
          }
        }
      }
    } catch (error) {
      console.error("Lỗi khi Create/Update Transaction POS Audio:", error);
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
      if (info.error) msg += `
Error: ${JSON.stringify(info.error)}`;
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
    new winston.transports.Console()
  ]
});
class HoangVanService {
  baseURL = "https://demobtctct.soatvetudong.vn/api/speedpos";
  token = null;
  username = "speedpos";
  password = "SpeedHoangVan";
  async login() {
    try {
      const res = await axios.post(`${this.baseURL}/login`, {
        Username: this.username,
        Password: this.password,
        username: this.username,
        password: this.password
      });
      if (res.data.success && res.data.data?.token) {
        this.token = res.data.data.token;
      } else {
        throw new Error(res.data.message || "Login failed");
      }
    } catch (error) {
      console.error("HoangVanAPI Login Error:", error);
      throw error;
    }
  }
  async getSlots(date, isRetry = false) {
    if (!this.token) {
      await this.login();
    }
    try {
      const res = await axios.get(`${this.baseURL}/slots?date=${date}`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      if (res.data.success && res.data.data?.slots) {
        return res.data.data.slots;
      } else {
        throw new Error(res.data.message || "Failed to fetch slots");
      }
    } catch (error) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.getSlots(date, true);
      }
      console.error("HoangVanAPI getSlots Error:", error);
      throw error;
    }
  }
  async checkOrder(orderNo, isRetry = false) {
    if (!this.token) {
      await this.login();
    }
    try {
      const res = await axios.get(`${this.baseURL}/orders/${orderNo}/status`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      if (res.data.success && res.data.data) {
        return res.data.data;
      } else {
        throw new Error(res.data.message || "Failed to check order");
      }
    } catch (error) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.checkOrder(orderNo, true);
      }
      if (status === 404) {
        throw new Error("Không tìm thấy đơn hàng");
      }
      console.error("HoangVanAPI checkOrder Error:", error);
      throw error;
    }
  }
  async useOrder(orderNo, staffId, note, isRetry = false) {
    if (!this.token) {
      await this.login();
    }
    try {
      const payload = { staffId, note: note || "Sử dụng máy Audio Guide" };
      const res = await axios.post(
        `${this.baseURL}/orders/${orderNo}/use`,
        payload,
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      logger.info("HoangVan API Request", {
        body: payload,
        response: res.data
      });
      if (res.data.success && res.data.data) {
        return res.data.data;
      } else {
        throw new Error(res.data.message || "Failed to use order");
      }
    } catch (error) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.useOrder(orderNo, staffId, note, true);
      }
      if (status === 400 && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      console.error("HoangVanAPI useOrder Error:", error);
      throw error;
    }
  }
  async getExpiredOrders(page = 1, pageSize = 50, isRetry = false) {
    if (!this.token) {
      await this.login();
    }
    try {
      const res = await axios.get(
        `${this.baseURL}/orders/expired?page=${page}&pageSize=${pageSize}`,
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      if (res.data.success && res.data.data) {
        return res.data;
      } else {
        throw new Error(res.data.message || "Failed to fetch expired orders");
      }
    } catch (error) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.getExpiredOrders(page, pageSize, true);
      }
      console.error("HoangVanAPI getExpiredOrders Error:", error);
      throw error;
    }
  }
  async confirmExpiredOrders(orderNos, isRetry = false) {
    if (!this.token) {
      await this.login();
    }
    try {
      const payload = { orderNos };
      const res = await axios.post(
        `${this.baseURL}/orders/expired/confirm`,
        payload,
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      logger.info("HoangVan API Request", {
        body: payload,
        response: res.data
      });
      if (res.data.success) {
        return res.data;
      } else {
        throw new Error(res.data.message || "Failed to confirm expired orders");
      }
    } catch (error) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.confirmExpiredOrders(orderNos, true);
      }
      console.error("HoangVanAPI confirmExpiredOrders Error:", error);
      throw error;
    }
  }
}
const HoangVanService$1 = new HoangVanService();
class OrderService {
  async createOrder(refCode, quantity, costEach, swipe, status = 1) {
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
          1, NULL, ?, 3, ?, NULL,
          ?, 0, ?, 0, 0, 0,
          1, 1, '1899-12-30 00:00:00.000', 0, 0,
          0, 0, 0, 0, 3,
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
        FINALTOTAL,
        PUNCHINDEX,
        OPENDATE,
        REVCENTER,
        PUNCHINDEX,
        STATNUM,
        refCode
      ];
      logger.info("Executed Database Query", { query: posHeaderSql, params: posHeaderParams });
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
          ?, ?, ?, ?, ?, ?, ?, GETDATE(), ?, 0, 0, 0, 32, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 0, ?, 3, ?, ?, ?, 0, ?, ?, NULL, 1, 0, GETDATE()
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
        STATNUM,
        OPENDATE,
        LineDes,
        REVCENTER,
        UNIQUEID,
        costEach,
        useVat ? netTotalAmount / quantity : costEach
      ];
      logger.info("Executed Database Query", { query: posDetailSql, params: posDetailParams });
      await connection.query(posDetailSql, posDetailParams);
      if (status === 1) {
        const sql = `
          INSERT INTO DBA.TransactionPOSAudio (Transact, PhoneNumber, Status, DateOut, DateReturn)
          VALUES (?, '', ?, GETDATE(), NULL)
        `;
        logger.info("Executed Database Query", { query: sql, params: [TRANSACT, status] });
        await connection.query(sql, [TRANSACT, status]);
      } else {
        const sql = `
          INSERT INTO DBA.TransactionPOSAudio (Transact, PhoneNumber, Status, DateOut, DateReturn)
          VALUES (?, '', ?, NULL, GETDATE())
        `;
        logger.info("Executed Database Query", { query: sql, params: [TRANSACT, status] });
        await connection.query(sql, [TRANSACT, status]);
      }
      const tdSql = `
        INSERT INTO DBA.TransactionDetailPOSAudio (Transact, PRODNUM, QuantityOut, QuantityReturn)
        VALUES (?, ?, ?, ?)
      `;
      const tdParams = [TRANSACT, PRODNUM, status === 1 ? quantity : 0, status === 2 ? quantity : 0];
      logger.info("Executed Database Query", { query: tdSql, params: tdParams });
      await connection.query(tdSql, tdParams);
      const methodRes = await connection.query(
        `SELECT METHODNUM FROM DBA.MethodPay WHERE ISACTIVE = 1`
      );
      if (methodRes.length === 0) throw new Error("No payment method found");
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
      logger.info("Executed Database Query", { query: hpSql, params: hpParams });
      await connection.query(hpSql, hpParams);
      await connection.commit();
      return {
        success: true,
        transact: TRANSACT,
        message: "Order inserted successfully"
      };
    } catch (error) {
      await connection.rollback();
      const detailedError = error.odbcErrors?.[0]?.message || error.message || "Unknown error";
      console.error("Error creating order:", detailedError);
      throw new Error(`[odbc] ${detailedError}`);
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
      swipe
    }) => {
      try {
        const result = await OrderService$1.createOrder(
          refCode,
          quantity,
          costEach,
          swipe
        );
        return result;
      } catch (error) {
        const err = error;
        return { success: false, error: err.message };
      }
    }
  );
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
