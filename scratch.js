const fs = require("fs");
let content = fs.readFileSync("src/main/index.ts", "utf8");

const handler = `
  ipcMain.handle(
    "hoangvan:deleteOrder",
    async (_, { transact }: { transact: number }) => {
      try {
        return await OrderService.deleteOrder(transact);
      } catch (error: any) {
        const errStr = error instanceof Error ? error.message : "";
        logger.error(\`IPC Handler Error: \${errStr || JSON.stringify(error)}\`, { error });
        return { success: false, error: errStr || JSON.stringify(error) };
      }
    },
  );
`;

// Insert it right after the hoangvan:confirmExpiredOrders handler
const insertPoint = content.indexOf('ipcMain.handle("order:create"');
if (insertPoint !== -1) {
  content = content.substring(0, insertPoint) + handler + "\n  " + content.substring(insertPoint);
  fs.writeFileSync("src/main/index.ts", content);
}
