const fs = require('fs');
let content = fs.readFileSync('/home/ltn2412/.gemini/antigravity/brain/a8f0b02f-f65f-4bf7-a0ea-e2563d1a6cc4/task.md', 'utf8');
content = content.replace(/- \[ \]/g, '- [x]');
fs.writeFileSync('/home/ltn2412/.gemini/antigravity/brain/a8f0b02f-f65f-4bf7-a0ea-e2563d1a6cc4/task.md', content);
