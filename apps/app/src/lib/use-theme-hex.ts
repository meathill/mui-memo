// 单独的 hook 文件，避免 lib/theme.ts ↔ store/index.ts 形成运行时循环依赖
// （store 已经从 theme 拿 ThemePreference 类型）。

import { useColorScheme } from 'react-native';
import { resolveTheme, THEME_HEX } from '@/lib/theme';
import { useAppStore } from '@/store';

/**
 * 取当前生效主题的 hex 色板，给 lucide 图标 / ActivityIndicator 这些
 * 不吃 className 的 RN 组件用。
 */
export function useThemeHex() {
  const themePref = useAppStore((s) => s.theme);
  const systemScheme = useColorScheme();
  return THEME_HEX[resolveTheme(themePref, systemScheme)];
}
