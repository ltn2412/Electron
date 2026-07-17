import { showAlert } from "@/utils/alert";
import {
  ExpiredConfirmPayload,
  ExpiredConfirmResponse,
  ExpiredOrdersResponse,
  LoginResponse,
  OrderStatusResponse,
  OrderUsePayload,
  OrderUseResponse,
  SlotsResponse,
} from "@shared/types";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL = "https://ticket.baotangchungtichchientranh.vn/api/speedpos";
const TOKEN_KEY = "HOANGVAN_JWT_TOKEN";

// You can change these to load from environment variables if needed
const HOANGVAN_CREDENTIALS = {
  username: "speedpos",
  password: "password123", // Replace with real password or fetch from config
};

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Flag to prevent multiple simultaneous login requests
let isRefreshing = false;
// Queue for holding requests while token is refreshing
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (
  error: Error | null,
  token: string | null = null,
): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY);
    // Don't append token to login request itself
    if (token && config.url && !config.url.includes("/login")) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // If already refreshing, put this request in a queue
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = "Bearer " + token;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to login again
        const res = await axios.post<LoginResponse>(
          `${BASE_URL}/login`,
          HOANGVAN_CREDENTIALS,
        );

        if (res.data.success && res.data.data?.token) {
          const newToken = res.data.data.token;
          localStorage.setItem(TOKEN_KEY, newToken);
          api.defaults.headers.common["Authorization"] = "Bearer " + newToken;

          processQueue(null, newToken);

          // Retry original request
          originalRequest.headers.Authorization = "Bearer " + newToken;
          return api(originalRequest);
        } else {
          throw new Error(res.data.message || "Auto login failed");
        }
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        // Clear token on complete failure
        localStorage.removeItem(TOKEN_KEY);

        const errMessage =
          (refreshError as AxiosError<LoginResponse>)?.response?.data
            ?.message || (refreshError as Error).message;
        showAlert(
          `Session expired and auto-login failed. Error: ${errMessage}`,
        );

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors (alert immediately to UI)
    if (error.response?.data) {
      const errData = error.response.data as {
        message?: string;
        error?: string;
      };
      const msg = errData.message || errData.error || error.message;
      showAlert(`API Error: ${msg}`);
    } else {
      showAlert(`API Connection Error: ${error.message}`);
    }

    return Promise.reject(error);
  },
);

export class HoangVanService {
  /**
   * 1. Login and get Token
   */
  static async login(): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>(
      "/login",
      HOANGVAN_CREDENTIALS,
    );
    if (response.data.success && response.data.data?.token) {
      localStorage.setItem(TOKEN_KEY, response.data.data.token);
    }
    return response.data;
  }

  /**
   * 4.1 Check Order Status
   */
  static async getOrderStatus(orderNo: string): Promise<OrderStatusResponse> {
    const response = await api.get<OrderStatusResponse>(
      `/orders/${orderNo}/status`,
    );
    return response.data;
  }

  /**
   * 4.2 Use Order
   */
  static async useOrder(
    orderNo: string,
    payload: OrderUsePayload,
  ): Promise<OrderUseResponse> {
    const response = await api.post<OrderUseResponse>(
      `/orders/${orderNo}/use`,
      payload,
    );
    return response.data;
  }

  /**
   * 4.3 Get Expired Orders
   */
  static async getExpiredOrders(
    page: number = 1,
    pageSize: number = 50,
  ): Promise<ExpiredOrdersResponse> {
    const response = await window.api.getExpiredOrders({ page, pageSize });
    if (response.success && response.data) {
      return response.data as ExpiredOrdersResponse;
    }
    return response as unknown as ExpiredOrdersResponse;
  }

  /**
   * 4.4 Confirm Expired Orders
   */
  static async confirmExpiredOrders(
    payload: ExpiredConfirmPayload,
  ): Promise<ExpiredConfirmResponse> {
    const response = await window.api.confirmExpiredOrders({
      orderNos: payload.orderNos,
    });
    if (response.success && response.data) {
      return response.data as ExpiredConfirmResponse;
    }
    return response as unknown as ExpiredConfirmResponse;
  }

  /**
   * 4.5 Get Daily Slots
   */
  static async getSlots(date?: string): Promise<SlotsResponse> {
    // If date is not provided, use today
    const targetDate = date || new Date().toISOString().split("T")[0];
    const response = await api.get<SlotsResponse>(`/slots?date=${targetDate}`);
    return response.data;
  }
}
