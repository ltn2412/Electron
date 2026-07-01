import { getConnection } from "@/main/config/database";
import { TransactionPOSAudioPayload } from "@/shared/types";

export class TransactionPOSAudioService {
  static async createUpdateTransaction(
    data: TransactionPOSAudioPayload,
  ): Promise<void> {
    let connection;
    let lastQuery = "Khởi tạo kết nối";

    try {
      connection = await getConnection();

      try {
        await connection.query(
          `SET TEMPORARY OPTION blocking_timeout = '3000'`,
        );
      } catch (e) {}

      await connection.beginTransaction();

      lastQuery = "SELECT TRANSACTIONPOSAUDIO";
      const existing = await connection.query(
        `SELECT * FROM DBA.TRANSACTIONPOSAUDIO WHERE TRANSACT = ?`,
        [data.Transact],
      );

      if ((existing as unknown[]).length > 0) {
        lastQuery = "UPDATE TRANSACTIONPOSAUDIO";
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET STATUS = ? WHERE TRANSACT = ?`,
          [data.Status, data.Transact],
        );
      } else {
        lastQuery = "INSERT TRANSACTIONPOSAUDIO";
        await connection.query(
          `INSERT INTO DBA.TRANSACTIONPOSAUDIO(TRANSACT,STATUS,PHONENUMBER,DATEOUT,DATERETURN) VALUES (?, ?, ?, GETDATE(), GETDATE())`,
          [data.Transact, data.Status, data.PhoneNumber],
        );
      }

      if (data.Status === 2) {
        lastQuery = "UPDATE DATERETURN";
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET DATERETURN = GETDATE() WHERE TRANSACT = ?`,
          [data.Transact],
        );
      }

      const productCountdownChanges = new Map<number, number>();
      const posAudioStorageChanges = new Map<number, number>();
      const detailOutQueries: any[] = [];
      const detailRetQueries: any[] = [];

      if (
        data.TransactionDetailPOSAudios &&
        data.TransactionDetailPOSAudios.length > 0
      ) {
        for (const detail of data.TransactionDetailPOSAudios) {
          lastQuery = `SELECT TRANSACTIONDETAILPOSAUDIO (PRODNUM=${detail.PRODNUM})`;
          const existingDetail = await connection.query(
            `SELECT * FROM DBA.TRANSACTIONDETAILPOSAUDIO WHERE TRANSACT = ? AND PRODNUM = ?`,
            [data.Transact, detail.PRODNUM],
          );

          lastQuery = `SELECT ProductPOSAudio (PRODNUM=${detail.PRODNUM})`;
          const prodLinkResult = await connection.query(
            `SELECT PRODNUMLINK, QUANTITY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`,
            [detail.PRODNUM],
          );

          let linkNum = detail.PRODNUM;
          let linkQty = 1;

          if (prodLinkResult && (prodLinkResult as unknown[]).length > 0) {
            const row = (prodLinkResult as any[])[0];
            linkNum = row.PRODNUMLINK || detail.PRODNUM;
            linkQty = row.QUANTITY || 1;
          }

          const totalOutQty = (detail.QuantityOut || 0) * linkQty;
          const totalRetQty = (detail.QuantityReturn || 0) * linkQty;
          const isUpdate = (existingDetail as unknown[]).length > 0;

          // ================= OUT (New -> Out) =================
          if (data.Status === 1 && detail.QuantityOut > 0) {
            if (isUpdate) {
              detailOutQueries.push({
                sql: `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ? WHERE TRANSACT = ? AND PRODNUM = ?`,
                params: [detail.QuantityOut, data.Transact, detail.PRODNUM],
              });
            } else {
              detailOutQueries.push({
                sql: `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (?,?,?)`,
                params: [data.Transact, detail.PRODNUM, detail.QuantityOut],
              });
            }

            // Trừ kho máy con nếu là Combo
            if (linkNum !== detail.PRODNUM) {
              productCountdownChanges.set(
                linkNum,
                (productCountdownChanges.get(linkNum) || 0) - totalOutQty,
              );
            }
            posAudioStorageChanges.set(
              linkNum,
              (posAudioStorageChanges.get(linkNum) || 0) - totalOutQty,
            );
          }

          // ================= RETURN (Out -> Return) =================
          if (data.Status === 2 && detail.QuantityReturn > 0) {
            if (isUpdate) {
              detailRetQueries.push({
                sql: `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ? WHERE TRANSACT = ? AND PRODNUM = ?`,
                params: [detail.QuantityReturn, data.Transact, detail.PRODNUM],
              });
            } else {
              detailRetQueries.push({
                sql: `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (?,?,?)`,
                params: [data.Transact, detail.PRODNUM, detail.QuantityReturn],
              });
            }

            // 1. Phục hồi vé
            productCountdownChanges.set(
              detail.PRODNUM,
              (productCountdownChanges.get(detail.PRODNUM) || 0) +
                detail.QuantityReturn,
            );
            // 2. Phục hồi máy con nếu là combo
            if (linkNum !== detail.PRODNUM) {
              productCountdownChanges.set(
                linkNum,
                (productCountdownChanges.get(linkNum) || 0) + totalRetQty,
              );
            }
            posAudioStorageChanges.set(
              linkNum,
              (posAudioStorageChanges.get(linkNum) || 0) + totalRetQty,
            );
          }
        }

        // ==============================================================
        // THỰC THI GỘP: SINH RA 1 CÂU SQL DUY NHẤT ĐỂ TRÁNH LỖI KẸT ODBC
        // ==============================================================

        // 1. UPDATE DBA.PRODUCT (Gộp 2 ID vào 1 câu truy vấn)
        let productSql = "";
        if (productCountdownChanges.size > 0) {
          let caseStr = "";
          let ids: number[] = [];
          for (const [pNum, qty] of productCountdownChanges.entries()) {
            if (qty !== 0) {
              caseStr += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              ids.push(pNum);
            }
          }
          if (ids.length > 0) {
            productSql = `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + CASE ${caseStr} ELSE 0 END WHERE PRODNUM IN (${ids.join(",")})`;
            lastQuery = productSql; // Ghi vết lại
            await connection.query(productSql);
          }
        }

        // 2. UPDATE DBA.ProductPOSAudio (Gộp 2 ID vào 1 câu truy vấn)
        let posAudioSql = "";
        if (posAudioStorageChanges.size > 0) {
          let caseStrStorage = "";
          let caseStrOut = "";
          let ids: number[] = [];
          for (const [pNum, qty] of posAudioStorageChanges.entries()) {
            if (qty !== 0) {
              caseStrStorage += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              caseStrOut += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              ids.push(pNum);
            }
          }
          if (ids.length > 0) {
            posAudioSql = `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE + CASE ${caseStrStorage} ELSE 0 END, OUT = OUT - CASE ${caseStrOut} ELSE 0 END WHERE PRODNUM IN (${ids.join(",")})`;
            lastQuery = posAudioSql; // Ghi vết lại
            await connection.query(posAudioSql);
          }
        }

        // 3. THỰC THI BẢNG DETAIL CUỐI CÙNG
        const allDetails = [...detailOutQueries, ...detailRetQueries];
        for (const q of allDetails) {
          lastQuery = q.sql + " | Biến: " + JSON.stringify(q.params);
          await connection.query(q.sql, q.params);
        }
      }

      lastQuery = "Đang Commit Database";
      await connection.commit();
    } catch (error: any) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (e) {}
      }

      const dbError = error.odbcErrors
        ? JSON.stringify(error.odbcErrors)
        : error.message;

      // ĐOẠN NÀY LÀ CỨU CÁNH CỦA BẠN: NÓ SẼ HIỆN THẲNG LÊN POPUP
      const finalErrorMessage = `[SQL BỊ CHẾT]: \n${lastQuery}\n\n[LỖI GỐC TỪ DB]: \n${dbError}`;
      console.error(finalErrorMessage);

      throw new Error(finalErrorMessage); // Ném lỗi này ra Frontend
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
