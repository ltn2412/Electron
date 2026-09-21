import { getConnection } from "@/main/config/database";
import { hasColumn, skipSelfCountdownSql } from "@/main/config/schema";
import {
  ProductMapping,
  ProductMappingPayload,
  ProductPOSAudio,
} from "@/shared/types";
import type { Connection } from "odbc";

export class ProductService {
  static async getProductPOSAudio(): Promise<ProductPOSAudio[]> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      const query = `
        SELECT 
          POAP.PRODNUM, 
          POAP.DESCRIPT, 
          POAP.REFCODE, 
          ISNULL(POAP.STORAGE, 0) AS STORAGE, 
          POAP.QUANTITY AS QUANTITY 
        FROM DBA.ProductPOSAudio POAP
        WHERE POAP.ISPRIMARY = 1
      `;
      const result = (await connection.query(query)) as ProductPOSAudio[];
      return JSON.parse(JSON.stringify(result)) as ProductPOSAudio[];
    } finally {
      if (connection) await connection.close();
    }
  }

  static async outProduct(products: ProductPOSAudio[]): Promise<boolean> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      const querySecondary = `
        SELECT PRODNUM, DESCRIPT, REFCODE, ISPRIMARY, QUANTITY, ISNULL(STORAGE,0) AS STORAGE, PRODNUMLINK 
        FROM DBA.ProductPOSAudio 
        WHERE ISPRIMARY = 0 AND PRODNUMLINK IS NOT NULL AND QUANTITY <> 0
          AND ${skipSelfCountdownSql()} = 0
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
    } finally {
      if (connection) await connection.close();
    }
  }

  static async resetProduct(products: ProductPOSAudio[]): Promise<boolean> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      const querySecondary = `
        SELECT PRODNUM, DESCRIPT, REFCODE, ISPRIMARY, QUANTITY, ISNULL(STORAGE,0) AS STORAGE, PRODNUMLINK 
        FROM DBA.ProductPOSAudio 
        WHERE ISPRIMARY = 0 AND PRODNUMLINK IS NOT NULL AND QUANTITY <> 0
          AND ${skipSelfCountdownSql()} = 0
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
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * Every POS Audio product with the POSAudio row it is mapped through, so the
   * mapping screen can show what each product deducts from.
   */
  static async getProductMappings(): Promise<ProductMapping[]> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      const query = `
        SELECT
          P.PRODNUM,
          P.DESCRIPT,
          P.REFCODE,
          ISNULL(P.COUNTDOWN, 0) AS COUNTDOWN,
          POAP.ISPRIMARY,
          POAP.PRODNUMLINK,
          POAP.QUANTITY,
          ISNULL(POAP.STORAGE, 0) AS STORAGE,
          ${skipSelfCountdownSql("POAP")} AS SKIPSELFCOUNTDOWN,
          LP.DESCRIPT AS LINKDESCRIPT
        FROM DBA.PRODUCT P
        LEFT JOIN DBA.ProductPOSAudio POAP ON P.PRODNUM = POAP.PRODNUM
        LEFT JOIN DBA.PRODUCT LP ON POAP.PRODNUMLINK = LP.PRODNUM
        WHERE P.IsActive = 1 AND P.REFCODE like '%_F:POS_AUDIO%'
        ORDER BY P.PRODNUM
      `;
      const result = (await connection.query(query)) as ProductMapping[];
      return JSON.parse(JSON.stringify(result)) as ProductMapping[];
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * Point a product at the stock of another one: selling it deducts
   * `QUANTITY` of `PRODNUMLINK` instead of its own stock.
   */
  static async saveProductMapping(
    mapping: ProductMappingPayload,
  ): Promise<boolean> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();

      if (mapping.PRODNUM === mapping.PRODNUMLINK)
        throw new Error("A product cannot be mapped to itself.");

      const quantity = Math.max(1, Math.floor(mapping.QUANTITY || 1));
      const skipSelf = mapping.SKIPSELFCOUNTDOWN ? 1 : 0;

      const targetRow = (await connection.query(
        `SELECT ISPRIMARY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`,
        [mapping.PRODNUMLINK],
      )) as { ISPRIMARY: number }[];
      if (targetRow.length === 0)
        throw new Error("The product being mapped to has no stock row.");

      const existing = (await connection.query(
        `SELECT ISPRIMARY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`,
        [mapping.PRODNUM],
      )) as { ISPRIMARY: number }[];

      // Primary rows hold the real device stock, remapping one would move the
      // inventory of every product linked to it.
      if (existing.length > 0 && existing[0].ISPRIMARY === 1)
        throw new Error(
          "This product holds its own stock and cannot be mapped to another one.",
        );

      // Saving the flag into a column that does not exist would silently drop
      // it, and the product would keep being restored on every return.
      if (skipSelf && !hasColumn("DBA.ProductPOSAudio", "SKIPSELFCOUNTDOWN"))
        throw new Error(
          "Column DBA.ProductPOSAudio.SKIPSELFCOUNTDOWN is missing, the unlimited flag cannot be saved yet.",
        );

      const skipSelfSet = hasColumn("DBA.ProductPOSAudio", "SKIPSELFCOUNTDOWN")
        ? `, SKIPSELFCOUNTDOWN = ${skipSelf}`
        : "";

      if (existing.length > 0) {
        await connection.query(
          `UPDATE DBA.ProductPOSAudio
           SET ISPRIMARY = 0, PRODNUMLINK = ?, QUANTITY = ?${skipSelfSet}, DATEMODIFIED = GETDATE()
           WHERE PRODNUM = ?`,
          [mapping.PRODNUMLINK, quantity, mapping.PRODNUM],
        );
      } else {
        const skipSelfColumn = hasColumn(
          "DBA.ProductPOSAudio",
          "SKIPSELFCOUNTDOWN",
        )
          ? ", SKIPSELFCOUNTDOWN"
          : "";
        const skipSelfValue = hasColumn(
          "DBA.ProductPOSAudio",
          "SKIPSELFCOUNTDOWN",
        )
          ? `, ${skipSelf}`
          : "";
        await connection.query(
          `INSERT INTO DBA.ProductPOSAudio
             (PRODNUM, DESCRIPT, REFCODE, ISPRIMARY, PRODNUMLINK, QUANTITY, STORAGE, OUT, DATEMODIFIED${skipSelfColumn})
           SELECT P.PRODNUM, P.DESCRIPT, P.REFCODE, 0, ?, ?, 0, 0, GETDATE()${skipSelfValue}
           FROM DBA.PRODUCT P WHERE P.PRODNUM = ?`,
          [mapping.PRODNUMLINK, quantity, mapping.PRODNUM],
        );
      }

      return true;
    } finally {
      if (connection) await connection.close();
    }
  }

  static async deleteProductMapping(prodnum: number): Promise<boolean> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      const existing = (await connection.query(
        `SELECT ISPRIMARY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`,
        [prodnum],
      )) as { ISPRIMARY: number }[];
      if (existing.length === 0) return true;
      if (existing[0].ISPRIMARY === 1)
        throw new Error(
          "This product holds its own stock, its row cannot be removed.",
        );

      await connection.query(
        `DELETE FROM DBA.ProductPOSAudio WHERE PRODNUM = ? AND ISPRIMARY = 0`,
        [prodnum],
      );
      return true;
    } finally {
      if (connection) await connection.close();
    }
  }
}
