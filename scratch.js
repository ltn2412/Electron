const fs = require("fs");

let types = fs.readFileSync("src/shared/types.ts", "utf8");
if (!types.includes("note?: string")) {
  types = types.replace(
    'useOrder(payload: { orderNo: string; staffId: string }): Promise<ApiResponse<Record<string, unknown>>>;',
    'useOrder(payload: { orderNo: string; staffId: string; note?: string }): Promise<ApiResponse<Record<string, unknown>>>;'
  );
  fs.writeFileSync("src/shared/types.ts", types);
}

let preload = fs.readFileSync("src/preload/index.d.ts", "utf8");
if (!preload.includes("note?: string")) {
  preload = preload.replace(
    'useOrder: (payload: { orderNo: string; staffId: string }) => Promise<ApiResponse<Record<string, unknown>>>;',
    'useOrder: (payload: { orderNo: string; staffId: string; note?: string }) => Promise<ApiResponse<Record<string, unknown>>>;'
  );
  fs.writeFileSync("src/preload/index.d.ts", preload);
}

