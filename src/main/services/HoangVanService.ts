import axios from "axios";
import { HoangVanSlot, HoangVanOrder } from "../../shared/types";
import logger from "../utils/logger";

class HoangVanService {
  private baseURL = "https://demobtctct.soatvetudong.vn/api/speedpos";
  private token: string | null = null;
  private username = "speedpos";
  private password = "SpeedHoangVan";

  async login(): Promise<void> {
    try {
      const res = await axios.post(`${this.baseURL}/login`, {
        Username: this.username,
        Password: this.password,
        username: this.username,
        password: this.password,
      });

      if (res.data.success && res.data.data?.token) {
        this.token = res.data.data.token;
      } else {
        throw new Error(res.data.message || "Login failed");
      }
    } catch (error) {
      console.error("HoangVanAPI Login Error:", error);
      throw error;
    }
  }

  async getSlots(date: string, isRetry = false): Promise<HoangVanSlot[]> {
    if (!this.token) {
      await this.login();
    }

    try {
      const res = await axios.get(`${this.baseURL}/slots?date=${date}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (res.data.success && res.data.data?.slots) {
        return res.data.data.slots;
      } else {
        throw new Error(res.data.message || "Failed to fetch slots");
      }
    } catch (error: unknown) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        // Token might have expired or Access Denied, try logging in again
        this.token = null;
        await this.login();
        return this.getSlots(date, true);
      }
      console.error("HoangVanAPI getSlots Error:", error);
      throw error;
    }
  }

  async checkOrder(orderNo: string, isRetry = false): Promise<HoangVanOrder> {
    if (!this.token) {
      await this.login();
    }
    try {
      const res = await axios.get(`${this.baseURL}/orders/${orderNo}/status`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (res.data.success && res.data.data) {
        return res.data.data as HoangVanOrder;
      } else {
        throw new Error(res.data.message || "Failed to check order");
      }
    } catch (error: unknown) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.checkOrder(orderNo, true);
      }
      if (status === 404) {
        throw new Error("Không tìm thấy đơn hàng");
      }
      console.error("HoangVanAPI checkOrder Error:", error);
      throw error;
    }
  }

  async useOrder(
    orderNo: string,
    staffId: string,
    note?: string,
    isRetry = false,
  ): Promise<HoangVanOrder> {
    if (!this.token) {
      await this.login();
    }
    try {
      const payload = { staffId, note: note || "Sử dụng máy Audio Guide" };
      const res = await axios.post(
        `${this.baseURL}/orders/${orderNo}/use`,
        payload,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      logger.info("HoangVan API Request", {
        body: payload,
        response: res.data,
      });
      if (res.data.success && res.data.data) {
        return res.data.data;
      } else {
        throw new Error(res.data.message || "Failed to use order");
      }
    } catch (error: unknown) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.useOrder(orderNo, staffId, note, true);
      }
      if (status === 400 && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      console.error("HoangVanAPI useOrder Error:", error);
      throw error;
    }
  }
  async getExpiredOrders(
    page: number = 1,
    pageSize: number = 50,
    isRetry = false,
  ): Promise<unknown> {
    if (!this.token) {
      await this.login();
    }
    try {
      const res = await axios.get(
        `${this.baseURL}/orders/expired?page=${page}&pageSize=${pageSize}`,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      if (res.data.success && res.data.data) {
        return res.data;
      } else {
        throw new Error(res.data.message || "Failed to fetch expired orders");
      }
    } catch (error: unknown) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.getExpiredOrders(page, pageSize, true);
      }
      console.error("HoangVanAPI getExpiredOrders Error:", error);
      throw error;
    }
  }

  async confirmExpiredOrders(
    orderNos: string[],
    isRetry = false,
  ): Promise<unknown> {
    if (!this.token) {
      await this.login();
    }
    try {
      const payload = { orderNos };
      const res = await axios.post(
        `${this.baseURL}/orders/expired/confirm`,
        payload,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      logger.info("HoangVan API Request", {
        body: payload,
        response: res.data,
      });
      if (res.data.success) {
        return res.data;
      } else {
        throw new Error(res.data.message || "Failed to confirm expired orders");
      }
    } catch (error: unknown) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && !isRetry) {
        this.token = null;
        await this.login();
        return this.confirmExpiredOrders(orderNos, true);
      }
      console.error("HoangVanAPI confirmExpiredOrders Error:", error);
      throw error;
    }
  }
}

export default new HoangVanService();
