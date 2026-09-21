import { getConnection } from "@/main/config/database";
import { skipSelfCountdownSql } from "@/main/config/schema";
import { hvLogger } from "@/main/utils/logger";
import { OrderItemPayload } from "@/shared/types";
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
  /**
   * How a product draws on stock: a combo (or a product mapped onto another
   * one, like an unlimited foreign-language ticket) spends `linkQty` units of
   * `linkNum` instead of its own.
   */
  private static async getStockLink(
    connection: Connection,
    prodnum: number,
  ): Promise<{
    linkNum: number;
    linkQty: number;
    isPrimary: number;
    skipSelfCountdown: boolean;
  }> {
    const rows = (await connection.query(
      `SELECT PRODNUMLINK, ISPRIMARY, QUANTITY, ${skipSelfCountdownSql()} AS SKIPSELFCOUNTDOWN
       FROM DBA.ProductPOSAudio WHERE PRODNUM = ?`,
      [prodnum],
    )) as {
      PRODNUMLINK: number | null;
      ISPRIMARY: number;
      QUANTITY: number | null;
      SKIPSELFCOUNTDOWN: number;
    }[];

    if (!rows || rows.length === 0)
      return {
        linkNum: prodnum,
        linkQty: 1,
        isPrimary: 1,
        skipSelfCountdown: false,
      };

    const row = rows[0];
    return {
      linkNum: row.PRODNUMLINK || prodnum,
      linkQty: row.QUANTITY || 1,
      isPrimary: row.ISPRIMARY,
      skipSelfCountdown: row.SKIPSELFCOUNTDOWN === 1,
    };
  }

  /** Positive deltas give stock back, negative ones take it out. */
  private static async applyStockChanges(
    connection: Connection,
    countdownChanges: Map<number, number>,
    storageChanges: Map<number, number>,
  ): Promise<void> {
    for (const [prodnum, delta] of countdownChanges.entries()) {
      if (delta === 0) continue;
      const sql = `UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + ? WHERE PRODNUM = ?`;
      hvLogger.info("Executed Database Query", {
        query: sql,
        params: [delta, prodnum],
      });
      await connection.query(sql, [delta, prodnum]);
    }

    for (const [prodnum, delta] of storageChanges.entries()) {
      if (delta === 0) continue;
      const sql = `UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE + ?, OUT = OUT - ? WHERE PRODNUM = ?`;
      hvLogger.info("Executed Database Query", {
        query: sql,
        params: [delta, delta, prodnum],
      });
      await connection.query(sql, [delta, delta, prodnum]);
    }
  }

  public static async deleteOrder(
    transact: number,
  ): Promise<{ success: boolean; error?: string }> {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      // Get transaction status to check if it's an Expired order (Status = 3)
      const statusSql = `SELECT Status FROM DBA.TransactionPOSAudio WHERE Transact = ?`;
      const statusResult = await connection.query(statusSql, [transact]);
      let isExpired = false;
      if (statusResult && (statusResult as any).length > 0) {
        if ((statusResult as any)[0].Status === 3) {
          isExpired = true;
        }
      }

      // 2. Revert PRODUCT COUNTDOWN and STORAGE/OUT
      if (!isExpired) {
        const tdSql = `SELECT PRODNUM, QuantityOut FROM DBA.TransactionDetailPOSAudio WHERE Transact = ?`;
        const tdResult = (await connection.query(tdSql, [transact])) as {
          PRODNUM: number;
          QuantityOut: number;
        }[];

        // Mirror of what createOrder took out, so a rolled back bill leaves
        // the stock exactly where it was.
        const countdownChanges = new Map<number, number>();
        const storageChanges = new Map<number, number>();

        for (const td of tdResult) {
          if (td.QuantityOut > 0) {
            const { linkNum, linkQty, skipSelfCountdown } =
              await OrderService.getStockLink(connection, td.PRODNUM);
            const outQty = td.QuantityOut * linkQty;

            const countdownRow = (await connection.query(
              `SELECT ISNULL(COUNTDOWN, 0) AS COUNTDOWN FROM DBA.PRODUCT WHERE PRODNUM = ?`,
              [td.PRODNUM],
            )) as { COUNTDOWN: number }[];
            const isUnlimited =
              skipSelfCountdown ||
              (countdownRow.length > 0 && countdownRow[0].COUNTDOWN === 0);

            if (!isUnlimited) {
              countdownChanges.set(
                td.PRODNUM,
                (countdownChanges.get(td.PRODNUM) || 0) + td.QuantityOut,
              );
            }
            if (linkNum !== td.PRODNUM) {
              countdownChanges.set(
                linkNum,
                (countdownChanges.get(linkNum) || 0) + outQty,
              );
            }
            storageChanges.set(
              linkNum,
              (storageChanges.get(linkNum) || 0) + outQty,
            );
          }
        }

        await OrderService.applyStockChanges(
          connection,
          countdownChanges,
          storageChanges,
        );
      }

      // 3. Mark as Void instead of deleting
      const q1 = `UPDATE DBA.POSHEADER SET NETTOTAL=0, FINALTOTAL=0 WHERE TRANSACT=?`;
      hvLogger.info("Executed Database Query", {
        query: q1,
        params: [transact],
      });
      await connection.query(q1, [transact]);

      const q2 = `UPDATE DBA.POSDETAIL SET PRODTYPE=101 WHERE TRANSACT=?`;
      hvLogger.info("Executed Database Query", {
        query: q2,
        params: [transact],
      });
      await connection.query(q2, [transact]);

      const q3 = `UPDATE DBA.Howpaid SET TENDER=0 WHERE TRANSACT=?`;
      hvLogger.info("Executed Database Query", {
        query: q3,
        params: [transact],
      });
      await connection.query(q3, [transact]);

      const q4 = `UPDATE DBA.XMLTransHeaders SET SyncCloud=1, NetTotal=0, FinalTotal=0 WHERE TransNumber=?`;
      hvLogger.info("Executed Database Query", {
        query: q4,
        params: [transact],
      });
      await connection.query(q4, [transact]);

      const q5 = `UPDATE DBA.XMLTransItems SET SyncCloud=1, TypeOfProd=101 WHERE TransNumber=?`;
      hvLogger.info("Executed Database Query", {
        query: q5,
        params: [transact],
      });
      await connection.query(q5, [transact]);

      await connection.commit();
      return { success: true };
    } catch (error: any) {
      await connection.rollback();
      const errMsg =
        error.message +
        (error.odbcErrors
          ? " | ODBC Details: " + JSON.stringify(error.odbcErrors)
          : "");
      hvLogger.error(`Rollback failed for ${transact}: ${errMsg}`);
      return { success: false, error: errMsg || JSON.stringify(error) };
    } finally {
      await connection.close();
    }
  }

  public static async createOrder(
    items: OrderItemPayload[],
    swipe: string,
    status: number = 1,
    onlineOrderId?: string,
  ): Promise<{
    success: boolean;
    transact?: number;
    message?: string;
    error?: string;
  }> {
    if (!items || items.length === 0)
      throw new Error("The order has no service to bill.");

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

      // One order can carry several services (audio guide + group combo...):
      // they all belong on the same bill, one POSDETAIL line each.
      const lines: {
        prodnum: number;
        quantity: number;
        costEach: number;
        product: ProdResult;
        lineDes: string;
      }[] = [];

      for (const item of items) {
        const quantity = Number(item.quantity) || 0;
        if (quantity <= 0)
          throw new Error(`Invalid quantity for refCode: ${item.refCode}`);

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
          [item.refCode],
        );
        if (prodResult.length === 0)
          throw new Error(`Product not found for refCode: ${item.refCode}`);

        const product = (prodResult as unknown as ProdResult[])[0];
        lines.push({
          prodnum: product.ProdNum,
          quantity,
          costEach: Number(item.costEach) || 0,
          product,
          lineDes: product.Descript,
        });
      }

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

      // Tax is worked out per line - two services can sit in different tax
      // categories - then summed onto the header.
      const lineNets: number[] = [];
      let finalTotalAmount = 0;
      let netTotalAmount = 0;

      lines.forEach((line) => {
        const lineTotal = line.costEach * line.quantity;

        const t1 = calcTax(
          sysInfo.TaxRate1,
          lineTotal,
          line.product.Tax1 === 1,
        );
        const t2 = calcTax(
          sysInfo.TaxRate2,
          lineTotal,
          line.product.Tax2 === 1,
        );
        const t3 = calcTax(
          sysInfo.TaxRate3,
          lineTotal,
          line.product.Tax3 === 1,
        );
        const t4 = calcTax(
          sysInfo.TaxRate4,
          lineTotal,
          line.product.Tax4 === 1,
        );
        const t5 = calcTax(
          sysInfo.TaxRate5,
          lineTotal,
          line.product.Tax5 === 1,
        );

        tax1 += t1;
        tax2 += t2;
        tax3 += t3;
        tax4 += t4;
        tax5 += t5;

        const lineNet = useVat
          ? lineTotal - (t1 + t2 + t3 + t4 + t5)
          : lineTotal;
        lineNets.push(lineNet);
        finalTotalAmount += lineTotal;
        netTotalAmount += lineNet;
      });

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
        items[0].refCode,
      ] as (string | number)[];
      hvLogger.info("Executed Database Query", {
        query: posHeaderSql,
        params: posHeaderParams,
      });
      await connection.query(posHeaderSql, posHeaderParams);

      await connection.query(
        `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = ? WHERE INCNAME = 'GETNEXT_POSHEADER'`,
        [TRANSACT],
      );

      // One id per line, taken in a single block so the counter is only
      // touched once.
      const nextDetailRes = await connection.query(
        `SELECT MAX(NEXTNUM) as NEXTNUM FROM DBA.AUTOINCINDEX WITH (XLOCK) WHERE INCNAME = 'GETNEXT_POSDETAIL'`,
      );
      const firstUniqueId =
        (nextDetailRes as unknown as NextNumResult[])[0].NEXTNUM + 1;

      await connection.query(
        `UPDATE DBA.AUTOINCINDEX SET NEXTNUM = ? WHERE INCNAME = 'GETNEXT_POSDETAIL'`,
        [firstUniqueId + lines.length - 1],
      );

      const recPosRes = await connection.query(
        `SELECT ISNULL(MAX(RECPOS), -1) as RECPOS FROM DBA.POSDETAIL WHERE TRANSACT = ?`,
        [TRANSACT],
      );
      const firstRecPos =
        (recPosRes as unknown as RecPosResult[])[0].RECPOS + 1;

      const posDetailSql = `
        INSERT INTO DBA.POSDETAIL (
          UNIQUEID, TRANSACT, PRODNUM, WHOORDER, WHOAUTH, COSTEACH, QUAN, TIMEORD, PRINTLOC, SEATNUM, Minutes, NOTAX, HOWORDERED, STATUS, NEXTPOS, PRIORPOS, RECPOS, PRODTYPE, ApplyTax1, Applytax2, Applytax3, Applytax4, Applytax5, ReduceInventory, StoreNum, STATNUM, RecipeCostEach, OpenDate, MealTime, LineDes, REVCENTER, MasterItem, QuestionId, OrigCostEach, NetCostEach, Discount, UpdateStatus, GratExempt, AuthCode
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, GETDATE(), ?, 0, 0, 0, 32, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 1, ?, ?, ?, 0, ?, ?, NULL, 1, 0, GETDATE()
        )
      `;

      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const UNIQUEID = firstUniqueId + idx;
        const RECPOS = firstRecPos + idx;

        const posDetailParams = [
          UNIQUEID,
          TRANSACT,
          line.prodnum,
          WHOSTART,
          WHOSTART,
          line.costEach,
          line.quantity,
          line.product.PrintLoc,
          RECPOS,
          line.product.ProdType,
          line.product.Tax1,
          line.product.Tax2,
          line.product.Tax3,
          line.product.Tax4,
          line.product.Tax5,
          status === 3 ? 0 : 1,
          STATNUM,
          OPENDATE,
          line.lineDes,
          REVCENTER,
          UNIQUEID,
          line.costEach,
          useVat ? lineNets[idx] / line.quantity : line.costEach,
        ] as (string | number)[];
        hvLogger.info("Executed Database Query", {
          query: posDetailSql,
          params: posDetailParams,
        });
        await connection.query(posDetailSql, posDetailParams);
      }

      const tpaSql =
        status === 1
          ? `
          INSERT INTO DBA.TransactionPOSAudio (Transact, PhoneNumber, Status, DateOut, DateReturn, OnlineOrderTransaction)
          VALUES (?, '', ?, GETDATE(), NULL, ?)
        `
          : `
          INSERT INTO DBA.TransactionPOSAudio (Transact, PhoneNumber, Status, DateOut, DateReturn, OnlineOrderTransaction)
          VALUES (?, '', ?, NULL, GETDATE(), ?)
        `;
      hvLogger.info("Executed Database Query", {
        query: tpaSql,
        params: [TRANSACT, status, onlineOrderId || null] as (
          | string
          | number
          | null
        )[],
      });
      await connection.query(tpaSql, [
        TRANSACT,
        status,
        onlineOrderId || null,
      ] as (string | number | null)[] as (string | number)[]);

      // TransactionDetailPOSAudio holds one row per product, so two lines of
      // the same product are handed over as a single quantity.
      const quantityByProdnum = new Map<number, number>();
      const countdownByProdnum = new Map<number, number>();
      for (const line of lines) {
        quantityByProdnum.set(
          line.prodnum,
          (quantityByProdnum.get(line.prodnum) || 0) + line.quantity,
        );
        countdownByProdnum.set(line.prodnum, line.product.CountDown);
      }

      const tdSql = `
        INSERT INTO DBA.TransactionDetailPOSAudio (Transact, PRODNUM, QuantityOut, QuantityReturn)
        VALUES (?, ?, ?, ?)
      `;
      for (const [prodnum, quantity] of quantityByProdnum.entries()) {
        const tdParams = [
          TRANSACT,
          prodnum,
          quantity,
          status === 2 || status === 3 ? quantity : 0,
        ];
        hvLogger.info("Executed Database Query", {
          query: tdSql,
          params: tdParams,
        });
        await connection.query(tdSql, tdParams);
      }

      if (status === 1) {
        const countdownChanges = new Map<number, number>();
        const storageChanges = new Map<number, number>();

        for (const [prodnum, quantity] of quantityByProdnum.entries()) {
          const { linkNum, linkQty, skipSelfCountdown } =
            await OrderService.getStockLink(connection, prodnum);
          const outQty = quantity * linkQty;

          // This bill was written by us, not by the POS engine, so nothing has
          // deducted the product's own countdown yet - unless it is sold as
          // unlimited and only borrows from the product it is mapped to. A
          // countdown of 0 is what the POS reads as unlimited, so it is left
          // alone even when no mapping has been set up yet.
          const isUnlimited =
            skipSelfCountdown || countdownByProdnum.get(prodnum) === 0;
          if (!isUnlimited) {
            countdownChanges.set(
              prodnum,
              (countdownChanges.get(prodnum) || 0) - quantity,
            );
          }
          if (linkNum !== prodnum) {
            countdownChanges.set(
              linkNum,
              (countdownChanges.get(linkNum) || 0) - outQty,
            );
          }
          storageChanges.set(
            linkNum,
            (storageChanges.get(linkNum) || 0) - outQty,
          );
        }

        await OrderService.applyStockChanges(
          connection,
          countdownChanges,
          storageChanges,
        );
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
      hvLogger.info("Executed Database Query", {
        query: hpSql,
        params: hpParams,
      });
      await connection.query(hpSql, hpParams);

      const updateNeedsCashoutSql = `UPDATE DBA.EMPLOYEE SET NEEDSCASHOUT = 1 WHERE EMPNUM = ?`;
      hvLogger.info("Executed Database Query", {
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
