import { contextBridge, ipcRenderer } from "electron";

const api = {
  getEmployeeBySwipe: (swipe: string) =>
    ipcRenderer.invoke("employee:getBySwipe", swipe),
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  getTransactions: () => ipcRenderer.invoke("transaction:get"),
  getTransactionByTransact: (transact: string) =>
    ipcRenderer.invoke("transaction:getByTransact", transact),
  getProductPOSAudio: () => ipcRenderer.invoke("product:getPOSAudio"),
  resetProduct: (products: import("@/shared/types").ProductPOSAudio[]) =>
    ipcRenderer.invoke("reset-product", products),
  createUpdatePOSAudio: (
    data: import("@/shared/types").TransactionPOSAudioPayload,
  ) => ipcRenderer.invoke("posAudio:createUpdate", data),
};

// Expose api ra đối tượng window
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api;
}
