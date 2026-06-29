import axios from "axios";
import { HoangVanSlot, HoangVanOrder } from "../../shared/types";

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
    } catch (error: any) {
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
    } catch (error: any) {
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
      const res = await axios.post(
        `${this.baseURL}/orders/${orderNo}/use`,
        { staffId, note: note || "Sử dụng máy Audio Guide" },
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      if (res.data.success && res.data.data) {
        return res.data.data;
      } else {
        throw new Error(res.data.message || "Failed to use order");
      }
    } catch (error: any) {
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
}

export default new HoangVanService();
