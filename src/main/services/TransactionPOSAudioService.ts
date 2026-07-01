import { getConnection } from "@/main/config/database";
import { TransactionPOSAudioPayload } from "@/shared/types";
export class TransactionPOSAudioService {
  static async createUpdateTransaction(
    data: TransactionPOSAudioPayload,
  ): Promise<void> {
    let connection;
    try {
      connection = await getConnection();
      await connection.beginTransaction();

      const queryCheck = `SELECT * FROM DBA.TRANSACTIONPOSAUDIO WHERE TRANSACT = ${data.Transact}`;
      const existing = await connection.query(queryCheck);
      if ((existing as unknown[]).length > 0) {
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET STATUS = ${data.Status} WHERE TRANSACT = ${data.Transact}`,
        );
      } else {
        await connection.query(
          `INSERT INTO DBA.TRANSACTIONPOSAUDIO(TRANSACT,STATUS,PHONENUMBER,DATEOUT,DATERETURN) VALUES (${data.Transact},${data.Status},'${data.PhoneNumber}',GETDATE(),GETDATE())`,
        );
      }
      if (data.Status === 2) {
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET DATERETURN = GETDATE() WHERE TRANSACT = ${data.Transact}`,
        );
      }

      let lastSqlBatch = "";

      if (
        data.TransactionDetailPOSAudios &&
        data.TransactionDetailPOSAudios.length > 0
      ) {
        for (const detail of data.TransactionDetailPOSAudios) {
          const detailQuery = `SELECT * FROM DBA.TRANSACTIONDETAILPOSAUDIO WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`;
          const existingDetail = await connection.query(detailQuery);
          let sqlBatch = "";
          const prodLinkQuery = `SELECT PRODNUMLINK, QUANTITY, ISPRIMARY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`;
          const prodLinkResult = await connection.query(prodLinkQuery, [detail.PRODNUM]);
          let linkNum = detail.PRODNUM;
          let linkQty = 1;
          let isPrimary = 1;
          if (prodLinkResult && (prodLinkResult as unknown[]).length > 0) {
            const row = (prodLinkResult as any[])[0];
            linkNum = row.PRODNUMLINK || detail.PRODNUM;
            linkQty = row.QUANTITY || 1;
            isPrimary = row.ISPRIMARY;
          }

          const outQty = (detail.QuantityOut || 0) * linkQty;
          const retQty = (detail.QuantityReturn || 0) * linkQty;

          if ((existingDetail as unknown[]).length > 0) {
            // OUT
            if (data.Status === 1 && detail.QuantityOut > 0) {
              await connection.query(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ? WHERE TRANSACT = ? AND PRODNUM = ?`,
                [detail.QuantityOut, data.Transact, detail.PRODNUM]
              );
              if (isPrimary === 1) {
                await connection.query(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-? WHERE PRODNUM=?`,
                  [outQty, linkNum]
                );
                await connection.query(
                  `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-?, OUT=OUT+? WHERE PRODNUM=?`,
                  [outQty, outQty, linkNum]
                );
              }
            }
            // RETURN
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              await connection.query(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ? WHERE TRANSACT = ? AND PRODNUM = ?`,
                [detail.QuantityReturn, data.Transact, detail.PRODNUM]
              );
              if (isPrimary === 1) {
                await connection.query(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+? WHERE PRODNUM=?`,
                  [retQty, linkNum]
                );
                await connection.query(
                  `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+?, OUT=OUT-? WHERE PRODNUM=?`,
                  [retQty, retQty, linkNum]
                );
              }
            }
          } else {
            // OUT
            if (data.Status === 1 && detail.QuantityOut > 0) {
              await connection.query(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (?,?,?)`,
                [data.Transact, detail.PRODNUM, detail.QuantityOut]
              );
              if (isPrimary === 1) {
                await connection.query(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-? WHERE PRODNUM=?`,
                  [outQty, linkNum]
                );
                await connection.query(
                  `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-?, OUT=OUT+? WHERE PRODNUM=?`,
                  [outQty, outQty, linkNum]
                );
              }
            }
            // RETURN
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              await connection.query(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (?,?,?)`,
                [data.Transact, detail.PRODNUM, detail.QuantityReturn]
              );
              if (isPrimary === 1) {
                await connection.query(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+? WHERE PRODNUM=?`,
                  [retQty, linkNum]
                );
                await connection.query(
                  `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+?, OUT=OUT-? WHERE PRODNUM=?`,
                  [retQty, retQty, linkNum]
                );
              }
            }
          }
        }
      }

      await connection.commit();
    } catch (error: any) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (e) {}
      }
      console.error("Lỗi khi Create/Update Transaction POS Audio:", error);
      try {
        const fs = require("fs");
        const os = require("os");
        const errStr = error
          ? error.message || error.toString()
          : "Unknown error";
        const logContent = `\n[${new Date().toISOString()}] ERROR: ${errStr}\nSQL BATCH: ${lastSqlBatch}\n`;
        const logPath = os.homedir() + "\\pos_audio_error_log.txt";
        fs.appendFileSync(logPath, logContent);
      } catch (e) {
        // ignore fs errors
      }
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
