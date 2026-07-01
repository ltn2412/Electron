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

      // 1. CẬP NHẬT HEADER
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

      // ==========================================
      // BƯỚC ĐỘT PHÁ: GOM NHÓM SỐ LƯỢNG ĐỂ KHÔNG BỊ TREO DB
      // ==========================================
      const productCountdownChanges = new Map<number, number>(); // Lưu tổng số lượng cần + hoặc - cho DBA.PRODUCT
      const posAudioStorageChanges = new Map<number, number>(); // Lưu tổng số lượng cần + hoặc - cho DBA.ProductPOSAudio

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

          const totalOutQty = (detail.QuantityOut || 0) * linkQty;
          const totalRetQty = (detail.QuantityReturn || 0) * linkQty;
          const isUpdate = (existingDetail as unknown[]).length > 0;

          // ================= OUT =================
          if (data.Status === 1 && detail.QuantityOut > 0) {
            // Update chi tiết ngay lập tức
            if (isUpdate) {
              await connection.query(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ${detail.QuantityOut} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );
            } else {
              await connection.query(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityOut})`,
              );
            }

            // Ghi sổ tính nhẩm: Trừ kho (Chỉ trừ Combo máy con, vé lẻ không trừ)
            if (linkNum !== detail.PRODNUM) {
              const currentProdVal = productCountdownChanges.get(linkNum) || 0;
              productCountdownChanges.set(
                linkNum,
                currentProdVal - totalOutQty,
              );
            }

            const currentStorageVal = posAudioStorageChanges.get(linkNum) || 0;
            posAudioStorageChanges.set(
              linkNum,
              currentStorageVal - totalOutQty,
            );
          }

          // ================= RETURN =================
          if (data.Status === 2 && detail.QuantityReturn > 0) {
            // Update chi tiết ngay lập tức
            if (isUpdate) {
              await connection.query(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ${detail.QuantityReturn} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );
            } else {
              await connection.query(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityReturn})`,
              );
            }

            // Ghi sổ tính nhẩm: Cộng trả lại kho
            // 1. Phục hồi cho vé trên hóa đơn (giúp 17 -> 18)
            const currentTicketVal =
              productCountdownChanges.get(detail.PRODNUM) || 0;
            productCountdownChanges.set(
              detail.PRODNUM,
              currentTicketVal + detail.QuantityReturn,
            );

            // 2. Phục hồi cho máy con nếu là Combo (giúp 170 -> 180)
            if (linkNum !== detail.PRODNUM) {
              const currentChildVal = productCountdownChanges.get(linkNum) || 0;
              productCountdownChanges.set(
                linkNum,
                currentChildVal + totalRetQty,
              );
            }

            // 3. Phục hồi cho kho POS Audio
            const currentStorageVal = posAudioStorageChanges.get(linkNum) || 0;
            posAudioStorageChanges.set(
              linkNum,
              currentStorageVal + totalRetQty,
            );
          }
        }

        // ==========================================
        // THỰC THI SQL HÀNG LOẠT Ở ĐÂY (Mỗi PRODNUM chỉ chạy 1 lần)
        // ==========================================
        for (const [prodNum, changeQty] of productCountdownChanges.entries()) {
          if (changeQty === 0) continue; // Bỏ qua nếu không có sự thay đổi

          console.log(
            `SQL EXEC PRODUCT: Cập nhật ${prodNum} thêm ${changeQty}`,
          );
          // Dùng công thức + (changeQty). Nếu changeQty là số âm, nó sẽ tự thành phép trừ
          await connection.query(
            `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + (${changeQty}) WHERE PRODNUM = ${prodNum}`,
          );
        }

        for (const [prodNum, changeQty] of posAudioStorageChanges.entries()) {
          if (changeQty === 0) continue;

          console.log(
            `SQL EXEC STORAGE: Cập nhật ${prodNum} thêm ${changeQty}`,
          );
          // STORAGE thì cộng changeQty, còn OUT thì ngược lại trừ changeQty
          await connection.query(
            `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE + (${changeQty}), OUT = OUT - (${changeQty}) WHERE PRODNUM = ${prodNum}`,
          );
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
