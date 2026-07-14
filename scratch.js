const fs = require("fs");
let content = fs.readFileSync("electron-builder.yml", "utf8");
content = content.replace(/extraFiles:\n  - from: "receipt\.html"\n    to: "\."/g, "");
fs.writeFileSync("electron-builder.yml", content);
