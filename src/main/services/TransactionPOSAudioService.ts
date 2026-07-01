import { getConnection } from "@/main/config/database";
import { TransactionPOSAudioPayload } from "@/shared/types";

export class TransactionPOSAudioService {
  static async createUpdateTransaction(
    data: TransactionPOSAudioPayload,
  ): Promise<void> {
    let connection;
    try {
      connection = await getConnection();

      // BƯỚC ĐỘT PHÁ 1: Ép DB không được phép treo (Freeze) quá 3 giây.
      // Nếu có lock, nó sẽ văng lỗi thẳng ra console để bạn biết chính xác bị gì.
      try {
        await connection.query(
          `SET TEMPORARY OPTION blocking_timeout = '3000'`,
        );
      } catch (e) {
        // Bỏ qua nếu phiên bản DB không hỗ trợ lệnh này
      }

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
      // BƯỚC ĐỘT PHÁ 2: GOM SỐ LIỆU, CHƯA UPDATE DETAIL VỘI
      // ==========================================
      const productCountdownChanges = new Map<number, number>();
      const posAudioStorageChanges = new Map<number, number>();
      const detailQueries: string[] = []; // Chứa các câu lệnh update Detail để chạy SAU CÙNG

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
            if (isUpdate) {
              detailQueries.push(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ${detail.QuantityOut} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );
            } else {
              detailQueries.push(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityOut})`,
              );
            }

            // Lẻ không trừ, Combo thì trừ máy con
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
            if (isUpdate) {
              detailQueries.push(
                `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ${detail.QuantityReturn} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM}`,
              );
            } else {
              detailQueries.push(
                `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityReturn})`,
              );
            }

            // 1. Phục hồi tồn kho Vé (17 -> 18)
            const currentTicketVal =
              productCountdownChanges.get(detail.PRODNUM) || 0;
            productCountdownChanges.set(
              detail.PRODNUM,
              currentTicketVal + detail.QuantityReturn,
            );

            // 2. Phục hồi tồn kho Máy con (170 -> 180)
            if (linkNum !== detail.PRODNUM) {
              const currentChildVal = productCountdownChanges.get(linkNum) || 0;
              productCountdownChanges.set(
                linkNum,
                currentChildVal + totalRetQty,
              );
            }

            // 3. Phục hồi kho Audio
            const currentStorageVal = posAudioStorageChanges.get(linkNum) || 0;
            posAudioStorageChanges.set(
              linkNum,
              currentStorageVal + totalRetQty,
            );
          }
        }

        // ==========================================
        // THỰC THI SQL: CHIẾM LOCK BẢNG LỚN TRƯỚC (CHỐNG DEADLOCK)
        // ==========================================

        // A. Cập nhật bảng PRODUCT trước tiên
        for (const [prodNum, changeQty] of productCountdownChanges.entries()) {
          if (changeQty === 0) continue;
          console.log(
            `[SQL EXEC] UPDATE PRODUCT: PRODNUM=${prodNum}, Thay đổi: ${changeQty}`,
          );
          await connection.query(
            `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + (${changeQty}) WHERE PRODNUM = ${prodNum}`,
          );
        }

        // B. Cập nhật bảng ProductPOSAudio
        for (const [prodNum, changeQty] of posAudioStorageChanges.entries()) {
          if (changeQty === 0) continue;
          console.log(
            `[SQL EXEC] UPDATE POSAudio: PRODNUM=${prodNum}, Thay đổi: ${changeQty}`,
          );
          await connection.query(
            `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE + (${changeQty}), OUT = OUT - (${changeQty}) WHERE PRODNUM = ${prodNum}`,
          );
        }

        // C. Cuối cùng mới Cập nhật bảng Detail
        for (const query of detailQueries) {
          console.log(`[SQL EXEC] DETAIL:`, query);
          await connection.query(query);
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

      // Bắt lỗi Lock Timeout từ DB để báo cho bạn biết
      const errorMsg = error.message || error.toString();
      if (errorMsg.includes("blocked") || errorMsg.includes("timeout")) {
        throw new Error(
          "Lỗi DB: Database đang bị Khóa bởi tiến trình khác. Vui lòng thử lại!",
        );
      }
      throw new Error("Loi DB: " + errorMsg);
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
