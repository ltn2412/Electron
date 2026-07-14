const fs = require("fs");

function updateHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  
  // Revert general label and value flex
  html = html.replace(/flex: 0 0 35%;/g, "flex: 0 0 38%;");
  html = html.replace(/flex: 0 0 65%;/g, "flex: 0 0 62%;");
  
  // Make the first row specific
  const targetRow = '<div class="label">Mã đơn hàng /<br/>Order No:</div>\\s*<div class="value">{{ORDER_NO}}</div>';
  const newRow = '<div class="label" style="flex: 0 0 33%;">Mã đơn hàng /<br/>Order No:</div>\n      <div class="value" style="flex: 0 0 67%;">{{ORDER_NO}}</div>';
  
  html = html.replace(new RegExp(targetRow, 'g'), newRow);
  
  fs.writeFileSync(filePath, html);
}

updateHtml("receipt.html");
updateHtml("src/renderer/src/pages/receipt.html");
