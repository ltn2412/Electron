import { getConnection } from "@/main/config/database";
import logger from "@/main/utils/logger";
import type { Connection } from "odbc";

interface EmpResult {
  EmpNum: number;
  PunchIndex: number;
}

interface ProdResult {
  ProdNum: number;
  ProdType: number;
  CountDown: number;
  Descript: string;
  PrepTemp: number;
  PrintLoc: number;
  Tax1: number;
  Tax2: number;
  Tax3: number;
  Tax4: number;
  Tax5: number;
}

interface StationResult {
  QuickOrderTable: number;
  SaleTypeIndex: number;
  RevCenter: number;
}

interface OpenDateResult {
  OpenDate: string | Date;
}

interface SysInfoResult {
  TaxRate1: number;
  TaxRate2: number;
  TaxRate3: number;
  TaxRate4: number;
  TaxRate5: number;
  UseVAT: number;
}

interface NextNumResult {
  NEXTNUM: number;
}

interface RecPosResult {
  RECPOS: number;
}

export class OrderService {
  public static async deleteOrder(
    transact: number,
  ): Promise<{ success: boolean; error?: string }> {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      // 1. Revert TillBalance
      const headerSql = `SELECT FINALTOTAL, PUNCHINDEX FROM DBA.POSHEADER WHERE TRANSACT = ?`;
      const headerResult = await connection.query(headerSql, [transact]);
      if (headerResult && (headerResult as any).length > 0) {
        const header = (headerResult as any)[0];
        if (header.PUNCHINDEX > 0) {
          await connection.query(
            `UPDATE DBA.PUNCHCLOCK SET TillBalance = ISNULL(TillBalance, 0) - ? WHERE Punchindex = ?`,
            [header.FINALTOTAL, header.PUNCHINDEX],
          );
        }
      }

      // 2. Revert PRODUCT COUNTDOWN and STORAGE/OUT
      const tdSql = `SELECT PRODNUM, QuantityOut FROM DBA.TransactionDetailPOSAudio WHERE Transact = ?`;
      const tdResult = await connection.query(tdSql, [transact]);
      for (const td of tdResult as any) {
        if (td.QuantityOut > 0) {
          const prodLinkQuery = `SELECT PRODNUMLINK, ISPRIMARY, QUANTITY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`;
          const prodLinkResult = await connection.query(prodLinkQuery, [
            td.PRODNUM,
          ]);
          if (prodLinkResult && (prodLinkResult as any).length > 0) {
            const row = (prodLinkResult as any)[0];
            const linkNum = row.PRODNUMLINK || td.PRODNUM;
            const isPrimary = row.ISPRIMARY;
            const linkQty = row.QUANTITY || 1;
            const outQty = td.QuantityOut * linkQty;

            if (isPrimary === 1) {
              await connection.query(
                `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + ? WHERE PRODNUM = ?`,
                [outQty, linkNum],
              );
            }
            await connection.query(
              `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE + ?, OUT = OUT - ? WHERE PRODNUM = ?`,
              [outQty, outQty, linkNum],
            );
          }
        }
      }

      // 3. Mark as Void instead of deleting
      await connection.query(
        `UPDATE DBA.POSHEADER SET NETTOTAL=0, FINALTOTAL=0 WHERE TRANSACT=?`,
        [transact],
      );
      await connection.query(
        `UPDATE DBA.POSDETAIL SET PRODTYPE=101 WHERE TRANSACT=?`,
        [transact],
      );
      await connection.query(
        `UPDATE DBA.Howpaid SET TENDER=0 WHERE TRANSACT=?`,
        [transact],
      );
      await connection.query(
        `UPDATE DBA.XMLTransHeaders SET SyncCloud=1, NetTotal=0, FinalTotal=0 WHERE TransNumber=?`,
        [transact],
      );
      await connection.query(
        `UPDATE DBA.XMLTransItems SET SyncCloud=1, TypeOfProd=101 WHERE TransNumber=?`,
        [transact],
      );

      await connection.commit();
      return { success: true };
    } catch (error: any) {
      await connection.rollback();
      const errMsg =
        error.message +
        (error.odbcErrors
          ? " | ODBC Details: " + JSON.stringify(error.odbcErrors)
          : "");
      return { success: false, error: errMsg || JSON.stringify(error) };
    } finally {
      await connection.close();
    }
  }

  public static async createOrder(
    refCode: string,
    quantity: number,
    costEach: number,
    swipe: string,
    status: number = 1,
    onlineOrderId?: string,
  ): Promise<{
    success: boolean;
    transact?: number;
    message?: string;
    error?: string;
  }> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const STATNUM = 1;

      const empResult = await connection.query(
        `SELECT EmpNum, ISNULL(PunchIndex, 0) as PunchIndex FROM dba.employee WHERE SWIPE = ? AND IsActive = 1`,
        [swipe],
      );
      if (empResult.length === 0)
        throw new Error(`Employee not found for swipe: ${swipe}`);

      const empRow = (empResult as unknown as EmpResult[])[0];
      const WHOSTART = empRow.EmpNum;
      const PUNCHINDEX = empRow.PunchIndex;

      const prodResult = await connection.query(
        `
        SELECT Product.ProdNum, Product.ProdType, Product.CountDown, Product.Descript, ISNULL(Product.PrepTemp, 0) AS PrepTemp,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.PRINTLOC ELSE PRODUCT.PRINTLOC END) AS PrintLoc,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX1 ELSE PRODUCT.TAX1 END) AS Tax1,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX2 ELSE PRODUCT.TAX2 END) AS Tax2,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX3 ELSE PRODUCT.TAX3 END) AS Tax3,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX4 ELSE PRODUCT.TAX4 END) AS Tax4,
               (CASE WHEN Product.USEITEMCAT = 1 THEN ReportCat.TAX5 ELSE PRODUCT.TAX5 END) AS Tax5
        FROM dba.Product
        LEFT JOIN dba.ReportCat ON (Product.ReportNo = ReportCat.ReportNo)
        WHERE Product.IsActive = 1 AND Product.RefCode = ?
      `,
        [refCode],
      );
      if (prodResult.length === 0)
        throw new Error(`Product not found for refCode: ${refCode}`);

      const product = (prodResult as unknown as ProdResult[])[0];
      const PRODNUM = product.ProdNum;
      const LineDes = product.Descript;

      const stationResult = await connection.query(
        `
        SELECT QuickOrderTable, MAX(SaleTypeIndex) as SaleTypeIndex, MAX(RevCenter) as RevCenter
        FROM dba.StationInfo WHERE StatNum = ? AND IsActive = 1 GROUP BY QuickOrderTable
      `,
        [STATNUM],
      );
      if (stationResult.length === 0)
        throw new Error(`Station not found for StatNum: ${STATNUM}`);

      const stationRow = (stationResult as unknown as StationResult[])[0];
      const TABLENUM = stationRow.QuickOrderTable || 0;
      const SALETYPEINDEX = stationRow.SaleTypeIndex || 0;
      const REVCENTER = stationRow.RevCenter || 0;

      const openDateResult = await connection.query(
        `SELECT OpenDate FROM dba.CurrentOpenDay WHERE CurDayStatus = 1`,
      );
      if (openDateResult.length === 0) throw new Error("No open day found");

      const OPENDATE = (openDateResult as OpenDateResult[])[0].OpenDate;

      const sysInfoResult = await connection.query(`
        SELECT ISNULL(TAXRATE1, 0) AS TaxRate1, ISNULL(TAXRATE2, 0) AS TaxRate2, 
               ISNULL(TAXRATE3, 0) AS TaxRate3, ISNULL(TAXRATE4, 0) AS TaxRate4, 
               ISNULL(TAXRATE5, 0) AS TaxRate5, UseVAT
        FROM dba.SysInfo
      `);
      const sysInfo = (sysInfoResult as unknown as SysInfoResult[])[0];

      let tax1 = 0,
        tax2 = 0,
        tax3 = 0,
        tax4 = 0,
        tax5 = 0;
      const useVat = sysInfo.UseVAT === 1;

      const calcTax = (
        rate: number,
        amount: number,
        hasTax: boolean,
      ): number => {
        if (!hasTax || rate === 0) return 0;
        if (useVat) {
          return amount - amount / (1 + rate / 100);
        } else {
          return amount * (rate / 100);
        }
      };

      const finalTotalAmount = costEach * quantity;
      let netTotalAmount = finalTotalAmount;

      const t1 = calcTax(
        sysInfo.TaxRate1,
        finalTotalAmount,
        product.Tax1 === 1,
      );
      const t2 = calcTax(
        sysInfo.TaxRate2,
        finalTotalAmount,
        product.Tax2 === 1,
      );
      const t3 = calcTax(
        sysInfo.TaxRate3,
        finalTotalAmount,
        product.Tax3 === 1,
      );
      const t4 = calcTax(
        sysInfo.TaxRate4,
        finalTotalAmount,
        product.Tax4 === 1,
      );
      const t5 = calcTax(
        sysInfo.TaxRate5,
        finalTotalAmount,
        product.Tax5 === 1,
      );

      if (useVat) netTotalAmount = finalTotalAmount - (t1 + t2 + t3 + t4 + t5);
      else netTotalAmount = finalTotalAmount;

      tax1 = t1;
      tax2 = t2;
      tax3 = t3;
      tax4 = t4;
      tax5 = t5;
      const FINALTOTAL = useVat
        ? finalTotalAmount
        : netTotalAmount + tax1 + tax2 + tax3 + tax4 + tax5;
      const NETTOTAL = netTotalAmount;

      const nextHeaderRes = await connection.query(
        `SELECT MAX(NEXTNUM) as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_POSHEADER'`,
      );
      const TRANSACT =
        (nextHeaderRes as unknown as NextNumResult[])[0].NEXTNUM + 1;

      const posHeaderSql = `
        INSERT INTO DBA.POSHEADER (
          TRANSACT, TABLENUM, TIMESTART, TIMEEND, NUMCUST,
          TAX1, TAX2, TAX3, TAX4, TAX5,
          TAX1ABLE, TAX2ABLE, TAX3ABLE, TAX4ABLE, TAX5ABLE,
          NETTOTAL, WHOSTART, WHOCLOSE, ISSPLIT, SALETYPEINDEX,
          EXP, WAITINGAUTH, STATNUM, STATUS, FINALTOTAL, StoreNum,
          PUNCHINDEX, Gratuity, OPENDATE, MemCode, TotalPoints, PointsApplied,
          UpdateStatus, ISDelivery, ScheduleDate, Tax1Exempt, Tax2Exempt,
          Tax3Exempt, Tax4Exempt, Tax5Exempt, MEMRATE, MealTime,
          IsInternet, RevCenter, PunchIdxStart, StatNumStart, SecNum,
          GratAmount, ShipTo, EnforcedGrat, NumPrintedFinal, RefId,
          RstOrdNum
        ) VALUES (
          ?, ?, GETDATE(), GETDATE(), 1,
          ?, ?, ?, ?, ?,
          0, 0, 0, 0, 0,
          ?, ?, ?, 1, ?,
          1, NULL, ?, ?, ?, NULL,
          ?, 0, ?, 0, 0, 0,
          1, 1, '1899-12-30 00:00:00.000', 0, 0,
          0, 0, 0, 0, 1,
          0, ?, ?, ?, 0,
          0, 0, 0, 1, ?, NULL
        )
      `;
      const posHeaderParams = [
        TRANSACT,
        TABLENUM,
        tax1,
        tax2,
        tax3,
        tax4,
        tax5,
        NETTOTAL,
        WHOSTART,
        WHOSTART,
        SALETYPEINDEX,
        STATNUM,
        3,
        FINALTOTAL,
        PUNCHINDEX,
        OPENDATE,
        REVCENTER,
        PUNCHINDEX,
        STATNUM,
        refCode,
      ] as (string | number)[];
      logger.info("Executed Database Query", {
        query: posHeaderSql,
        params: posHeaderParams,
      });
      await connection.query(posHeaderSql, posHeaderParams);

      await connection.query(
        `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = ? WHERE INCNAME = 'GETNEXT_POSHEADER'`,
        [TRANSACT],
      );

      const nextDetailRes = await connection.query(
        `SELECT MAX(NEXTNUM) as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_POSDETAIL'`,
      );
      const UNIQUEID =
        (nextDetailRes as unknown as NextNumResult[])[0].NEXTNUM + 1;

      await connection.query(
        `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = ? WHERE INCNAME = 'GETNEXT_POSDETAIL'`,
        [UNIQUEID],
      );

      const recPosRes = await connection.query(
        `SELECT ISNULL(MAX(RECPOS), -1) as RECPOS FROM DBA.POSDETAIL WHERE TRANSACT = ?`,
        [TRANSACT],
      );
      const RECPOS = (recPosRes as unknown as RecPosResult[])[0].RECPOS + 1;

      const posDetailSql = `
        INSERT INTO DBA.POSDETAIL (
          UNIQUEID, TRANSACT, PRODNUM, WHOORDER, WHOAUTH, COSTEACH, QUAN, TIMEORD, PRINTLOC, SEATNUM, Minutes, NOTAX, HOWORDERED, STATUS, NEXTPOS, PRIORPOS, RECPOS, PRODTYPE, ApplyTax1, Applytax2, Applytax3, Applytax4, Applytax5, ReduceInventory, StoreNum, STATNUM, RecipeCostEach, OpenDate, MealTime, LineDes, REVCENTER, MasterItem, QuestionId, OrigCostEach, NetCostEach, Discount, UpdateStatus, GratExempt, AuthCode
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, GETDATE(), ?, 0, 0, 0, 32, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 1, ?, ?, ?, 0, ?, ?, NULL, 1, 0, GETDATE()
        )
      `;
      const posDetailParams = [
        UNIQUEID,
        TRANSACT,
        PRODNUM,
        WHOSTART,
        WHOSTART,
        costEach,
        quantity,
        product.PrintLoc,
        RECPOS,
        product.ProdType,
        product.Tax1,
        product.Tax2,
        product.Tax3,
        product.Tax4,
        product.Tax5,
        status === 3 ? 0 : 1,
        STATNUM,
        OPENDATE,
        LineDes,
        REVCENTER,
        UNIQUEID,
        costEach,
        useVat ? netTotalAmount / quantity : costEach,
      ] as (string | number)[];
      logger.info("Executed Database Query", {
        query: posDetailSql,
        params: posDetailParams,
      });
      await connection.query(posDetailSql, posDetailParams);

      if (status === 1) {
        const sql = `
          INSERT INTO DBA.TransactionPOSAudio (Transact, PhoneNumber, Status, DateOut, DateReturn, OnlineOrderTransaction)
          VALUES (?, '', ?, GETDATE(), NULL, ?)
        `;
        logger.info("Executed Database Query", {
          query: sql,
          params: [TRANSACT, status, onlineOrderId || null] as (
            | string
            | number
            | null
          )[],
        });
        await connection.query(sql, [
          TRANSACT,
          status,
          onlineOrderId || null,
        ] as (string | number | null)[] as (string | number)[]);
      } else {
        const sql = `
          INSERT INTO DBA.TransactionPOSAudio (Transact, PhoneNumber, Status, DateOut, DateReturn, OnlineOrderTransaction)
          VALUES (?, '', ?, NULL, GETDATE(), ?)
        `;
        logger.info("Executed Database Query", {
          query: sql,
          params: [TRANSACT, status, onlineOrderId || null] as (
            | string
            | number
            | null
          )[],
        });
        await connection.query(sql, [
          TRANSACT,
          status,
          onlineOrderId || null,
        ] as (string | number | null)[] as (string | number)[]);
      }

      const tdSql = `
        INSERT INTO DBA.TransactionDetailPOSAudio (Transact, PRODNUM, QuantityOut, QuantityReturn)
        VALUES (?, ?, ?, ?)
      `;
      const tdParams = [
        TRANSACT,
        PRODNUM,
        quantity,
        status === 2 || status === 3 ? quantity : 0,
      ];
      logger.info("Executed Database Query", {
        query: tdSql,
        params: tdParams,
      });
      await connection.query(tdSql, tdParams);

      if (status === 1) {
        const prodLinkQuery = `SELECT PRODNUMLINK, QUANTITY, ISPRIMARY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`;
        const prodLinkResult = await connection.query(prodLinkQuery, [PRODNUM]);
        let linkNum = PRODNUM;
        let linkQty = 1;
        let isPrimary = 1;
        if (prodLinkResult && (prodLinkResult as unknown[]).length > 0) {
          const row = (
            prodLinkResult as {
              PRODNUMLINK: number;
              QUANTITY?: number;
              ISPRIMARY: number;
            }[]
          )[0];
          linkNum = row.PRODNUMLINK;
          linkQty = row.QUANTITY || 1;
          isPrimary = row.ISPRIMARY;
        }

        const outQty = quantity * linkQty;

        if (isPrimary === 1) {
          const updateProductSql = `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN - ? WHERE PRODNUM = ?`;
          logger.info("Executed Database Query", {
            query: updateProductSql,
            params: [outQty, linkNum],
          });
          await connection.query(updateProductSql, [outQty, linkNum]);
        }

        const updateStorageSql = `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE - ?, OUT = OUT + ? WHERE PRODNUM = ?`;
        logger.info("Executed Database Query", {
          query: updateStorageSql,
          params: [outQty, outQty, linkNum],
        });
        await connection.query(updateStorageSql, [outQty, outQty, linkNum]);
      }

      const methodRes = await connection.query(
        `SELECT METHODNUM FROM DBA.MethodPay WHERE ISACTIVE = 1 AND SwipeStarts like '%HOANGVAN%'`,
      );
      if (methodRes.length === 0)
        throw new Error("No payment method found for HoangVan");
      const methodNum = (methodRes as { METHODNUM: number }[])[0].METHODNUM;

      const nextHowPaidRes = await connection.query(
        `SELECT MAX(NEXTNUM) as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_HowPaid'`,
      );
      const HowPaidLink =
        (nextHowPaidRes as unknown as NextNumResult[])[0].NEXTNUM + 1;

      await connection.query(
        `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = ? WHERE INCNAME = 'GETNEXT_HowPaid'`,
        [HowPaidLink],
      );

      const hpSql = `
        INSERT INTO DBA.Howpaid(
          HowPaidLink, TRANSDATE, EMPNUM, TENDER, METHODNUM, CHANGE,
          AUTHORIZED, AUTHCODE, MEMCODE, ExchangeRate, TRANSACT, PayType, OPENDATE,
          PUNCHINDEX, UpdateStatus, Settled, Status, Approved, STATNUM, IsPayInOut,
          PayReason, MealTime, RevCenter, Voided, VoidedLink, LCUDiff, EnforcedGrat,
          GratAmount, OrigMethodNum, CardType
        ) VALUES (
          ?, GETDATE(), ?, ?, ?, 0,
          199, '', 0, 1, ?, 101, ?,
          ?, 1, 1, 3, 1, ?, 0,
          '', 1, 999, 0, 0, 0, 0,
          0, ?, ''
        )
      `;
      const hpParams = [
        HowPaidLink,
        WHOSTART,
        FINALTOTAL,
        methodNum,
        TRANSACT,
        OPENDATE,
        PUNCHINDEX,
        STATNUM,
        methodNum,
      ] as (string | number)[];
      logger.info("Executed Database Query", {
        query: hpSql,
        params: hpParams,
      });
      await connection.query(hpSql, hpParams);

      if (PUNCHINDEX > 0) {
        const updateTillSql = `
          UPDATE DBA.PUNCHCLOCK 
          SET TillBalance = ISNULL(TillBalance, 0) + ? 
          WHERE Punchindex = ?
        `;
        logger.info("Executed Database Query", {
          query: updateTillSql,
          params: [FINALTOTAL, PUNCHINDEX],
        });
        await connection.query(updateTillSql, [FINALTOTAL, PUNCHINDEX]);
      }

      const updateNeedsCashoutSql = `UPDATE DBA.EMPLOYEE SET NEEDSCASHOUT = 1 WHERE EMPNUM = ?`;
      logger.info("Executed Database Query", {
        query: updateNeedsCashoutSql,
        params: [WHOSTART],
      });
      await connection.query(updateNeedsCashoutSql, [WHOSTART]);

      await connection.commit();

      return {
        success: true,
        transact: TRANSACT,
        message: "Order inserted successfully",
      };
    } catch (error: any) {
      if (connection) await connection.rollback();
      const errMsg =
        error.message +
        (error.odbcErrors
          ? " | ODBC Details: " + JSON.stringify(error.odbcErrors)
          : "");
      throw new Error("DB Error: " + (errMsg || JSON.stringify(error)));
    } finally {
      if (connection) await connection.close();
    }
  }

  public static async getOnlineOrderStatus(
    orderId: string,
  ): Promise<{ success: boolean; status?: number; error?: string }> {
    const connection = await getConnection();
    const sql = `
      SELECT TOP 1 Status 
      FROM DBA.TransactionPOSAudio 
      WHERE OnlineOrderTransaction = ? 
      ORDER BY Transact DESC
    `;
    const result = (await connection.query(sql, [orderId])) as {
      Status: number;
    }[];
    await connection.close();
    if (result && result.length > 0) {
      return { success: true, status: result[0].Status };
    }
    return { success: true, status: undefined };
  }

  public static async returnOnlineOrder(
    orderId: string,
  ): Promise<{ success: boolean; error?: string }> {
    let connection: Connection | undefined;
    try {
      connection = await getConnection();
      const sql = `
        SELECT TOP 1 Transact 
        FROM DBA.TransactionPOSAudio 
        WHERE OnlineOrderTransaction = ? AND Status = 1
        ORDER BY Transact DESC
      `;
      const result = (await connection.query(sql, [orderId])) as {
        Transact: number;
      }[];
      if (result && result.length > 0) {
        const transactId = result[0].Transact;
        const detailsSql = `SELECT PRODNUM, QuantityOut FROM DBA.TransactionDetailPOSAudio WHERE Transact = ?`;
        const details = (await connection.query(detailsSql, [transactId])) as {
          PRODNUM: number;
          QuantityOut: number;
        }[];

        await connection.close();

        const { TransactionPOSAudioService } =
          await import("@/main/services/TransactionPOSAudioService");
        await TransactionPOSAudioService.createUpdateTransaction({
          Transact: transactId,
          Status: 2,
          PhoneNumber: "",
          TransactionDetailPOSAudios: details.map((d) => ({
            PRODNUM: d.PRODNUM,
            QuantityOut: d.QuantityOut,
            QuantityReturn: d.QuantityOut,
          })),
        });
        return { success: true };
      }
      if (connection) await connection.close();
      throw new Error("Transaction not found or already returned.");
    } catch (error: any) {
      if (connection) await connection.close();
      const errMsg =
        error.message +
        (error.odbcErrors
          ? " | ODBC Details: " + JSON.stringify(error.odbcErrors)
          : "");
      throw new Error("DB Error: " + (errMsg || JSON.stringify(error)));
    }
  }
}
