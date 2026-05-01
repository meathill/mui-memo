// 叨叨记 · 主题 token 表。
// Web 端走 CSS var + color-mix + oklch（globals.css），RN 不支持，所以这里把派生色
// 预先算成 RGB 三元组，配合 tailwind.config.ts 里的
// `rgb(var(--color-xxx) / <alpha-value>)` 模板，让 `bg-paper-2/50` 这类 alpha 修饰
// 符继续可用。
//
// 切换主题靠根 View 上的 nativewind `vars()`：选哪套 token，整棵子树跟着变。

export type ThemePreference = 'paper' | 'night' | 'mono' | 'system';
export type ResolvedTheme = 'paper' | 'night' | 'mono';

type TokenSet = Record<string, string>;

// paper —— 温润纸感（沿用现有硬编码 hex 转 RGB，避免视觉回归）
const paper: TokenSet = {
  '--color-paper': '244 237 224',
  '--color-paper-2': '236 227 210',
  '--color-ink': '29 26 18',
  '--color-ink-soft': '74 69 54',
  '--color-ink-mute': '122 114 102',
  '--color-accent-warm': '193 122 58',
  '--color-accent-good': '74 150 112',
  '--color-accent-warn': '212 164 80',
  '--color-rule': '217 208 189',
};

// night —— 深夜纸感
// 底色 / ink 直接取 Web globals.css 的 hex；ink-soft / ink-mute / rule 按
// 同样的 mix 比例预算（72% / 45% / 16%）；accent 取 oklch 在 sRGB 空间的近似 hex。
const night: TokenSet = {
  '--color-paper': '26 24 18',
  '--color-paper-2': '35 32 23',
  '--color-ink': '240 230 210',
  '--color-ink-soft': '180 172 156',
  '--color-ink-mute': '143 134 119',
  '--color-accent-warm': '222 149 96',
  '--color-accent-good': '110 183 138',
  '--color-accent-warn': '232 184 112',
  '--color-rule': '60 57 49',
};

// mono —— 极简黑白（直接照搬 Web globals.css 的 .theme-mono）
const mono: TokenSet = {
  '--color-paper': '250 250 248',
  '--color-paper-2': '241 241 238',
  '--color-ink': '10 10 10',
  '--color-ink-soft': '58 58 58',
  '--color-ink-mute': '122 122 122',
  '--color-accent-warm': '10 10 10',
  '--color-accent-good': '10 10 10',
  '--color-accent-warn': '10 10 10',
  '--color-rule': '217 217 213',
};

export const THEME_TOKENS: Record<ResolvedTheme, TokenSet> = { paper, night, mono };

// RN 组件的 `color` prop（lucide 图标、ActivityIndicator 等）不走 className，
// 不能享受 CSS var 切换，得用真实 hex。下面这套 hex 与 THEME_TOKENS 对应，
// 通过 useThemeHex() 取当前生效主题的那一套。
type HexColors = {
  paper: string;
  paper2: string;
  ink: string;
  inkSoft: string;
  inkMute: string;
  accentWarm: string;
  accentGood: string;
  accentWarn: string;
  rule: string;
};

export const THEME_HEX: Record<ResolvedTheme, HexColors> = {
  paper: {
    paper: '#f4ede0',
    paper2: '#ece3d2',
    ink: '#1d1a12',
    inkSoft: '#4a4536',
    inkMute: '#7a7266',
    accentWarm: '#c17a3a',
    accentGood: '#4a9670',
    accentWarn: '#d4a450',
    rule: '#d9d0bd',
  },
  night: {
    paper: '#1a1812',
    paper2: '#232017',
    ink: '#f0e6d2',
    inkSoft: '#b4ac9c',
    inkMute: '#8f8677',
    accentWarm: '#de9560',
    accentGood: '#6eb78a',
    accentWarn: '#e8b870',
    rule: '#3c3931',
  },
  mono: {
    paper: '#fafaf8',
    paper2: '#f1f1ee',
    ink: '#0a0a0a',
    inkSoft: '#3a3a3a',
    inkMute: '#7a7a7a',
    accentWarm: '#0a0a0a',
    accentGood: '#0a0a0a',
    accentWarn: '#0a0a0a',
    rule: '#d9d9d5',
  },
};

// 启动屏 / Stack contentStyle 等不进 React 树的地方需要单值 hex 兜底
export const THEME_BG_HEX: Record<ResolvedTheme, string> = {
  paper: THEME_HEX.paper.paper,
  night: THEME_HEX.night.paper,
  mono: THEME_HEX.mono.paper,
};

/**
 * 把用户偏好结合系统外观，解析出真正要应用的主题。
 *
 * - `system`：跟随系统的 light / dark；mono 只能手动选，不进入系统跟随逻辑
 * - 其它三个：直接照搬
 *
 * `systemScheme` 用 string-or-null 接 RN useColorScheme() 的返回（含罕见的
 * 'unspecified'），未明确为 dark 都按 light 处理。
 */
export function resolveTheme(pref: ThemePreference, systemScheme: string | null | undefined): ResolvedTheme {
  if (pref === 'system') return systemScheme === 'dark' ? 'night' : 'paper';
  return pref;
}

/** StatusBar 风格：深色主题用浅字，其它用深字。 */
export function statusBarStyle(resolved: ResolvedTheme): 'light' | 'dark' {
  return resolved === 'night' ? 'light' : 'dark';
}
