import { getConnection } from "@/main/config/database";
import { TransactionPOSAudioPayload } from "@/shared/types";

export class TransactionPOSAudioService {
  static async createUpdateTransaction(
    data: TransactionPOSAudioPayload,
  ): Promise<void> {
    let connection;
    try {
      connection = await getConnection();

      // BẮT BUỘC PHẢI MỞ TRANSACTION
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

      if (
        data.TransactionDetailPOSAudios &&
        data.TransactionDetailPOSAudios.length > 0
      ) {
        for (const detail of data.TransactionDetailPOSAudios) {
          const detailQuery = `SELECT * FROM DBA.TRANSACTIONDETAILPOSAUDIO WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`;
          const existingDetail = await connection.query(detailQuery);

          const prodLinkQuery = `SELECT PRODNUMLINK, QUANTITY FROM DBA.ProductPOSAudio WHERE PRODNUM = ${detail.PRODNUM}`;
          const prodLinkResult = await connection.query(prodLinkQuery);

          let linkNum = detail.PRODNUM;
          let linkQty = 1;

          if (prodLinkResult && (prodLinkResult as unknown[]).length > 0) {
            const row = (prodLinkResult as any[])[0];
            linkNum = row.PRODNUMLINK || detail.PRODNUM;
            linkQty = row.QUANTITY || 1;
          }

          const outQty = (detail.QuantityOut || 0) * linkQty;
          const retQty = (detail.QuantityReturn || 0) * linkQty;
          const queries: string[] = [];

          if ((existingDetail as unknown[]).length > 0) {
            // ================= OUT =================
            if (data.Status === 1 && detail.QuantityOut > 0) {
              queries.push(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ${detail.QuantityOut} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );
              // Nếu là Combo (linkNum khác detail.PRODNUM): Trừ kho máy con
              if (linkNum !== detail.PRODNUM) {
                queries.push(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${outQty} WHERE PRODNUM=${linkNum}`,
                );
              }
              // Luôn trừ kho lưu trữ
              queries.push(
                `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${outQty},OUT=OUT+${outQty} WHERE PRODNUM=${linkNum}`,
              );
            }
            // ================= RETURN =================
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              queries.push(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ${detail.QuantityReturn} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );
              // 1. Luôn cộng trả lại tồn kho cho chính Item (Vé/Máy Lẻ)
              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM}`,
              );
              // 2. Nếu là Combo: Cộng trả thêm cho kho máy con
              if (linkNum !== detail.PRODNUM) {
                queries.push(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${retQty} WHERE PRODNUM=${linkNum}`,
                );
              }
              // 3. Luôn phục hồi kho lưu trữ
              queries.push(
                `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${retQty},OUT=OUT-${retQty} WHERE PRODNUM=${linkNum}`,
              );
            }
          } else {
            // ================= OUT (INSERT) =================
            if (data.Status === 1 && detail.QuantityOut > 0) {
              queries.push(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityOut})`,
              );
              if (linkNum !== detail.PRODNUM) {
                queries.push(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${outQty} WHERE PRODNUM=${linkNum}`,
                );
              }
              queries.push(
                `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${outQty},OUT=OUT+${outQty} WHERE PRODNUM=${linkNum}`,
              );
            }
            // ================= RETURN (INSERT) =================
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              queries.push(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityReturn})`,
              );
              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM}`,
              );
              if (linkNum !== detail.PRODNUM) {
                queries.push(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${retQty} WHERE PRODNUM=${linkNum}`,
                );
              }
              queries.push(
                `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${retQty},OUT=OUT-${retQty} WHERE PRODNUM=${linkNum}`,
              );
            }
          }

          // Thực thi SQL
          for (const query of queries) {
            console.log("SQL EXEC:", query);
            await connection.query(query);
          }
        }
      }

      // COMMIT SAU KHI XONG LOOP
      await connection.commit();
    } catch (error: any) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (e) {}
      }
      console.error("Lỗi khi Create/Update Transaction POS Audio:", error);
      throw new Error("Loi DB: " + (error.message || error.toString()));
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
