import axios from "axios";
import { HoangVanSlot, HoangVanOrder } from "@/shared/types";
import logger from "@/main/utils/logger";
import { ConfigManager } from "@/main/config/AppConfig";

class HoangVanService {
  private token: string | null = null;

  private handleApiError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      if (status === 400)
        throw new Error(data?.message || "Invalid data (400).");
      if (status === 401 || status === 403)
        throw new Error(`Session expired or access denied (${status}).`);
      if (status === 404)
        throw new Error("Order not found on Hoang Van system (404).");
      if (status === 500)
        throw new Error(
          "Hoang Van server is experiencing issues (500). Please try again later.",
        );
      if (error.code === "ECONNABORTED" || error.message.includes("timeout"))
        throw new Error(
          "Connection to Hoang Van timed out. Please check your network.",
        );
      throw new Error(
        `Hoang Van connection error: ${data?.message || error.message}`,
      );
    }
    throw new Error(`Unknown error (${context}): ${(error as Error).message}`);
  }

  async login(): Promise<void> {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    try {
      const payload = {
        Username: config.hoangVanUser,
        Password: config.hoangVanPass,
        username: config.hoangVanUser,
        password: config.hoangVanPass,
      };
      logger.info(`HoangVanAPI Login Request to ${config.hoangVanURL}/login`, {
        payload,
      });
      const res = await axios.post(`${config.hoangVanURL}/login`, payload);
      logger.info("HoangVanAPI Login Response", { data: res.data });

      if (res.data.success && res.data.data?.token) {
        this.token = res.data.data.token;
      } else {
        throw new Error(res.data.message || "Login failed");
      }
    } catch (error) {
      this.handleApiError(error, "login");
    }
  }

  async getSlots(date: string, isRetry = false): Promise<HoangVanSlot[]> {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) await this.login();

    try {
      const url = `${config.hoangVanURL}/slots?date=${date}`;
      logger.info(`HoangVanAPI GetSlots Request to ${url}`);
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      logger.info("HoangVanAPI GetSlots Response", { data: res.data });

      if (res.data.success && res.data.data?.slots) return res.data.data.slots;
      throw new Error(res.data.message || "Failed to fetch slots");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.getSlots(date, true);
        }
      }

      this.handleApiError(error, "getSlots");
    }
  }

  async checkOrder(orderNo: string, isRetry = false): Promise<HoangVanOrder> {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) await this.login();
    try {
      const url = `${config.hoangVanURL}/orders/${orderNo}/status`;
      logger.info(`HoangVanAPI CheckOrder Request to ${url}`);
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      logger.info("HoangVanAPI CheckOrder Response", { data: res.data });
      if (res.data.success && res.data.data)
        return res.data.data as HoangVanOrder;
      throw new Error(res.data.message || "Failed to check order");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.checkOrder(orderNo, true);
        }
      }

      this.handleApiError(error, "checkOrder");
    }
  }

  async useOrder(
    orderNo: string,
    staffId: string,
    isRetry = false,
  ): Promise<Record<string, unknown>> {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) await this.login();
    try {
      const url = `${config.hoangVanURL}/orders/${orderNo}/use`;
      const payload = {
        orderNo,
        staffId,
        usedTime: new Date().toISOString(),
      };
      logger.info(`HoangVanAPI UseOrder Request to ${url}`, { payload });
      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      logger.info("HoangVanAPI UseOrder Response", { data: res.data });
      if (res.data.success && res.data.data)
        return res.data.data as Record<string, unknown>;
      throw new Error(res.data.message || "Failed to use order");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.useOrder(orderNo, staffId, true);
        }
      }

      this.handleApiError(error, "useOrder");
    }
  }

  async getTransactions(
    orderNo: string,
    isRetry = false,
  ): Promise<Record<string, unknown>> {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) await this.login();
    try {
      const url = `${config.hoangVanURL}/orders/${orderNo}/transactions`;
      logger.info(`HoangVanAPI GetTransactions Request to ${url}`);
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      logger.info("HoangVanAPI GetTransactions Response", { data: res.data });
      if (res.data.success) return res.data as Record<string, unknown>;
      throw new Error(res.data.message || "Failed to fetch transactions");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.getTransactions(orderNo, true);
        }
      }

      this.handleApiError(error, "getTransactions");
    }
  }

  async getExpiredOrders(
    page: number = 1,
    pageSize: number = 50,
    isRetry = false,
  ): Promise<Record<string, unknown>> {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) await this.login();
    try {
      const url = `${config.hoangVanURL}/orders/expired?page=${page}&pageSize=${pageSize}`;
      logger.info(`HoangVanAPI GetExpiredOrders Request to ${url}`);
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      logger.info("HoangVanAPI GetExpiredOrders Response", { data: res.data });
      if (res.data.success && res.data.data)
        return res.data as Record<string, unknown>;
      throw new Error(res.data.message || "Failed to fetch expired orders");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.getExpiredOrders(page, pageSize, true);
        }
      }

      this.handleApiError(error, "getExpiredOrders");
    }
  }

  async confirmExpiredOrders(
    orderNos: string[],
    isRetry = false,
  ): Promise<Record<string, unknown>> {
    const config = ConfigManager.getConfig();
    if (!config) throw new Error("Missing config.json file or invalid fields");
    if (!this.token) await this.login();
    try {
      const url = `${config.hoangVanURL}/orders/expired/confirm`;
      const payload = { orderNos };
      logger.info(`HoangVanAPI ConfirmExpiredOrders Request to ${url}`, {
        payload,
      });
      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      logger.info("HoangVanAPI ConfirmExpiredOrders Response", {
        data: res.data,
      });
      if (res.data.success) return res.data as Record<string, unknown>;
      throw new Error(res.data.message || "Failed to confirm expired orders");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if ((status === 401 || status === 403) && !isRetry) {
          this.token = null;
          await this.login();
          return this.confirmExpiredOrders(orderNos, true);
        }
      }

      this.handleApiError(error, "confirmExpiredOrders");
    }
  }
}

export default new HoangVanService();
