import { getConnection } from "@/main/config/database";
import { ProductPOSAudio } from "@/shared/types";

export class ProductService {
  static async getProductPOSAudio(): Promise<ProductPOSAudio[]> {
    let connection;
    try {
      connection = await getConnection();
      const query = `
        SELECT 
          POAP.PRODNUM, 
          POAP.DESCRIPT, 
          POAP.REFCODE, 
          ISNULL(CAST(ISNULL(POAP.STORAGE, 0) - ISNULL(T.QUANTITY, 0) AS INTEGER), 0) AS STORAGE, 
          POAP.QUANTITY AS QUANTITY 
        FROM DBA.ProductPOSAudio POAP
        LEFT JOIN (
          SELECT 
            POA.PRODNUMLINK AS PRODNUMLINK, 
            SUM(PD.QUAN * POA.QUANTITY) AS QUANTITY 
          FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PRODUCTPOSAUDIO POA ON PD.PRODNUM = POA.PRODNUM
          WHERE PD.OPENDATE = (SELECT OPENDATE FROM DBA.CURRENTOPENDAY) 
            AND PD.TIMEORD >= POA.DATEMODIFIED
            AND ISNULL(PD.ReduceInventory, 1) = 1
          GROUP BY POA.PRODNUMLINK
        ) T ON POAP.PRODNUM = T.PRODNUMLINK
        WHERE POAP.ISPRIMARY = 1
      `;
      const result = await connection.query(query);
      return JSON.parse(JSON.stringify(result)) as ProductPOSAudio[];
    } catch (error) {
      console.error("Lỗi khi lấy danh sách Product POS Audio:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  static async outProduct(products: ProductPOSAudio[]): Promise<boolean> {
    let connection;
    try {
      connection = await getConnection();
      const querySecondary = `
        SELECT PRODNUM, DESCRIPT, REFCODE, ISPRIMARY, QUANTITY, ISNULL(STORAGE,0) AS STORAGE, PRODNUMLINK 
        FROM DBA.ProductPOSAudio 
        WHERE ISPRIMARY = 0 AND PRODNUMLINK IS NOT NULL AND QUANTITY <> 0
      `;
      const linkedProducts = await connection.query(querySecondary);

      for (const prod of products) {
        if (prod.COUNT && prod.COUNT !== 0) {
          prod.STORAGE = (prod.STORAGE || 0) - prod.COUNT;
          prod.OUT = (prod.OUT || 0) - prod.COUNT;

          const sqlBatch = `
            UPDATE DBA.PRODUCT SET COUNTDOWN=${prod.STORAGE} WHERE PRODNUM=${prod.PRODNUM};
            INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${prod.PRODNUM}\\x0D\\x0A');
            UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
            
            INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,2,'UPDATEPROD\\x0D\\x0A${prod.PRODNUM}\\x0D\\x0A');
            UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
            
            UPDATE DBA.ProductPOSAudio SET STORAGE=${prod.STORAGE}, OUT=${prod.OUT} WHERE PRODNUM=${prod.PRODNUM};
          `;
          await connection.query(sqlBatch);

          const links = (linkedProducts as ProductPOSAudio[]).filter(
            (p) => p.PRODNUMLINK === prod.PRODNUM,
          );
          for (const link of links) {
            const count = Math.floor(prod.STORAGE / link.QUANTITY);
            const countDown = count > 0 ? count : -1;
            const sqlLink = `
              UPDATE DBA.PRODUCT SET COUNTDOWN=${countDown} WHERE PRODNUM=${link.PRODNUMLINK};
              INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${link.PRODNUMLINK}\\x0D\\x0A');
              UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
              
              INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,2,'UPDATEPROD\\x0D\\x0A${link.PRODNUMLINK}\\x0D\\x0A');
              UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
            `;
            await connection.query(sqlLink);
          }
        }
      }
      return true;
    } catch (error) {
      console.error("Lỗi khi Out Product:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  static async resetProduct(products: ProductPOSAudio[]): Promise<boolean> {
    let connection;
    try {
      connection = await getConnection();
      const querySecondary = `
        SELECT PRODNUM, DESCRIPT, REFCODE, ISPRIMARY, QUANTITY, ISNULL(STORAGE,0) AS STORAGE, PRODNUMLINK 
        FROM DBA.ProductPOSAudio 
        WHERE ISPRIMARY = 0 AND PRODNUMLINK IS NOT NULL AND QUANTITY <> 0
      `;
      const linkedProducts = await connection.query(querySecondary);

      for (const prod of products) {
        const sqlBatch = `
          UPDATE DBA.PRODUCT SET COUNTDOWN=${prod.COUNT} WHERE PRODNUM=${prod.PRODNUM};
          INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${prod.PRODNUM}\\x0D\\x0A');
          UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
          
          INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,2,'UPDATEPROD\\x0D\\x0A${prod.PRODNUM}\\x0D\\x0A');
          UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
          
          UPDATE DBA.PRODUCTPOSAUDIO SET STORAGE=${prod.COUNT}, OUT=0, DATEMODIFIED=GETDATE() WHERE PRODNUM=${prod.PRODNUM};
          UPDATE DBA.PRODUCTPOSAUDIO SET DATEMODIFIED=GETDATE() WHERE PRODNUMLINK=${prod.PRODNUM};
        `;
        await connection.query(sqlBatch);

        const links = (linkedProducts as ProductPOSAudio[]).filter(
          (p) => p.PRODNUMLINK === prod.PRODNUM,
        );
        for (const link of links) {
          const count = Math.floor(prod.COUNT! / link.QUANTITY);
          const countDown = count > 0 ? count : -1;
          const sqlLink = `
            UPDATE DBA.PRODUCT SET COUNTDOWN=${countDown} WHERE PRODNUM=${link.PRODNUM};
            INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,1,'UPDATEPROD\\x0D\\x0A${link.PRODNUM}\\x0D\\x0A');
            UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
            
            INSERT INTO DBA.MsgMgr(MsgNum,MsgTime,MsgType,MsgPrm,Data) VALUES ((SELECT MAX(NEXTNUM)+1 FROM DBA.AUTOINCINDEX WHERE INCNAME='GetNext_MsgMgr'),getdate(),7,2,'UPDATEPROD\\x0D\\x0A${link.PRODNUM}\\x0D\\x0A');
            UPDATE DBA.AUTOINCINDEX SET NEXTNUM=(SELECT MAX(MsgNum) FROM DBA.MsgMgr) WHERE INCNAME='GetNext_MsgMgr';
          `;
          await connection.query(sqlLink);
        }
      }
      return true;
    } catch (error) {
      console.error("Lỗi khi Reset Product:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
