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
      minimize: () => void;
      close: () => void;
      getTransactions: () => Promise<ApiResponse<POSHEADER[]>>;
      getTransactionByTransact: (
        transact: string,
      ) => Promise<ApiResponse<POSHEADER>>;
      getProductPOSAudio: () => Promise<ApiResponse<ProductPOSAudio[]>>;
      createUpdatePOSAudio: (
        data: TransactionPOSAudioPayload,
      ) => Promise<ApiResponse<void>>;
      resetProduct: (products: ProductPOSAudio[]) => Promise<ApiResponse<void>>;
    };
  }
}
