# 素材说明

icon / splash 是从 [brand/](./brand/) 里的 SVG 用 `pnpm icons:generate` 渲出来的 PNG，源是 SVG，PNG 也提交到 git（EAS build / 工具链都直接读 PNG，省得每次 install 都跑 sharp）。

## 改 logo 怎么做

1. 改 [brand/icon.svg](./brand/icon.svg) 或 [brand/splash-logo.svg](./brand/splash-logo.svg)
2. 跑 `pnpm --filter @mui-memo/app icons:generate`
3. `assets/icon.png` `icon-maskable.png` `splash.png` 自动重生
4. `git add assets/*.png` 一起提

## 文件 / 尺寸

| 文件 | 尺寸 | 用途 | 说明 |
|---|---|---|---|
| `brand/icon.svg` | 512×512 viewBox | iOS app 图标的源 | 跟 web 共用同一套，folded-corner 卡片设计 |
| `brand/icon-maskable.svg` | 512×512 | Android 自适应预留 | 内圈安全区收紧 |
| `brand/splash-logo.svg` | 512×512 | 启动图中心 logo | 透明背景，paper 色由 app.config.ts 填 |
| `icon.png` | 1024×1024 | `app.config.ts` `icon` 字段 | iOS 不能透明，sharp `flatten` 兜 paper 底 |
| `icon-maskable.png` | 1024×1024 | 后续 Android 用 | 现在没引用 |
| `splash.png` | 1024×1024 | `splash.image` | 透明，配 `splash.backgroundColor: '#f4ede0'` |

## 设计语言

- **paper** `#f4ede0` / `#e7d7c1` —— 米黄纸感主色，温润
- **ink** `#1d1a12` —— 主字 / 主形状
- **accent-warm** `#c17a3a` —— 折角 / 强调
- **rule** `#cebea5` —— 卡片描边

`M` 字形按 web 站 [apps/web/public/brand/](../../../apps/web/public/brand/) 的 svg 抠出来的，保持跨端识别一致。
