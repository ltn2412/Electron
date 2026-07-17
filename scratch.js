const fs = require("fs");

let types = fs.readFileSync("src/shared/types.ts", "utf8");
types = types.replace(
  'useOrder(payload: { orderNo: string; staffId: string; note?: string }): Promise<ApiResponse<Record<string, unknown>>>;',
  'useOrder(payload: { orderNo: string; staffId: string }): Promise<ApiResponse<Record<string, unknown>>>;'
);
fs.writeFileSync("src/shared/types.ts", types);

let preload = fs.readFileSync("src/preload/index.d.ts", "utf8");
preload = preload.replace(
  'staffId: string;\n        note?: string;',
  'staffId: string;'
);
fs.writeFileSync("src/preload/index.d.ts", preload);
