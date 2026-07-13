import { getConnection } from "@/main/config/database";
import type { Connection } from "odbc";

export interface TransactionDetail {
  DESCRIPT: string;
  REFCODE: string;
  TRANSACT: number;
  PRODNUM: number;
  COSTEACH: number;
  QUAN: number;
  [key: string]: string | number | null;
}

export interface TransactionHeader {
  POSAudioStatus: number;
  POSAudioStatusName: string;
  EMPNAME?: string;
  FILTERED_TOTAL?: number;
  TRANSACT: number;
  TIMEEND: string;
  FINALTOTAL: number;
  POSDETAILS?: TransactionDetail[];
  [key: string]: string | number | null | TransactionDetail[] | undefined;
}

export class TransactionService {
  static async getTransactionByTransact(
    transact: string,
  ): Promise<TransactionHeader | null> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      let searchTransact = transact;
      if (searchTransact.startsWith("696"))
        searchTransact = searchTransact.substring(3);

      const queryHeader = `
        SELECT TOP 1 
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 0 ELSE TPA.STATUS END AS POSAudioStatus,
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 'New' 
               ELSE CASE WHEN (TPA.STATUS = 1) THEN 'Out' 
                         WHEN (TPA.STATUS = 3) THEN 'Expired' 
                         ELSE 'Return' END 
          END AS POSAudioStatusName, 
          E.EMPNAME AS EMPNAME,
          PH.* FROM DBA.POSHEADER PH 
        LEFT JOIN DBA.TransactionPOSAudio TPA ON PH.TRANSACT = TPA.TRANSACT 
        INNER JOIN DBA.EMPLOYEE E ON PH.WHOCLOSE = E.EMPNUM 
        WHERE (PH.TRANSACT = ? OR TPA.PHONENUMBER = ?) 
          AND PH.STATUS = 3 
        ORDER BY PH.TIMEEND DESC
      `;
      const headerResult = (await connection.query(queryHeader, [
        searchTransact,
        searchTransact,
      ])) as TransactionHeader[];

      if (headerResult.length > 0) {
        const posHeader = headerResult[0];

        const queryDetail = `
          SELECT P.DESCRIPT AS DESCRIPT, POAP.REFCODE AS REFCODE, PD.* FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PRODUCT P ON PD.PRODNUM = P.PRODNUM 
          LEFT JOIN DBA.ProductPOSAudio POAP ON PD.PRODNUM = POAP.PRODNUM
          WHERE PD.TRANSACT = ? AND PD.PRODTYPE not in (100,101) 
          UNION ALL 
          SELECT P.DESCRIPT AS DESCRIPT, POAP.REFCODE AS REFCODE, PD.* FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PROMO P ON PD.PRODNUM = P.PROMONUM 
          LEFT JOIN DBA.ProductPOSAudio POAP ON PD.PRODNUM = POAP.PRODNUM
          WHERE PD.TRANSACT = ? AND PD.PRODTYPE not in (100)
        `;
        const detailResult = (await connection.query(queryDetail, [
          posHeader.TRANSACT,
          posHeader.TRANSACT,
        ])) as TransactionDetail[];

        posHeader.POSDETAILS = detailResult;

        await connection.commit();

        return JSON.parse(JSON.stringify(posHeader)) as TransactionHeader;
      }

      await connection.commit();
      return null;
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  static async getTransaction(): Promise<TransactionHeader[]> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      const query = `
        SELECT 
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 0 ELSE TPA.STATUS END AS POSAudioStatus,
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 'New' 
               ELSE CASE WHEN (TPA.STATUS = 1) THEN 'Out' 
                         WHEN (TPA.STATUS = 3) THEN 'Expired'
                         ELSE 'Return' END 
          END AS POSAudioStatusName, 
          ISNULL(AudioSum.Total, 0) AS FILTERED_TOTAL,
          PH.* 
        FROM DBA.POSHEADER PH 
        LEFT JOIN DBA.TransactionPOSAudio TPA ON PH.TRANSACT = TPA.TRANSACT
        LEFT JOIN (
            SELECT PD2.TRANSACT, SUM(PD2.QUAN * PD2.COSTEACH) AS Total
            FROM DBA.POSDETAIL PD2
            INNER JOIN DBA.PRODUCT P2 ON PD2.PRODNUM = P2.PRODNUM
            WHERE P2.REFCODE like '%_F:POS_AUDIO%'
            GROUP BY PD2.TRANSACT
        ) AudioSum ON PH.TRANSACT = AudioSum.TRANSACT
        WHERE PH.TRANSACT IN (
          SELECT PD.TRANSACT 
          FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PRODUCT P ON PD.PRODNUM = P.PRODNUM 
            AND PD.OPENDATE = (select OPENDATE from dba.CurrentOpenDay) 
          WHERE PD.PRODTYPE NOT IN (100,101) 
            AND P.REFCODE like '%_F:POS_AUDIO%' 
          GROUP BY PD.TRANSACT
        ) 
        AND PH.STATUS = 3 
        AND PH.FINALTOTAL > 0 
        ORDER BY PH.TIMEEND DESC
      `;
      const result = (await connection.query(query)) as TransactionHeader[];

      await connection.commit();

      return JSON.parse(JSON.stringify(result)) as TransactionHeader[];
    } catch (error) {
      if (connection) await connection.rollback();

      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }
}
