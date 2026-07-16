const fs = require("fs");
let content = fs.readFileSync("src/renderer/src/pages/PageMenu.tsx", "utf8");
content = content.replace(
  "setExpiredCount(expiredRes.data.totalRecords);",
  "setExpiredCount((expiredRes.data as { totalRecords: number }).totalRecords);"
);
fs.writeFileSync("src/renderer/src/pages/PageMenu.tsx", content);
