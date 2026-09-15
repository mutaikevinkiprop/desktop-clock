const fs = require("fs");
const p = "tools/generate-icons.cjs";
let s = fs.readFileSync(p, "utf8");
const before = '  ["StoreLogo.png", 50],';
const after  = '  ["StoreLogo.png", 300],';
if (!s.includes(before)) { console.error("PATTERN NOT FOUND"); process.exit(1); }
s = s.replace(before, after);
fs.writeFileSync(p, s);
console.log("StoreLogo size -> 300");
