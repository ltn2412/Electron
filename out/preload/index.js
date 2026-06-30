"use strict";
const electron = require("electron");
const api = {
  getEmployeeBySwipe: (swipe) => electron.ipcRenderer.invoke("employee:getBySwipe", swipe),
  minimize: () => electron.ipcRenderer.send("window:minimize"),
  close: () => electron.ipcRenderer.send("window:close"),
  getTransactions: () => electron.ipcRenderer.invoke("transaction:get"),
  getTransactionByTransact: (transact) => electron.ipcRenderer.invoke("transaction:getByTransact", transact),
  getProductPOSAudio: () => electron.ipcRenderer.invoke("product:getPOSAudio"),
  resetProduct: (products) => electron.ipcRenderer.invoke("reset-product", products),
  getHoangVanSlots: (date) => electron.ipcRenderer.invoke("hoangvan:getSlots", date),
  checkOrder: (orderNo) => electron.ipcRenderer.invoke("hoangvan:checkOrder", orderNo),
  useOrder: (payload) => electron.ipcRenderer.invoke("hoangvan:useOrder", payload),
  createUpdatePOSAudio: (data) => electron.ipcRenderer.invoke("posAudio:createUpdate", data),
  createOrder: (payload) => electron.ipcRenderer.invoke("order:create", payload),
  getExpiredOrders: (payload) => electron.ipcRenderer.invoke("hoangvan:getExpiredOrders", payload),
  confirmExpiredOrders: (payload) => electron.ipcRenderer.invoke("hoangvan:confirmExpiredOrders", payload)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.api = api;
}
