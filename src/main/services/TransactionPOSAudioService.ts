import { getConnection } from "@/main/config/database";
import type { Connection } from "odbc";
import { TransactionPOSAudioPayload } from "@/shared/types";
import logger from "@/main/utils/logger";

export class TransactionPOSAudioService {
  static async createUpdateTransaction(
    data: TransactionPOSAudioPayload,
  ): Promise<void> {
    let connection: Connection | undefined;

    try {
      connection = await getConnection();

      // await connection.query(`SET TEMPORARY OPTION blocking_timeout = '3000'`);

      await connection.beginTransaction();

      const existing = await connection.query(
        `SELECT * FROM DBA.TRANSACTIONPOSAUDIO WHERE TRANSACT = ?`,
        [data.Transact],
      );

      if ((existing as { TRANSACT: number }[]).length > 0) {
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET STATUS = ? WHERE TRANSACT = ?`,
          [data.Status, data.Transact],
        );
      } else {
        await connection.query(
          `INSERT INTO DBA.TRANSACTIONPOSAUDIO(TRANSACT,STATUS,PHONENUMBER,DATEOUT,DATERETURN) VALUES (?, ?, ?, GETDATE(), GETDATE())`,
          [data.Transact, data.Status, data.PhoneNumber] as (
            | string
            | number
            | null
          )[] as (string | number)[],
        );
      }

      if (data.Status === 2) {
        await connection.query(
          `UPDATE DBA.TRANSACTIONPOSAUDIO SET DATERETURN = GETDATE() WHERE TRANSACT = ?`,
          [data.Transact],
        );
      }

      const productCountdownChanges = new Map<number, number>();
      const posAudioStorageChanges = new Map<number, number>();
      const detailOutQueries: { sql: string; params: (string | number)[] }[] =
        [];
      const detailRetQueries: { sql: string; params: (string | number)[] }[] =
        [];

      if (
        data.TransactionDetailPOSAudios &&
        data.TransactionDetailPOSAudios.length > 0
      ) {
        for (const detail of data.TransactionDetailPOSAudios) {
          const existingDetail = await connection.query(
            `SELECT * FROM DBA.TRANSACTIONDETAILPOSAUDIO WHERE TRANSACT = ? AND PRODNUM = ?`,
            [data.Transact, detail.PRODNUM],
          );

          const prodLinkResult = await connection.query(
            `SELECT PRODNUMLINK, QUANTITY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`,
            [detail.PRODNUM],
          );

          let linkNum = detail.PRODNUM;
          let linkQty = 1;

          if (
            prodLinkResult &&
            (prodLinkResult as { PRODNUMLINK: number; QUANTITY: number }[])
              .length > 0
          ) {
            const row = (
              prodLinkResult as { PRODNUMLINK: number; QUANTITY: number }[]
            )[0];
            linkNum = row.PRODNUMLINK || detail.PRODNUM;
            linkQty = row.QUANTITY || 1;
          }

          const totalOutQty = (detail.QuantityOut || 0) * linkQty;
          const totalRetQty = (detail.QuantityReturn || 0) * linkQty;
          const isUpdate =
            (existingDetail as { TRANSACT: number }[]).length > 0;

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

            // Deduct sub-machine inventory if it's a Combo
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

            // 1. Restore ticket
            productCountdownChanges.set(
              detail.PRODNUM,
              (productCountdownChanges.get(detail.PRODNUM) || 0) +
                detail.QuantityReturn,
            );
            // 2. Restore sub-machine if it's a combo
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
        // BULK EXECUTION: GENERATE A SINGLE SQL QUERY TO AVOID ODBC DEADLOCKS
        // ==============================================================

        // 1. UPDATE DBA.PRODUCT (Merge 2 IDs into 1 query)
        let productSql = "";
        if (productCountdownChanges.size > 0) {
          let caseStr = "";
          const ids: number[] = [];
          for (const [pNum, qty] of productCountdownChanges.entries()) {
            if (qty !== 0) {
              caseStr += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              ids.push(pNum);
            }
          }
          if (ids.length > 0) {
            productSql = `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + CASE ${caseStr} ELSE 0 END WHERE PRODNUM IN (${ids.join(",")})`;
            await connection.query(productSql);
          }
        }

        // 2. UPDATE DBA.ProductPOSAudio (Merge 2 IDs into 1 query)
        let posAudioSql = "";
        if (posAudioStorageChanges.size > 0) {
          let caseStrStorage = "";
          let caseStrOut = "";
          const ids: number[] = [];
          for (const [pNum, qty] of posAudioStorageChanges.entries()) {
            if (qty !== 0) {
              caseStrStorage += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              caseStrOut += ` WHEN PRODNUM = ${pNum} THEN ${qty}`;
              ids.push(pNum);
            }
          }
          if (ids.length > 0) {
            posAudioSql = `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE + CASE ${caseStrStorage} ELSE 0 END, OUT = OUT - CASE ${caseStrOut} ELSE 0 END WHERE PRODNUM IN (${ids.join(",")})`;
            await connection.query(posAudioSql);
          }
        }

        // 3. EXECUTE FINAL DETAIL TABLE
        const allDetails = [...detailOutQueries, ...detailRetQueries];
        for (const q of allDetails) {
          await connection.query(q.sql, q.params);
        }
      }

      await connection.commit();
    } catch (error: unknown) {
      if (connection) await connection.rollback();

      logger.error("Error during Create/Update Transaction POS Audio:", {
        error,
      });
      const err = error as Error & { odbcErrors?: { message: string }[] };
      let errMsg = err.message || err.toString();
      if (err.odbcErrors && err.odbcErrors.length > 0) {
        errMsg +=
          " | ODBC Details: " + err.odbcErrors.map((e) => e.message).join(", ");
      }
      throw new Error("DB Error: " + errMsg);
    } finally {
      if (connection) await connection.close();
    }
  }
}
