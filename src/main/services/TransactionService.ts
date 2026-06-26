import { getConnection } from "@/main/config/database";

export class TransactionService {
  static async getTransactionByTransact(transact: string): Promise<unknown> {
    let connection;
    try {
      connection = await getConnection();
      let searchTransact = transact;
      if (searchTransact.startsWith("696")) {
        searchTransact = searchTransact.substring(3);
      }

      const queryHeader = `
        SELECT TOP 1 
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 0 ELSE TPA.STATUS END AS POSAudioStatus,
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 'New' 
               ELSE CASE WHEN (TPA.STATUS = 1) THEN 'Out' ELSE 'Return' END 
          END AS POSAudioStatusName, 
          E.EMPNAME AS EMPNAME,
          PH.* 
        FROM DBA.POSHEADER PH 
        LEFT JOIN DBA.TransactionPOSAudio TPA ON PH.TRANSACT = TPA.TRANSACT 
        INNER JOIN DBA.EMPLOYEE E ON PH.WHOCLOSE = E.EMPNUM 
        WHERE (PH.TRANSACT = ? OR TPA.PHONENUMBER = ?) 
          AND PH.STATUS = 3 
        ORDER BY PH.TIMEEND DESC
      `;
      const headerResult = await connection.query(queryHeader, [
        searchTransact,
        searchTransact,
      ]);

      if (headerResult.length > 0) {
        const posHeader = headerResult[0];

        const queryDetail = `
          SELECT P.DESCRIPT AS DESCRIPT, PD.* 
          FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PRODUCT P ON PD.PRODNUM = P.PRODNUM 
          WHERE PD.TRANSACT = ? AND PD.PRODTYPE not in (100,101) 
          UNION ALL 
          SELECT P.DESCRIPT AS DESCRIPT, PD.* 
          FROM DBA.POSDETAIL PD 
          INNER JOIN DBA.PROMO P ON PD.PRODNUM = P.PROMONUM 
          WHERE PD.TRANSACT = ? AND PD.PRODTYPE not in (100)
        `;
        const detailResult = await connection.query(queryDetail, [
          posHeader.TRANSACT,
          posHeader.TRANSACT,
        ]);

        posHeader.POSDETAILS = detailResult;
        return JSON.parse(JSON.stringify(posHeader));
      }

      return null;
    } catch (error) {
      console.error("Lỗi khi lấy thông tin Transaction By Transact:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  static async getTransaction(): Promise<unknown[]> {
    let connection;
    try {
      connection = await getConnection();
      const query = `
        SELECT 
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 0 ELSE TPA.STATUS END AS POSAudioStatus,
          CASE WHEN (TPA.TRANSACT IS NULL) THEN 'New' 
               ELSE CASE WHEN (TPA.STATUS = 1) THEN 'Out' ELSE 'Return' END 
          END AS POSAudioStatusName, 
          PH.* 
        FROM DBA.POSHEADER PH 
        LEFT JOIN DBA.TransactionPOSAudio TPA ON PH.TRANSACT = TPA.TRANSACT
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
      const result = await connection.query(query);
      return JSON.parse(JSON.stringify(result)) as unknown[];
    } catch (error) {
      console.error("Lỗi khi lấy thông tin Transaction list:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
