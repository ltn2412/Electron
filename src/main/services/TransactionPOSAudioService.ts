import { getConnection } from "@/main/config/database";
import { TransactionPOSAudioPayload } from "@/shared/types";

export class TransactionPOSAudioService {
  static async createUpdateTransaction(
    data: TransactionPOSAudioPayload,
  ): Promise<void> {
    let connection;
    try {
      connection = await getConnection();

      // 1. BẮT BUỘC PHẢI MỞ TRANSACTION KHI LÀM VIỆC VỚI COMBO
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

          // Tính tổng số lượng máy thực tế bị tác động (Dành riêng cho máy chính linkNum)
          const totalOutQty = (detail.QuantityOut || 0) * linkQty;
          const totalRetQty = (detail.QuantityReturn || 0) * linkQty;

          const queries: string[] = [];

          if ((existingDetail as unknown[]).length > 0) {
            // ================== OUT ==================
            if (data.Status === 1 && detail.QuantityOut > 0) {
              queries.push(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ${detail.QuantityOut} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );

              // 1. LUÔN TRỪ TỒN KHO CỦA CHÍNH ITEM ĐÓ (Cho cả lẻ và combo: vd 18 -> 17)
              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM}`,
              );

              // 2. NẾU LÀ COMBO, TRỪ THÊM TỒN KHO MÁY CHÍNH (vd 180 -> 170)
              if (linkNum !== detail.PRODNUM) {
                queries.push(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${totalOutQty} WHERE PRODNUM=${linkNum}`,
                );
              }

              // 3. Cập nhật vào POS Audio Storage (luôn nhắm vào máy chính)
              queries.push(
                `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${totalOutQty},OUT=OUT+${totalOutQty} WHERE PRODNUM=${linkNum}`,
              );
            }

            // ================== RETURN ==================
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              queries.push(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ${detail.QuantityReturn} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );

              // 1. LUÔN CỘNG LẠI TỒN KHO CỦA CHÍNH ITEM ĐÓ (Cho cả lẻ và combo: vd 17 -> 18)
              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM}`,
              );

              // 2. NẾU LÀ COMBO, CỘNG LẠI TỒN KHO MÁY CHÍNH (vd 170 -> 180)
              if (linkNum !== detail.PRODNUM) {
                queries.push(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${totalRetQty} WHERE PRODNUM=${linkNum}`,
                );
              }

              // 3. Cập nhật vào POS Audio Storage
              queries.push(
                `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${totalRetQty},OUT=OUT-${totalRetQty} WHERE PRODNUM=${linkNum}`,
              );
            }
          } else {
            // ================== OUT (INSERT) ==================
            if (data.Status === 1 && detail.QuantityOut > 0) {
              queries.push(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityOut})`,
              );

              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM}`,
              );
              if (linkNum !== detail.PRODNUM) {
                queries.push(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${totalOutQty} WHERE PRODNUM=${linkNum}`,
                );
              }
              queries.push(
                `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${totalOutQty},OUT=OUT+${totalOutQty} WHERE PRODNUM=${linkNum}`,
              );
            }

            // ================== RETURN (INSERT) ==================
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              queries.push(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityReturn})`,
              );

              queries.push(
                `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM}`,
              );
              if (linkNum !== detail.PRODNUM) {
                queries.push(
                  `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${totalRetQty} WHERE PRODNUM=${linkNum}`,
                );
              }
              queries.push(
                `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${totalRetQty},OUT=OUT-${totalRetQty} WHERE PRODNUM=${linkNum}`,
              );
            }
          }

          // Chạy Query
          for (const query of queries) {
            console.log("SQL EXEC:", query);
            await connection.query(query);
          }
        }
      }

      // 2. BẮT BUỘC PHẢI COMMIT SAU KHI XONG LOOP
      await connection.commit();
    } catch (error: any) {
      // Bổ sung Rollback nếu có lỗi để nhả Lock ngay lập tức
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
