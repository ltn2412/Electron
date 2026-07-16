const fs = require("fs");

// 1. PageLogin.tsx
let login = fs.readFileSync("src/renderer/src/pages/PageLogin.tsx", "utf8");
login = login.replace(
  'if (result?.success && result?.data) {',
  `if (result?.success && result?.data) {
        localStorage.setItem("employeeSwipe", password);`
);
fs.writeFileSync("src/renderer/src/pages/PageLogin.tsx", login);

// 2. PageMenu.tsx
let menu = fs.readFileSync("src/renderer/src/pages/PageMenu.tsx", "utf8");
menu = menu.replace(
  /const swipe = localStorage\.getItem\("employeeSwipe"\) \|\| "221278";/g,
  'const swipe = localStorage.getItem("employeeSwipe") || "";'
);
fs.writeFileSync("src/renderer/src/pages/PageMenu.tsx", menu);

// 3. PageExpiredOrders.tsx
let expired = fs.readFileSync("src/renderer/src/pages/PageExpiredOrders.tsx", "utf8");
expired = expired.replace(
  /const swipe = localStorage\.getItem\("employeeSwipe"\) \|\| "221278";/g,
  'const swipe = localStorage.getItem("employeeSwipe") || "";'
);
fs.writeFileSync("src/renderer/src/pages/PageExpiredOrders.tsx", expired);
