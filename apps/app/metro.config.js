// Expo + pnpm monorepo Metro 配置。
// 关键点：watchFolders 覆盖到 monorepo 根；nodeModulesPaths 同时能找到 apps/app 和根的依赖。
//
// pnpm 在每个虚拟 store 目录（.pnpm/<pkg>@<ver>_<hash>/node_modules/）放当前包 + 它自己
// 的 transitive sibling deps（@expo/metro-runtime → @expo/log-box；reanimated → semver@7.x）。
// 让 metro 沿 symlink 真实路径走 hierarchical lookup，就能命中这些 sibling。
// 不能加 `.pnpm/node_modules`：那里有些 transitive 是 hoist 的"幸运儿"老版本（如 semver 6.3.1），
// 反而会盖住每个虚拟 store 里对的版本。
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enableSymlinks = true;

module.exports = withNativeWind(config, { input: './src/global.css' });
