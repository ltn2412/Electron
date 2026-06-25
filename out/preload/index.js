"use strict";
const electron = require("electron");
const api = {
  // Định nghĩa hàm gọi xuống main process
  getEmployeeBySwipe: (swipe) => electron.ipcRenderer.invoke("employee:getBySwipe", swipe)
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
