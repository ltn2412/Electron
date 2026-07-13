"use strict";
import { ipcRenderer, contextBridge } from "electron";
const api = {
  getEmployeeBySwipe: (swipe) =>
    ipcRenderer.invoke("employee:getBySwipe", swipe),
  logoutEmployee: (swipe) => ipcRenderer.invoke("employee:logout", swipe),
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  getTransactions: () => ipcRenderer.invoke("transaction:get"),
  getTransactionByTransact: (transact) =>
    ipcRenderer.invoke("transaction:getByTransact", transact),
  getConfig: () => ipcRenderer.invoke("config:get"),
  getProductPOSAudio: () => ipcRenderer.invoke("product:getPOSAudio"),
  resetProduct: (products) => ipcRenderer.invoke("reset-product", products),
  getHoangVanSlots: (date) => ipcRenderer.invoke("hoangvan:getSlots", date),
  checkOrder: (orderNo) => ipcRenderer.invoke("hoangvan:checkOrder", orderNo),
  useOrder: (payload) => ipcRenderer.invoke("hoangvan:useOrder", payload),
  createUpdatePOSAudio: (data) =>
    ipcRenderer.invoke("posAudio:createUpdate", data),
  createOrder: (payload) => ipcRenderer.invoke("order:create", payload),
  getOnlineOrderStatus: (orderId) =>
    ipcRenderer.invoke("order:getOnlineStatus", orderId),
  returnLocalOrder: (orderId) =>
    ipcRenderer.invoke("order:returnLocal", orderId),
  getExpiredOrders: (payload) =>
    ipcRenderer.invoke("hoangvan:getExpiredOrders", payload),
  confirmExpiredOrders: (payload) =>
    ipcRenderer.invoke("hoangvan:confirmExpiredOrders", payload),
  printHtml: (htmlContent) => ipcRenderer.invoke("print:html", htmlContent),
};
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.api = api;
}
