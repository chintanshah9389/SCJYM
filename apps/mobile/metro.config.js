// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Expo Router relies on require.context support in Metro.
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// 1. Watch the monorepo root so Metro picks up shared packages
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from:
//    a) the app's own node_modules first
//    b) then the monorepo root node_modules (where babel-preset-expo lives)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
