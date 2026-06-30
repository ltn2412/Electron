import odbc from "odbc";

const CONNECTION_STRING = "DSN=PixelSqlbase;UID=DBA;ENP=28f3cd0c3ddcfc32;";

export async function getConnection(): Promise<odbc.Connection> {
  try {
    const connection = await odbc.connect(CONNECTION_STRING);
    return connection;
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Cannot connect to database: ${err.message || "Check DSN/Server configuration"}`,
    );
  }
}
