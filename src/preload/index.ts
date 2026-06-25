import { contextBridge, ipcRenderer } from "electron";

const api = {
  // Định nghĩa hàm gọi xuống main process
  getEmployeeBySwipe: (swipe: string) =>
    ipcRenderer.invoke("employee:getBySwipe", swipe),
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
