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

          if ((existingDetail as unknown[]).length > 0) {
            // OUT
            if (data.Status === 1 && detail.QuantityOut > 0) {
              sqlBatch += `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYOUT = ${detail.QuantityOut} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM};`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM};`;
              sqlBatch += `INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${detail.PRODNUM}\\x0D\\x0A');`;
              sqlBatch += `UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';`;
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${detail.QuantityOut},OUT=OUT+${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM};`;
            }
            // RETURN
            if (data.Status === 2 && detail.QuantityReturn > 0) {
              sqlBatch += `UPDATE DBA.TRANSACTIONDETAILPOSAUDIO SET QUANTITYRETURN = ${detail.QuantityReturn} WHERE TRANSACT = ${data.Transact} AND PRODNUM = ${detail.PRODNUM};`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN+${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM};`;
              sqlBatch += `INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${detail.PRODNUM}\\x0D\\x0A');`;
              sqlBatch += `UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';`;
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE+${detail.QuantityReturn},OUT=OUT-${detail.QuantityReturn} WHERE PRODNUM=${detail.PRODNUM};`;
            }
          } else {
            // OUT
            if (data.Status === 1 && detail.QuantityOut > 0) {
              sqlBatch += `INSERT INTO DBA.TRANSACTIONDETAILPOSAUDIO(TRANSACT,PRODNUM,QUANTITYOUT) VALUES (${data.Transact},${detail.PRODNUM},${detail.QuantityOut});`;
              sqlBatch += `UPDATE DBA.PRODUCT SET COUNTDOWN=COUNTDOWN-${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM};`;
              sqlBatch += `INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${detail.PRODNUM}\\x0D\\x0A');`;
              sqlBatch += `UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';`;
              sqlBatch += `UPDATE DBA.ProductPOSAudio SET STORAGE=STORAGE-${detail.QuantityOut},OUT=OUT+${detail.QuantityOut} WHERE PRODNUM=${detail.PRODNUM};`;
            }
            // RETURN
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
