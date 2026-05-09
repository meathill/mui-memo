import type { Config } from 'tailwindcss';

// 颜色用 `rgb(var(--color-xxx) / <alpha-value>)` 模板，配合根 View 上 nativewind `vars()`
// 注入的主题 token（见 src/lib/theme.ts）实现运行时切主题。alpha 修饰符（`/50`、`/60`、`/15` 等）
// 仍可用，Tailwind 会用 <alpha-value> 占位符替换。
//
// 三套主题（paper / night / mono）在 src/lib/theme.ts 里维护，这里只声明 token 名。
export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        'paper-2': 'rgb(var(--color-paper-2) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--color-ink-soft) / <alpha-value>)',
        'ink-mute': 'rgb(var(--color-ink-mute) / <alpha-value>)',
        'accent-warm': 'rgb(var(--color-accent-warm) / <alpha-value>)',
        'accent-good': 'rgb(var(--color-accent-good) / <alpha-value>)',
        'accent-warn': 'rgb(var(--color-accent-warn) / <alpha-value>)',
        rule: 'rgb(var(--color-rule) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['System', 'sans-serif'],
        mono: ['Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
      },
    },
  },
  plugins: [],
} satisfies Config;
