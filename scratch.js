const fs = require("fs");
let content = fs.readFileSync("src/renderer/src/pages/PageMenu.tsx", "utf8");

// Fix expiredCount
content = content.replace(
  "setExpiredCount((expiredRes.data as { totalRecords: number }).totalRecords);",
  "setExpiredCount((expiredRes.data as any).data?.totalRecords || 0);"
);

// Fix executeAutoConfirm
content = content.replace(
  /const dataRes = res as \{[\s\S]*? payload = dataRes\.data;/m,
  `const dataRes = (res.data as any)?.data;
        const payload = dataRes;`
);

content = content.replace(
  /if \(\s*dataRes\.success &&\s*payload &&\s*payload\.items &&\s*payload\.items\.length > 0\s*\) \{/m,
  `if (
          res.success &&
          payload &&
          payload.items &&
          payload.items.length > 0
        ) {`
);

fs.writeFileSync("src/renderer/src/pages/PageMenu.tsx", content);
