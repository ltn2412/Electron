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

      // 1. CẬP NHẬT HEADER (Bảng TRANSACTIONPOSAUDIO)
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

      // 2. CẬP NHẬT DETAILS & TỒN KHO
      if (
        data.TransactionDetailPOSAudios &&
        data.TransactionDetailPOSAudios.length > 0
      ) {
        for (const detail of data.TransactionDetailPOSAudios) {
          const detailQuery = `SELECT * FROM DBA.TRANSACTIONDETAILPOSAUDIO WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`;
          const existingDetail = await connection.query(detailQuery);

          // Truy vấn cấu trúc Combo
          const prodLinkQuery = `SELECT PRODNUMLINK, QUANTITY FROM DBA.ProductPOSAudio WHERE PRODNUM = ${detail.PRODNUM}`;
          const prodLinkResult = await connection.query(prodLinkQuery);

          let linkNum = detail.PRODNUM;
          let linkQty = 1;

          if (prodLinkResult && (prodLinkResult as unknown[]).length > 0) {
            const row = (prodLinkResult as any[])[0];
            linkNum = row.PRODNUMLINK || detail.PRODNUM;
            linkQty = row.QUANTITY || 1;
          }

          const totalOutQty = (detail.QuantityOut || 0) * linkQty;
          const totalRetQty = (detail.QuantityReturn || 0) * linkQty;

          const queries: string[] = [];
          const isUpdate = (existingDetail as unknown[]).length > 0;

          // ================== OUT (New -> Out) ==================
          if (data.Status === 1 && detail.QuantityOut > 0) {
            if (isUpdate) {
              queries.push(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ${detail.QuantityOut} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );
            } else {
              queries.push(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityOut})`,
              );
            }

            // [CHUẨN LOGIC] Lẻ thì không trừ, Combo thì chỉ trừ máy con (vì vé đã trừ lúc lên Order)
            if (linkNum !== detail.PRODNUM) {
              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${totalOutQty} WHERE PRODNUM=${linkNum}`,
              );
            }

            queries.push(
              `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${totalOutQty},OUT=OUT+${totalOutQty} WHERE PRODNUM=${linkNum}`,
            );
          }

          // ================== RETURN (Out -> Return) ==================
          if (data.Status === 2 && detail.QuantityReturn > 0) {
            if (isUpdate) {
              queries.push(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ${detail.QuantityReturn} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );
            } else {
              queries.push(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityReturn})`,
              );
            }

            // [FIX BUG TREO DB] Gộp 2 câu update DBA.PRODUCT thành 1 câu duy nhất dùng CASE WHEN để không bị kẹt Lock
            if (linkNum !== detail.PRODNUM) {
              // Combo: Cập nhật đồng thời cả dòng vé (PRODNUM) và dòng máy con (linkNum) trong 1 nhịp
              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + CASE WHEN PRODNUM = ${detail.PRODNUM} THEN ${detail.QuantityReturn} WHEN PRODNUM = ${linkNum} THEN ${totalRetQty} ELSE 0 END WHERE PRODNUM IN (${detail.PRODNUM}, ${linkNum})`,
              );
            } else {
              // Item Lẻ: Chỉ cập nhật 1 dòng của chính nó
              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM}`,
              );
            }

            // Phục hồi kho
            queries.push(
              `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${totalRetQty},OUT=OUT-${totalRetQty} WHERE PRODNUM=${linkNum}`,
            );
          }

          // Thực thi SQL
          for (const query of queries) {
            console.log("SQL EXEC:", query);
            await connection.query(query);
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
      throw new Error("Loi DB: " + (error.message || error.toString()));
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
