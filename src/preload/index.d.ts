import { ElectronAPI } from "@electron-toolkit/preload";

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
    };
  }
}
