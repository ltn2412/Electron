import { contextBridge, ipcRenderer } from "electron";

const api = {
  getEmployeeBySwipe: (swipe: string) =>
    ipcRenderer.invoke("employee:getBySwipe", swipe),
  logoutEmployee: (swipe: string) =>
    ipcRenderer.invoke("employee:logout", swipe),
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  getTransactions: () => ipcRenderer.invoke("transaction:get"),
  getTransactionByTransact: (transact: string) =>
    ipcRenderer.invoke("transaction:getByTransact", transact),
  getConfig: () => ipcRenderer.invoke("config:get"),
  getProductPOSAudio: () => ipcRenderer.invoke("product:getPOSAudio"),
  resetProduct: (products: import("@/shared/types").ProductPOSAudio[]) =>
    ipcRenderer.invoke("reset-product", products),
  getHoangVanSlots: (date: string) =>
    ipcRenderer.invoke("hoangvan:getSlots", date),
  checkOrder: (orderNo: string) =>
    ipcRenderer.invoke("hoangvan:checkOrder", orderNo),
  useOrder: (payload: { orderNo: string; staffId: string }) =>
    ipcRenderer.invoke("hoangvan:useOrder", payload),
  createUpdatePOSAudio: (
    data: import("@/shared/types").TransactionPOSAudioPayload,
  ) => ipcRenderer.invoke("posAudio:createUpdate", data),
  createOrder: (payload: {
    refCode: string;
    quantity: number;
    costEach: number;
    swipe: string;
    status?: number;
    onlineOrderId?: string;
  }) => ipcRenderer.invoke("order:create", payload),
  getOnlineOrderStatus: (orderId: string) =>
    ipcRenderer.invoke("order:getOnlineStatus", orderId),
  returnLocalOrder: (orderId: string) =>
    ipcRenderer.invoke("order:returnLocal", orderId),
  getExpiredOrders: (payload: { page: number; pageSize: number }) =>
    ipcRenderer.invoke("hoangvan:getExpiredOrders", payload),
  confirmExpiredOrders: (payload: { orderNos: string[] }) =>
    ipcRenderer.invoke("hoangvan:confirmExpiredOrders", payload),
  printHtml: (htmlContent: string) =>
    ipcRenderer.invoke("print:html", htmlContent),
  
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("api", api);
} else {
  // @ts-ignore (define in dts)
  window.api = api;
}
