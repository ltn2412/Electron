import odbc from "odbc";

const CONNECTION_STRING = "DSN=PixelSqlbase_vvk_uat;UID=DBA;PWD=banana1;";

export async function getConnection(): Promise<odbc.Connection> {
  try {
    const connection = await odbc.connect(CONNECTION_STRING);
    return connection;
  } catch (error: any) {
    // Log chi tiết để xem trong file log của Electron
    console.error("Database connection failed details:", error.message);

    // Ném lỗi với message dễ hiểu hơn để frontend nhận được
    throw new Error(
      `Không thể kết nối DB: ${error.message || "Kiểm tra lại cấu hình DSN/Server"}`,
    );
  }
}
