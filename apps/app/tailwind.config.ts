import type { Config } from 'tailwindcss';

// MuiMemo · paper 主题（hex/rgb 硬编码版）。
// Web 端 globals.css 里走的是 CSS var + color-mix + oklch，RN 运行时都不支持，
// 所以这里把 paper 主题的派生色统一预计算为 hex。dark / mono 主题后续通过
// 切 tailwind theme / Zustand state 再补。
export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        paper: '#f4ede0',
        'paper-2': '#ece3d2',
        ink: '#1d1a12',
        'ink-soft': '#4a4536',
        'ink-mute': '#7a7266',
        'accent-warm': '#c17a3a',
        'accent-good': '#4a9670',
        'accent-warn': '#d4a450',
        rule: '#d9d0bd',
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
