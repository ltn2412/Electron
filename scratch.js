const fs = require("fs");

function updateHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  
  // Revert general label and value flex
  html = html.replace(/flex: 0 0 38%;/g, "flex: 0 0 42%;");
  html = html.replace(/flex: 0 0 62%;/g, "flex: 0 0 58%;");
  
  fs.writeFileSync(filePath, html);
}

updateHtml("receipt.html");
updateHtml("src/renderer/src/pages/receipt.html");
