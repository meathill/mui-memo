import type { ExpoConfig } from 'expo/config';

/**
 * 动态配置：支持从环境变量覆盖 API base URL。
 *
 * 优先级：
 *   1. `EXPO_PUBLIC_API_BASE`（local dev 跑本机 web 时在 apps/app/.env.local 里写）
 *   2. 生产部署 URL（默认，绝大多数场景不需要改）
 *
 * 为什么默认走远端：朋友们点模拟器 / 真机就能直接用，不必依赖开发机
 * 把 web 跑起来。本地开发 web 时设一下 .env.local 即可。
 */
const PROD_API_BASE = 'https://muimemo.roudan.io';
const apiBase = process.env.EXPO_PUBLIC_API_BASE?.trim() || PROD_API_BASE;

// 类型里还没跟上的字段（比如 newArchEnabled）只能借 as 绕开
const config: ExpoConfig & { newArchEnabled?: boolean } = {
  name: 'MuiMemo',
  slug: 'mui-memo',
  scheme: 'muimemo',
  version: '0.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.meathill.muimemo',
    infoPlist: {
      NSMicrophoneUsageDescription: 'MuiMemo 需要使用麦克风来录制你的语音备忘。',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-audio',
      {
        microphonePermission: '允许 MuiMemo 使用麦克风录制你的语音备忘。',
      },
    ],
    'expo-secure-store',
    // iOS 不需要 google-services，只用 local notifications，配置最简
    'expo-notifications',
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    apiBase,
  },
};

export default config;
