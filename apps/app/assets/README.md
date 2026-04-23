# 素材说明

当前 app 走的是 **Expo 默认图标 + paper 色纯色 splash**，TestFlight 跑得起来但图标还是白底 E。上正式 App Store 前最好补两张图：

## 文件清单

| 文件 | 尺寸 | 用途 |
|---|---|---|
| `icon.png` | 1024×1024，PNG，**无透明通道**（Apple 要求） | app 图标；`app.config.ts` 里引 `icon: './assets/icon.png'` |
| `splash.png` | 1242×2688（中心放 logo 就够，其余透明） | 启动图 logo；`splash.image` |
| `adaptive-icon.png` | 1024×1024 | Android 自适应图标（将来跨端）|

## 出图建议

- **主视觉**：`#1d1a12`（ink）做前景，`#f4ede0`（paper）做背景
- **icon**：居中 30-50% 占比一个字形 / 符号，四周留白（Apple 圆角会切掉 ~18%）
- **splash**：中心同 logo，配 `app.config.ts` 里 `splash.backgroundColor: '#f4ede0'`，`resizeMode: 'contain'` 保证不同屏占比都能放下

## 加回 app.config.ts

```ts
splash: {
  backgroundColor: '#f4ede0',
  resizeMode: 'contain',
  image: './assets/splash.png',   // 放开这行
},
icon: './assets/icon.png',        // 跟 splash 同级
```

Figma / Sketch 出图后丢到这个目录就行，`eas build` 会自动打进包里。
