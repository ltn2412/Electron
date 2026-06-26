import odbc from "odbc";

const CONNECTION_STRING = "DSN=PixelSqlbase;UID=DBA;ENP=28f3cd0c3ddcfc32;";

export async function getConnection(): Promise<odbc.Connection> {
  try {
    const connection = await odbc.connect(CONNECTION_STRING);
    return connection;
  } catch (error: any) {
    console.error("Database connection failed details:", error.message);

    // Ném lỗi với message dễ hiểu hơn để frontend nhận được
    throw new Error(
      `Không thể kết nối DB: ${error.message || "Kiểm tra lại cấu hình DSN/Server"}`,
    );
  }
}
