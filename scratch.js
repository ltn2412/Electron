const fs = require('fs');
let content = fs.readFileSync('src/main/services/HoangVanService.ts', 'utf8');

// Ensure hvPollLogger is imported
if (!content.includes('hvPollLogger')) {
  content = content.replace('import { hvLogger } from "@/main/utils/logger";', 'import { hvLogger, hvPollLogger } from "@/main/utils/logger";');
}

// In getExpiredOrders, replace hvLogger with hvPollLogger
const startGetExpiredOrders = content.indexOf('async getExpiredOrders');
if (startGetExpiredOrders !== -1) {
  let bracketCount = 0;
  let i = content.indexOf('{', startGetExpiredOrders);
  bracketCount++;
  i++;
  while (i < content.length && bracketCount > 0) {
    if (content[i] === '{') bracketCount++;
    else if (content[i] === '}') bracketCount--;
    i++;
  }
  const endGetExpiredOrders = i;
  let code = content.substring(startGetExpiredOrders, endGetExpiredOrders);
  code = code.replace(/hvLogger\.info/g, 'hvPollLogger.info');
  code = code.replace(/hvLogger\.error/g, 'hvPollLogger.error');
  content = content.substring(0, startGetExpiredOrders) + code + content.substring(endGetExpiredOrders);
}

// In getSlots, replace hvLogger with hvPollLogger
const startGetSlots = content.indexOf('async getSlots');
if (startGetSlots !== -1) {
  let bracketCount = 0;
  let i = content.indexOf('{', startGetSlots);
  bracketCount++;
  i++;
  while (i < content.length && bracketCount > 0) {
    if (content[i] === '{') bracketCount++;
    else if (content[i] === '}') bracketCount--;
    i++;
  }
  const endGetSlots = i;
  let code = content.substring(startGetSlots, endGetSlots);
  code = code.replace(/hvLogger\.info/g, 'hvPollLogger.info');
  code = code.replace(/hvLogger\.error/g, 'hvPollLogger.error');
  content = content.substring(0, startGetSlots) + code + content.substring(endGetSlots);
}

fs.writeFileSync('src/main/services/HoangVanService.ts', content);
