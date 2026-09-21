import { getConnection } from "@/main/config/database";
import logger from "@/main/utils/logger";

/**
 * Columns this app adds on top of the POS schema. They are created on startup
 * so a new build can be dropped on the till without anyone running SQL by hand.
 */
const REQUIRED_COLUMNS = [
  {
    table: "DBA.ProductPOSAudio",
    column: "SKIPSELFCOUNTDOWN",
    definition: "TINYINT DEFAULT 0",
  },
];

/**
 * Products flagged with SKIPSELFCOUNTDOWN are sold with COUNTDOWN = 0 in the
 * POS (unlimited), so the POS never deducts them: their stock lives entirely on
 * the product they are mapped to. Nothing may add their COUNTDOWN back, or the
 * 0 turns into 1 and the item stops being unlimited.
 */
const availableColumns = new Set<string>();

function key(table: string, column: string): string {
  return `${table.toUpperCase()}.${column.toUpperCase()}`;
}

export function hasColumn(table: string, column: string): boolean {
  return availableColumns.has(key(table, column));
}

/** `SKIPSELFCOUNTDOWN` as a SELECT expression, or a constant 0 when the column
 * could not be created (missing rights) so every query still runs. */
export function skipSelfCountdownSql(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return hasColumn("DBA.ProductPOSAudio", "SKIPSELFCOUNTDOWN")
    ? `ISNULL(${prefix}SKIPSELFCOUNTDOWN, 0)`
    : "0";
}

export async function ensureSchema(): Promise<void> {
  let connection: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    connection = await getConnection();

    for (const col of REQUIRED_COLUMNS) {
      let exists = true;
      try {
        await connection.query(
          `SELECT ${col.column} FROM ${col.table} WHERE 1 = 0`,
        );
      } catch {
        exists = false;
      }

      if (!exists) {
        logger.info(`Adding missing column ${col.table}.${col.column}`);
        await connection.query(
          `ALTER TABLE ${col.table} ADD ${col.column} ${col.definition}`,
        );
        await connection.query(
          `UPDATE ${col.table} SET ${col.column} = 0 WHERE ${col.column} IS NULL`,
        );
      }

      availableColumns.add(key(col.table, col.column));
    }
  } catch (error: unknown) {
    // A till that cannot alter the schema still has to sell, so keep the app
    // up: every query falls back to a constant 0 for the missing column.
    logger.error("Could not verify the POS Audio schema:", { error });
  } finally {
    if (connection) await connection.close();
  }
}
