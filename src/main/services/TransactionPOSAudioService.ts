import { getConnection } from "@/main/config/database";
import { TransactionPOSAudioPayload } from "@/shared/types";

export class TransactionPOSAudioService {
  static async createUpdateTransaction(
    data: TransactionPOSAudioPayload,
  ): Promise<void> {
    let connection;
    let lastSqlBatch = "Khởi tạo kết nối"; // Tracking để biết chính xác treo ở đâu

    try {
      connection = await getConnection();
      await connection.beginTransaction();

      // [FIX]: Dùng tham số (?) thay vì nối chuỗi trực tiếp để tránh SQL Injection và lỗi ép kiểu
      lastSqlBatch = `SELECT TRANSACTIONPOSAUDIO: Transact=${data.Transact}`;
      const queryCheck = `SELECT * FROM DBA.TRANSACTIONPOSAUDIO WHERE TRANSACT = ?`;
      const existing = await connection.query(queryCheck, [data.Transact]);

      if ((existing as unknown[]).length > 0) {
        lastSqlBatch = `UPDATE TRANSACTIONPOSAUDIO: Transact=${data.Transact}`;
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET STATUS = ? WHERE TRANSACT = ?`,
          [data.Status, data.Transact],
        );
      } else {
        lastSqlBatch = `INSERT TRANSACTIONPOSAUDIO: Transact=${data.Transact}`;
        await connection.query(
          `INSERT INTO DBA.TRANSACTIONPOSAUDIO(TRANSACT, STATUS, PHONENUMBER, DATEOUT, DATERETURN) VALUES (?, ?, ?, GETDATE(), GETDATE())`,
          [data.Transact, data.Status, data.PhoneNumber || ""],
        );
      }

      if (data.Status === 2) {
        lastSqlBatch = `UPDATE DATERETURN: Transact=${data.Transact}`;
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET DATERETURN = GETDATE() WHERE TRANSACT = ?`,
          [data.Transact],
        );
      }

      if (
        data.TransactionDetailPOSAudios &&
        data.TransactionDetailPOSAudios.length > 0
      ) {
        for (const detail of data.TransactionDetailPOSAudios) {
          // [FIX]: Dùng tham số (?) bảo vệ PRODNUM (đặc biệt quan trọng nếu ID Combo là chuỗi)
          lastSqlBatch = `SELECT TRANSACTIONDETAILPOSAUDIO: Transact=${data.Transact}, PRODNUM=${detail.PRODNUM}`;
          const detailQuery = `SELECT * FROM DBA.TRANSACTIONDETAILPOSAUDIO WHERE TRANSACT = ? AND PRODNUM = ?`;
          const existingDetail = await connection.query(detailQuery, [
            data.Transact,
            detail.PRODNUM,
          ]);

          lastSqlBatch = `SELECT ProductPOSAudio: PRODNUM=${detail.PRODNUM}`;
          const prodLinkQuery = `SELECT PRODNUMLINK, QUANTITY, ISPRIMARY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`;
          const prodLinkResult = await connection.query(prodLinkQuery, [
            detail.PRODNUM,
          ]);

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
              lastSqlBatch = `UPDATE TRANSACTIONDETAILPOSAUDIO (OUT): Transact=${data.Transact}, PRODNUM=${detail.PRODNUM}`;
              await connection.query(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ? WHERE TRANSACT = ? AND PRODNUM = ?`,
                [detail.QuantityOut, data.Transact, detail.PRODNUM],
              );
              if (isPrimary === 1) {
                lastSqlBatch = `UPDATE DBA.PRODUCT (OUT): PRODNUM=${linkNum}`;
                await connection.query(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-? WHERE PRODNUM=?`,
                  [outQty, linkNum],
                );
                lastSqlBatch = `UPDATE DBA.ProductPOSAudio (OUT): PRODNUM=${linkNum}`;
                await connection.query(
                  `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-?, OUT=OUT+? WHERE PRODNUM=?`,
                  [outQty, outQty, linkNum],
                );
              }
            }
            // RETURN
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              lastSqlBatch = `UPDATE TRANSACTIONDETAILPOSAUDIO (RETURN): Transact=${data.Transact}, PRODNUM=${detail.PRODNUM}`;
              await connection.query(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ? WHERE TRANSACT = ? AND PRODNUM = ?`,
                [detail.QuantityReturn, data.Transact, detail.PRODNUM],
              );
              if (isPrimary === 1) {
                lastSqlBatch = `UPDATE DBA.PRODUCT (RETURN): PRODNUM=${linkNum}`;
                await connection.query(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+? WHERE PRODNUM=?`,
                  [retQty, linkNum],
                );
                lastSqlBatch = `UPDATE DBA.ProductPOSAudio (RETURN): PRODNUM=${linkNum}`;
                await connection.query(
                  `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+?, OUT=OUT-? WHERE PRODNUM=?`,
                  [retQty, retQty, linkNum],
                );
              }
            }
          } else {
            // OUT
            if (data.Status === 1 && detail.QuantityOut > 0) {
              lastSqlBatch = `INSERT TRANSACTIONDETAILPOSAUDIO (OUT): Transact=${data.Transact}, PRODNUM=${detail.PRODNUM}`;
              await connection.query(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (?,?,?)`,
                [data.Transact, detail.PRODNUM, detail.QuantityOut],
              );
              if (isPrimary === 1) {
                lastSqlBatch = `UPDATE DBA.PRODUCT (OUT): PRODNUM=${linkNum}`;
                await connection.query(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-? WHERE PRODNUM=?`,
                  [outQty, linkNum],
                );
                lastSqlBatch = `UPDATE DBA.ProductPOSAudio (OUT): PRODNUM=${linkNum}`;
                await connection.query(
                  `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-?, OUT=OUT+? WHERE PRODNUM=?`,
                  [outQty, outQty, linkNum],
                );
              }
            }
            // RETURN
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              lastSqlBatch = `INSERT TRANSACTIONDETAILPOSAUDIO (RETURN): Transact=${data.Transact}, PRODNUM=${detail.PRODNUM}`;
              await connection.query(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (?,?,?)`,
                [data.Transact, detail.PRODNUM, detail.QuantityReturn],
              );
              if (isPrimary === 1) {
                lastSqlBatch = `UPDATE DBA.PRODUCT (RETURN): PRODNUM=${linkNum}`;
                await connection.query(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+? WHERE PRODNUM=?`,
                  [retQty, linkNum],
                );
                lastSqlBatch = `UPDATE DBA.ProductPOSAudio (RETURN): PRODNUM=${linkNum}`;
                await connection.query(
                  `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+?, OUT=OUT-? WHERE PRODNUM=?`,
                  [retQty, retQty, linkNum],
                );
              }
            }
          }
        }
      }

      lastSqlBatch = "Đang Commit Transaction";
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
        // [FIX]: Bắt buộc xuất lastSqlBatch ra file log để biết chính xác chết ở bước nào
        const logContent = `\n[${new Date().toISOString()}] ERROR: ${errStr}\nSQL BATCH FAILED AT: ${lastSqlBatch}\n`;
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
