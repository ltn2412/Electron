import odbc from "odbc";
import logger from "../utils/logger";

const CONNECTION_STRING = "DSN=PixelSqlbase;UID=DBA;ENP=28f3cd0c3ddcfc32;";

export async function getConnection(): Promise<odbc.Connection> {
  try {
    const connection = await odbc.connect(CONNECTION_STRING);
    
    // Proxy the query method to log INSERT and UPDATE
    const originalQuery = connection.query.bind(connection);
    
    connection.query = async function (
      sql: string,
      parameters?: any[]
    ): Promise<any> {
      const upperSql = sql.trim().toUpperCase();
      if (upperSql.startsWith("INSERT") || upperSql.startsWith("UPDATE")) {
        logger.info("Executed Database Query", { query: sql, params: parameters });
      }
      return originalQuery(sql, parameters);
    } as any;

    return connection;
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Cannot connect to database: ${err.message || "Check DSN/Server configuration"}`,
    );
  }
}
