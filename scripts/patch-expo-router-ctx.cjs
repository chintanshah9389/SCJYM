const fs = require("fs");
const path = require("path");

const routerDir = path.join(__dirname, "..", "apps", "mobile", "node_modules", "expo-router");

const targets = [
  "_ctx.js",
  "_ctx.android.js",
  "_ctx.ios.js",
  "_ctx.web.js",
  "_ctx-html.js",
];

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;

  const original = fs.readFileSync(filePath, "utf8");
  let next = original;

  next = next.replace(/process\.env\.EXPO_ROUTER_APP_ROOT/g, '"../../app"');
  next = next.replace(/process\.env\.EXPO_ROUTER_IMPORT_MODE/g, '"sync"');

  if (next !== original) {
    fs.writeFileSync(filePath, next, "utf8");
    return true;
  }
  return false;
}

let patched = 0;
for (const name of targets) {
  const fullPath = path.join(routerDir, name);
  if (patchFile(fullPath)) patched += 1;
}

if (patched > 0) {
  console.log(`[patch-expo-router-ctx] patched ${patched} file(s).`);
} else {
  console.log("[patch-expo-router-ctx] no changes needed.");
}
