# macOS 桌面端方案（决策文档，暂未开工）

> 状态：**只出方案，不开工**。本文给路线对比 + 推荐，供后续排期决策。

## 目标

不是「把 iOS app 搬上 Mac」，而是一个**常驻菜单栏的语音快速捕获工具**：

- 菜单栏（topbar）一个麦克风图标，常驻不占 Dock
- **全局快捷键**（如 ⌥⌘Space，可配）随时唤起一个小的置顶捕获窗
- 说一句 → 走**现有 web 后端的语音意图管线** → 自动建/改/勾任务
- 关掉窗口回到菜单栏待命

这是「能省一秒是一秒」的桌面延伸：不用切到手机、不用打开 app，热键一按就记。

## 为什么不走 Expo / Catalyst

- **managed Expo 不暴露 AppKit**：菜单栏常驻图标（`NSStatusItem`）这类原生能力，managed 工作流根本碰不到。
- **Mac Catalyst 给不了这个体验**：Catalyst 本质是「iPad app 在 Mac 上开窗口跑」。菜单栏常驻 + 全局快捷键要靠 AppKit bundle 插件硬塞，hacky 且受限，与「常驻菜单栏工具」的形态天然不合。

## 路线对比

| 维度 | **Tauri v2（推荐）** | Electron | Mac Catalyst | react-native-macos |
|---|---|---|---|---|
| 菜单栏常驻图标 | ✅ `tray-icon` 一等支持 | ✅ `Tray` 一等支持 | ⚠️ AppKit 插件，hacky | ✅ 原生 `NSStatusItem` |
| 全局快捷键 | ✅ `global-shortcut` 插件 | ✅ `globalShortcut` | ⚠️ 受限/难 | ✅ 原生 |
| 复用现有代码 | ✅ 直接加载 web 客户端 | ✅ 加载 web 客户端 | ✅ 复用 iOS RN 代码 | ⚠️ 部分 RN，但要脱离 Expo |
| 工作量 | 低（包壳 + 两个插件） | 低-中 | 中（Expo 支持粗糙） | 高（脱 Expo、单独维护原生工程） |
| 包体积 | 小（系统 WebView） | 大（自带 Chromium） | 中 | 中 |
| 分发 | Developer ID 公证 `.dmg` / 可上 MAS | 同左 | MAS / Developer ID | MAS / Developer ID |
| 契合「菜单栏快速捕获」 | ✅ 最契合 | ✅ 契合 | ❌ 窗口型 iPad app | ✅ 契合但贵 |

## 推荐：Tauri v2 包壳现有 web 客户端

理由：菜单栏 + 全局快捷键是 Tauri 一等能力；web 客户端（`muimemo.meathill.com`）是当前最成熟的客户端；包壳后**新代码量最小**，后端 + 语音意图闭环全复用。

**架构草图：**
- Tauri v2 app，系统托盘（菜单栏）放麦克风图标
- `global-shortcut` 注册可配热键 → 唤起一个 always-on-top 小窗
- 小窗加载 web 的轻量录入视图（或本地打包的 web 子集）→ 复用现有 intent 管线
- **认证**：复用 web 的 Apple 登录 / better-auth 会话；desktop 走 OAuth 回调（Tauri deep-link）
- **麦克风权限**：Tauri 的 macOS `Info.plist` 加 `NSMicrophoneUsageDescription`
- **分发**：Developer ID 签名 + 公证（已有开发者账号，Team `FNXZ69UX8K`）出 `.dmg`；CI 可用 `tauri-action`

**工作量估算：** 初版约 2-4 天（脚手架 + 托盘 + 全局热键 + 捕获窗 + 签名公证）。

## 待验证的风险

- **WKWebView 录音**：Tauri macOS 用系统 WKWebView，需确认 `getUserMedia` / `MediaRecorder` 在其中可用、麦克风权限提示与原生权限链路顺畅（web 客户端目前的录音方式要实测）。
- **全局热键默认值**：避开系统/常用 app 已占用的组合。

## 待定问题（开工前确认）

- 是否需要离线（无网时能否先记下、联网补传）？
- 是否要本地留存录音文件？
- 是否顺带出 Windows 版（Tauri 跨平台几乎免费，但 Windows 是系统托盘，交互略不同）？
