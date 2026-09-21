import { getConnection } from "@/main/config/database";
import logger from "@/main/utils/logger";
import { SchemaStatus } from "@/shared/types";

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

let lastError = "";

function key(table: string, column: string): string {
  return `${table.toUpperCase()}.${column.toUpperCase()}`;
}

function manualSql(): string {
  return REQUIRED_COLUMNS.filter((c) => !hasColumn(c.table, c.column))
    .map(
      (c) =>
        `ALTER TABLE ${c.table} ADD ${c.column} ${c.definition};\nUPDATE ${c.table} SET ${c.column} = 0 WHERE ${c.column} IS NULL;`,
    )
    .join("\n");
}

export function hasColumn(table: string, column: string): boolean {
  return availableColumns.has(key(table, column));
}

export function getSchemaStatus(): SchemaStatus {
  const ready = REQUIRED_COLUMNS.every((c) => hasColumn(c.table, c.column));
  return {
    ready,
    error: ready ? undefined : lastError || "Column not created yet.",
    sql: ready ? "" : manualSql(),
  };
}

/** `SKIPSELFCOUNTDOWN` as a SELECT expression, or a constant 0 when the column
 * could not be created (missing rights) so every query still runs. */
export function skipSelfCountdownSql(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return hasColumn("DBA.ProductPOSAudio", "SKIPSELFCOUNTDOWN")
    ? `ISNULL(${prefix}SKIPSELFCOUNTDOWN, 0)`
    : "0";
}

/**
 * Safe to call again: it only does work while a column is still missing, so
 * the mapping screen can retry when the table was locked at startup.
 */
export async function ensureSchema(): Promise<SchemaStatus> {
  if (getSchemaStatus().ready) return getSchemaStatus();

  let connection: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    connection = await getConnection();

    for (const col of REQUIRED_COLUMNS) {
      if (hasColumn(col.table, col.column)) continue;

      let exists = true;
      try {
        await connection.query(
          `SELECT ${col.column} FROM ${col.table} WHERE 1 = 0`,
        );
      } catch (error: unknown) {
        exists = false;
        logger.info(
          `Column ${col.table}.${col.column} not found: ${(error as Error).message}`,
        );
      }

      if (!exists) {
        const alterSql = `ALTER TABLE ${col.table} ADD ${col.column} ${col.definition}`;
        logger.info(`Adding missing column: ${alterSql}`);
        try {
          await connection.query(alterSql);
          await connection.query(
            `UPDATE ${col.table} SET ${col.column} = 0 WHERE ${col.column} IS NULL`,
          );
        } catch (error: unknown) {
          const err = error as Error & { odbcErrors?: { message: string }[] };
          lastError =
            (err.message || String(error)) +
            (err.odbcErrors
              ? " | ODBC: " + err.odbcErrors.map((e) => e.message).join(", ")
              : "");
          logger.error(`Could not add ${col.table}.${col.column}:`, { error });
          continue;
        }
      }

      availableColumns.add(key(col.table, col.column));
      lastError = "";
    }
  } catch (error: unknown) {
    // A till that cannot alter the schema still has to sell, so keep the app
    // up: every query falls back to a constant 0 for the missing column.
    lastError = (error as Error).message || String(error);
    logger.error("Could not verify the POS Audio schema:", { error });
  } finally {
    if (connection) await connection.close();
  }

  return getSchemaStatus();
}
