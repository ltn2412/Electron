import { getConnection } from "../config/database";

export class EmployeeService {
  static async getEmployeeBySwipe(swipe: string): Promise<unknown> {
    let connection;
    try {
      connection = await getConnection();

      // Sử dụng dấu ? cho tham số để tránh SQL Injection
      const query = `SELECT EMPNUM, EMPNAME FROM DBA.EMPLOYEE WHERE SWIPE = ? AND ISACTIVE = 1`;
      const result = await connection.query(query, [swipe]);

      if (result.length > 0) {
        return result[0]; // Trả về object chứa EMPNUM và EMPNAME
      }
      return null;
    } catch (error) {
      console.error("Lỗi khi lấy thông tin Employee:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
