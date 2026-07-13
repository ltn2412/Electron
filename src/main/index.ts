import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { EmployeeService } from "./services/EmployeeService";
import { TransactionService } from "./services/TransactionService";
import { ProductService } from "./services/ProductService";
import { TransactionPOSAudioService } from "./services/TransactionPOSAudioService";

import HoangVanService from "./services/HoangVanService";
import OrderService from "./services/OrderService";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    resizable: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  ipcMain.on("window:minimize", () => {
    mainWindow.minimize();
  });

  ipcMain.on("window:close", () => {
    mainWindow.close();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.handle("employee:getBySwipe", async (_, swipe: string) => {
    try {
      const employee = await EmployeeService.getEmployeeBySwipe(swipe);
      return { success: true, data: employee };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("employee:logout", async (_, swipe: string) => {
    try {
      const result = await EmployeeService.logoutEmployee(swipe);
      return { success: true, data: result };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("transaction:get", async () => {
    try {
      const data = await TransactionService.getTransaction();
      return { success: true, data };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("transaction:getByTransact", async (_, transact: string) => {
    try {
      const data = await TransactionService.getTransactionByTransact(transact);
      return { success: true, data };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("config:get", async () => {
    try {
      const { ConfigManager } = await import("./config/AppConfig");
      const config = ConfigManager.getConfig();
      return { success: true, data: config };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("product:getPOSAudio", async () => {
    try {
      const data = await ProductService.getProductPOSAudio();
      return { success: true, data };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    "reset-product",
    async (_, products: import("@/shared/types").ProductPOSAudio[]) => {
      try {
        const result = await ProductService.resetProduct(products);
        return { success: true, data: result };
      } catch (error: unknown) {
        const err = error as Error;
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle("hoangvan:getSlots", async (_, date: string) => {
    try {
      const data = await HoangVanService.getSlots(date);
      return { success: true, data };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("hoangvan:checkOrder", async (_, orderNo: string) => {
    try {
      const data = await HoangVanService.checkOrder(orderNo);
      return { success: true, data };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    "hoangvan:useOrder",
    async (_, { orderNo, staffId }: { orderNo: string; staffId: string }) => {
      try {
        const data = await HoangVanService.useOrder(orderNo, staffId);
        return { success: true, data };
      } catch (error: unknown) {
        const err = error as Error;
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    "hoangvan:getExpiredOrders",
    async (_, { page, pageSize }: { page: number; pageSize: number }) => {
      try {
        const data = await HoangVanService.getExpiredOrders(page, pageSize);
        return { success: true, data };
      } catch (error: unknown) {
        const err = error as Error;
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    "hoangvan:confirmExpiredOrders",
    async (_, { orderNos }: { orderNos: string[] }) => {
      try {
        const data = await HoangVanService.confirmExpiredOrders(orderNos);
        return { success: true, data };
      } catch (error: unknown) {
        const err = error as Error;
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    "posAudio:createUpdate",
    async (_, data: import("@/shared/types").TransactionPOSAudioPayload) => {
      try {
        await TransactionPOSAudioService.createUpdateTransaction(data);
        return { success: true };
      } catch (error: unknown) {
        const err = error as Error;
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    "order:create",
    async (
      _,
      {
        refCode,
        quantity,
        costEach,
        swipe,
        status,
        onlineOrderId,
      }: { refCode: string; quantity: number; costEach: number; swipe: string; status?: number; onlineOrderId?: string },
    ) => {
      try {
        const result = await OrderService.createOrder(
          refCode,
          quantity,
          costEach,
          swipe,
          status,
          onlineOrderId,
        );
        return result;
      } catch (error: unknown) {
        const err = error as Error;
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle("order:getOnlineStatus", async (_, orderId: string) => {
    try {
      const result = await OrderService.getOnlineOrderStatus(orderId);
      return result;
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("order:returnLocal", async (_, orderId: string) => {
    try {
      const result = await OrderService.returnOnlineOrder(orderId);
      return result;
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("print:html", async (_, htmlContent: string) => {
    return new Promise((resolve) => {
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
        },
      });

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      printWindow.webContents.on("did-finish-load", () => {
        printWindow.webContents.print(
          { 
            silent: true, 
            printBackground: false, 
            margins: { marginType: 'none' }
          },
          (success, failureReason) => {
            printWindow.close();
            resolve({ success, error: failureReason });
          }
        );
      });
    });
  });

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
