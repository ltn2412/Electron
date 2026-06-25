"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const odbc = require("odbc");
const icon = path.join(__dirname, "../../resources/icon.png");
const CONNECTION_STRING = "DSN=PixelSqlbase;UID=DBA;ENP=28f3cd0c3ddcfc32";
async function getConnection() {
  try {
    const connection = await odbc.connect(CONNECTION_STRING);
    return connection;
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
}
class EmployeeService {
  static async getEmployeeBySwipe(swipe) {
    let connection;
    try {
      connection = await getConnection();
      const query = `SELECT EMPNUM, EMPNAME FROM DBA.EMPLOYEE WHERE SWIPE = ? AND ISACTIVE = 1`;
      const result = await connection.query(query, [swipe]);
      if (result.length > 0) {
        return result[0];
      }
      return null;
    } catch (error) {
      console.error("Lỗi khi lấy thông tin Employee:", error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.handle("employee:getBySwipe", async (_, swipe) => {
    try {
      const employee = await EmployeeService.getEmployeeBySwipe(swipe);
      return { success: true, data: employee };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
