const fs = require("fs");
const path = require("path");

const tsconfigPath = path.join(
  process.cwd(),
  "node_modules",
  "expo-sharing",
  "tsconfig.json"
);

try {
  if (!fs.existsSync(tsconfigPath)) {
    console.log("[patch-expo-sharing-tsconfig] expo-sharing tsconfig not found, skipping.");
    process.exit(0);
  }

  const original = fs.readFileSync(tsconfigPath, "utf8");
  const fixed = original.replace(
    '"extends": "expo-module-scripts/tsconfig.base.json"',
    '"extends": "expo-module-scripts/tsconfig.base"'
  );

  if (fixed === original) {
    console.log("[patch-expo-sharing-tsconfig] No patch needed.");
    process.exit(0);
  }

  fs.writeFileSync(tsconfigPath, fixed, "utf8");
  console.log("[patch-expo-sharing-tsconfig] Patched expo-sharing tsconfig extends path.");
} catch (error) {
  console.warn("[patch-expo-sharing-tsconfig] Failed:", error.message);
  process.exit(0);
}
