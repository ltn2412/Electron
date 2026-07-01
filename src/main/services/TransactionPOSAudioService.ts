import { getConnection } from "@/main/config/database";
import { TransactionPOSAudioPayload } from "@/shared/types";
export class TransactionPOSAudioService {
  static async createUpdateTransaction(
    data: TransactionPOSAudioPayload,
  ): Promise<void> {
    let connection;
    try {
      connection = await getConnection();
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
          let sqlBatch = "";
          const prodLinkQuery = `SELECT PRODNUMLINK, QUANTITY, ISPRIMARY FROM DBA.ProductPOSAudio WHERE PRODNUM = ${detail.PRODNUM}`;
          const prodLinkResult = await connection.query(prodLinkQuery);
          let linkNum = detail.PRODNUM;
          let linkQty = 1;
          let isPrimary = 1;
          if (prodLinkResult && (prodLinkResult as unknown[]).length > 0) {
            const row = (prodLinkResult as any[])[0];
            linkNum = row.PRODNUMLINK;
            linkQty = row.QUANTITY || 1;
            isPrimary = row.ISPRIMARY;
          }
          const outQty = detail.QuantityOut * linkQty;
          const retQty = detail.QuantityReturn * linkQty;
          if ((existingDetail as unknown[]).length > 0) {
            // OUT
            if (data.Status === 1 && detail.QuantityOut > 0) {
              sqlBatch += `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ${detail.QuantityOut} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM};`;
              if (isPrimary === 0) {
                sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${outQty} WHERE PRODNUM=${linkNum};`;
              }
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${outQty},OUT=OUT+${outQty} WHERE PRODNUM=${linkNum};`;
            }
            // RETURN
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              sqlBatch += `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ${detail.QuantityReturn} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM};`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${retQty} WHERE PRODNUM=${linkNum};`;
              if (isPrimary === 0) {
                sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM};`;
              }
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${retQty},OUT=OUT-${retQty} WHERE PRODNUM=${linkNum};`;
            }
          } else {
            // OUT
            if (data.Status === 1 && detail.QuantityOut > 0) {
              sqlBatch += `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityOut});`;
              if (isPrimary === 0) {
                sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${outQty} WHERE PRODNUM=${linkNum};`;
              }
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${outQty},OUT=OUT+${outQty} WHERE PRODNUM=${linkNum};`;
            }
            // RETURN
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              sqlBatch += `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYRETURN) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityReturn});`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${retQty} WHERE PRODNUM=${linkNum};`;
              if (isPrimary === 0) {
                sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM};`;
              }
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${retQty},OUT=OUT-${retQty} WHERE PRODNUM=${linkNum};`;
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
