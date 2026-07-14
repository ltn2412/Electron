const fs = require("fs");

// 1. Update index.ts
let mainTs = fs.readFileSync("src/main/index.ts", "utf8");
const importCode = `import { app, BrowserWindow, ipcMain, shell } from "electron";`;
const newImportCode = `import { app, BrowserWindow, ipcMain, shell } from "electron";
import fs from "fs";
import { join } from "path";`;
if (!mainTs.includes('import fs from "fs";')) {
  mainTs = mainTs.replace(importCode, newImportCode);
}

const templateCode = `
  ipcMain.handle("getReceiptTemplate", async () => {
    try {
      let templatePath = "";
      if (is.dev) {
        templatePath = join(process.cwd(), "receipt.html");
      } else {
        templatePath = join(app.getPath("exe"), "..", "receipt.html");
      }
      if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, "utf8");
      }
      return "";
    } catch (error) {
      logger.error("Error reading receipt.html: " + error);
      return "";
    }
  });
`;
if (!mainTs.includes('"getReceiptTemplate"')) {
  mainTs = mainTs.replace('ipcMain.handle("print:html"', templateCode.trim() + '\n\n  ipcMain.handle("print:html"');
}
fs.writeFileSync("src/main/index.ts", mainTs);

// 2. Update preload/index.d.ts
let preloadDts = fs.readFileSync("src/preload/index.d.ts", "utf8");
if (!preloadDts.includes('getReceiptTemplate:')) {
  preloadDts = preloadDts.replace(
    'printHtml: (\n        htmlContent: string,\n      ) => Promise<{ success: boolean; error?: string }>;',
    'printHtml: (\n        htmlContent: string,\n      ) => Promise<{ success: boolean; error?: string }>;\n      getReceiptTemplate: () => Promise<string>;'
  );
  fs.writeFileSync("src/preload/index.d.ts", preloadDts);
}

// 3. Update preload/index.ts
let preloadTs = fs.readFileSync("src/preload/index.ts", "utf8");
if (!preloadTs.includes('getReceiptTemplate:')) {
  preloadTs = preloadTs.replace(
    'printHtml: (htmlContent: string) =>\n    ipcRenderer.invoke("print:html", htmlContent),',
    'printHtml: (htmlContent: string) =>\n    ipcRenderer.invoke("print:html", htmlContent),\n  getReceiptTemplate: () =>\n    ipcRenderer.invoke("getReceiptTemplate"),'
  );
  fs.writeFileSync("src/preload/index.ts", preloadTs);
}

// 4. Update electron-builder.yml
let builderConfig = fs.readFileSync("electron-builder.yml", "utf8");
if (!builderConfig.includes('extraFiles:')) {
  builderConfig += '\nextraFiles:\n  - from: "receipt.html"\n    to: "."\n';
  fs.writeFileSync("electron-builder.yml", builderConfig);
}
