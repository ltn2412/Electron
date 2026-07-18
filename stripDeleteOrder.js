const fs = require('fs');

function removeMethod(code, methodName) {
  const methodRegex = new RegExp(\`(public\\\\s+static\\\\s+async\\\\s+\\b\${methodName}\\b\\\\s*\\\\([\\\\s\\\\S]*?\\\\)\\s*:\\s*Promise<[\\\\s\\\\S]*?>\\\\s*\\\\{)\`, "g");
  
  let match;
  let ranges = [];
  while ((match = methodRegex.exec(code)) !== null) {
    const startIdx = match.index;
    let bracketCount = 0;
    let i = startIdx + match[0].length - 1; // points to the '{'
    
    bracketCount++;
    i++;
    while (i < code.length && bracketCount > 0) {
      if (code[i] === '{') bracketCount++;
      else if (code[i] === '}') bracketCount--;
      i++;
    }
    ranges.push({ start: startIdx, end: i });
  }

  // Remove ranges from back to front
  for (let i = ranges.length - 1; i >= 0; i--) {
    code = code.substring(0, ranges[i].start) + code.substring(ranges[i].end);
  }
  return code;
}

let content = fs.readFileSync('src/main/services/OrderService.ts', 'utf8');

// Also inject hvLogger import
if (!content.includes('hvLogger')) {
  content = content.replace(/import logger from ".*logger";/, 'import logger, { hvLogger } from "@/main/utils/logger";');
}

// Strip all deleteOrder methods
content = removeMethod(content, 'deleteOrder');

// Replace logger with hvLogger inside createOrder
const createStart = content.indexOf('public static async createOrder');
if (createStart !== -1) {
  let bracketCount = 0;
  let i = content.indexOf('{', createStart);
  bracketCount++;
  i++;
  while (i < content.length && bracketCount > 0) {
    if (content[i] === '{') bracketCount++;
    else if (content[i] === '}') bracketCount--;
    i++;
  }
  const createEnd = i;
  
  let createCode = content.substring(createStart, createEnd);
  createCode = createCode.replace(/logger\.info/g, 'hvLogger.info');
  createCode = createCode.replace(/logger\.error/g, 'hvLogger.error');
  
  content = content.substring(0, createStart) + createCode + content.substring(createEnd);
}

// Append new deleteOrder at the end of the class
const newDeleteOrder = `  public static async deleteOrder(
    transact: number,
  ): Promise<{ success: boolean; error?: string }> {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      // Get transaction status to check if it's an Expired order (Status = 3)
      const statusSql = \`SELECT Status FROM DBA.TransactionPOSAudio WHERE Transact = ?\`;
      const statusResult = await connection.query(statusSql, [transact]);
      let isExpired = false;
      if (statusResult && (statusResult as any).length > 0) {
        if ((statusResult as any)[0].Status === 3) {
          isExpired = true;
        }
      }

      // 2. Revert PRODUCT COUNTDOWN and STORAGE/OUT
      if (!isExpired) {
        const tdSql = \`SELECT PRODNUM, QuantityOut FROM DBA.TransactionDetailPOSAudio WHERE Transact = ?\`;
        const tdResult = await connection.query(tdSql, [transact]);
        for (const td of tdResult as any) {
          if (td.QuantityOut > 0) {
            const prodLinkQuery = \`SELECT PRODNUMLINK, ISPRIMARY, QUANTITY FROM DBA.ProductPOSAudio WHERE PRODNUM = ?\`;
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
                const queryProduct = \`UPDATE DBA.PRODUCT SET COUNTDOWN = COUNTDOWN + ? WHERE PRODNUM = ?\`;
                hvLogger.info("Executed Database Query", { query: queryProduct, params: [outQty, linkNum] });
                await connection.query(queryProduct, [outQty, linkNum]);
              }
              const queryStorage = \`UPDATE DBA.ProductPOSAudio SET STORAGE = STORAGE + ?, OUT = OUT - ? WHERE PRODNUM = ?\`;
              hvLogger.info("Executed Database Query", { query: queryStorage, params: [outQty, outQty, linkNum] });
              await connection.query(queryStorage, [outQty, outQty, linkNum]);
            }
          }
        }
      }

      // 3. Mark as Void instead of deleting
      const q1 = \`UPDATE DBA.POSHEADER SET NETTOTAL=0, FINALTOTAL=0 WHERE TRANSACT=?\`;
      hvLogger.info("Executed Database Query", { query: q1, params: [transact] });
      await connection.query(q1, [transact]);

      const q2 = \`UPDATE DBA.POSDETAIL SET PRODTYPE=101 WHERE TRANSACT=?\`;
      hvLogger.info("Executed Database Query", { query: q2, params: [transact] });
      await connection.query(q2, [transact]);

      const q3 = \`UPDATE DBA.Howpaid SET TENDER=0 WHERE TRANSACT=?\`;
      hvLogger.info("Executed Database Query", { query: q3, params: [transact] });
      await connection.query(q3, [transact]);

      const q4 = \`UPDATE DBA.XMLTransHeaders SET SyncCloud=1, NetTotal=0, FinalTotal=0 WHERE TransNumber=?\`;
      hvLogger.info("Executed Database Query", { query: q4, params: [transact] });
      await connection.query(q4, [transact]);

      const q5 = \`UPDATE DBA.XMLTransItems SET SyncCloud=1, TypeOfProd=101 WHERE TransNumber=?\`;
      hvLogger.info("Executed Database Query", { query: q5, params: [transact] });
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
      hvLogger.error(\`Rollback failed for \${transact}: \${errMsg}\`);
      return { success: false, error: errMsg || JSON.stringify(error) };
    } finally {
      await connection.close();
    }
  }
`;

const lastBracket = content.lastIndexOf('}');
if (lastBracket !== -1) {
  content = content.substring(0, lastBracket) + "\\n" + newDeleteOrder + "\\n}\\n";
}

fs.writeFileSync('src/main/services/OrderService.ts', content);
