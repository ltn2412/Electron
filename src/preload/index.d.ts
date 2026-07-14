import { ElectronAPI } from "@electron-toolkit/preload";
import {
  POSHEADER,
  ProductPOSAudio,
  TransactionPOSAudioPayload,
} from "@/shared/types";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface EmployeeData {
  EMPNUM: number;
  EMPNAME: string;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      getEmployeeBySwipe: (swipe: string) => Promise<ApiResponse<EmployeeData>>;
      logoutEmployee: (swipe: string) => Promise<ApiResponse<boolean>>;
      minimize: () => void;
      close: () => void;
      getTransactions: () => Promise<ApiResponse<POSHEADER[]>>;
      getTransactionByTransact: (
        transact: string,
      ) => Promise<ApiResponse<POSHEADER>>;
      getConfig: () => Promise<ApiResponse<Record<string, unknown>>>;
      getProductPOSAudio: () => Promise<ApiResponse<ProductPOSAudio[]>>;
      createUpdatePOSAudio: (
        data: TransactionPOSAudioPayload,
      ) => Promise<ApiResponse<void>>;
      resetProduct: (products: ProductPOSAudio[]) => Promise<ApiResponse<void>>;
      getHoangVanSlots: (date: string) => Promise<ApiResponse<import("@/shared/types").HoangVanSlot[]>>;
      checkOrder: (orderNo: string) => Promise<ApiResponse<import("@/shared/types").HoangVanOrder>>;
      useOrder: (payload: {
        orderNo: string;
        staffId: string;
      }) => Promise<ApiResponse<unknown>>;
      createOrder: (payload: {
        refCode: string;
        quantity: number;
        costEach: number;
        swipe: string;
        status?: number;
        onlineOrderId?: string;
      }) => Promise<
        ApiResponse<{
          success: boolean;
          transact?: number;
          message?: string;
          error?: string;
        }>
      >;
      getOnlineOrderStatus: (
        orderId: string,
      ) => Promise<
        ApiResponse<{ success: boolean; status?: number; error?: string }>
      >;
      returnLocalOrder: (
        orderId: string,
      ) => Promise<ApiResponse<{ success: boolean; error?: string }>>;
      getExpiredOrders: (payload: {
        page: number;
        pageSize: number;
      }) => Promise<ApiResponse<unknown>>;
      confirmExpiredOrders: (payload: {
        orderNos: string[];
      }) => Promise<ApiResponse<unknown>>;
      printHtml: (
        htmlContent: string,
      ) => Promise<{ success: boolean; error?: string }>;
      
    };
  }
}
