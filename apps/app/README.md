# @mui-memo/app

MuiMemo 的 iOS 客户端（Expo SDK 55 + expo-router + NativeWind v4）。

## 本地开发

```bash
pnpm install                          # 装 monorepo 全量依赖（首次）
cd apps/app
npx expo start                        # 等同 pnpm dev
# 按 i 打开 iOS 模拟器；按 s 切到 Expo Go
```

**API 指向**：默认打生产 `https://muimemo.roudan.io`。想连本机 web（`apps/web`，端口 3200）：

```bash
cp .env.example .env.local
# 编辑 .env.local，填 EXPO_PUBLIC_API_BASE=http://<LAN-IP>:3200
```

改完**重启 expo**（app.config.ts 的 extra 是启动时注入，不会热更）。

## 打包与分发（EAS Build）

> 首次发 TestFlight 跟 [TESTFLIGHT.md](./TESTFLIGHT.md) 走，里面一步一步截图可跟。
> 下面只放日常速查。

配置文件：[eas.json](./eas.json)。三个 profile：

| profile | 用途 | 分发方式 |
|---|---|---|
| `development` | 带调试器，连 Metro | internal（ad-hoc） |
| `preview` | 完整打包、internal 测试 | internal → 能直接装 .ipa |
| `production` | TestFlight / App Store | store |

### 首次前置

1. **eas-cli 登录**：`npm i -g eas-cli && eas login`
2. **关联项目**：`eas init`（在 `apps/app` 目录里跑）——会在 `app.config.ts` 写回 `extra.eas.projectId`
3. **App ID 配置**（Apple Developer 后台）
   - 创建 App ID `com.meathill.muimemo`
   - 开启 Capabilities: **Sign In with Apple**、**Push Notifications**（后续远程推有用）
4. **App Store Connect**：新建 App 填 bundle id 对齐；拿到数字形态的 `ascAppId` 填回 [eas.json](./eas.json)
5. **Team ID**：从 Apple Developer 账号页面拿，填回 [eas.json](./eas.json)

### 常用命令

```bash
# 打模拟器跑的包（不上 App Store）
eas build --profile development --platform ios

# TestFlight 内测
eas build --profile preview --platform ios

# 上架用
eas build --profile production --platform ios

# 自动 submit（要先跑 production build）
eas submit --profile production --platform ios

# OTA JS 补丁（runtimeVersion 不变时生效）
eas update --channel production
```

### runtimeVersion 约定

用 `{ policy: 'appVersion' }`：同一个 `version`（比如 `0.0.1`）内可以 `eas update` 热推 JS；
改动原生模块（新增 expo-* 原生依赖、改权限、换 bundle id）必须升 `version` → 重打包。

## 目录约定

```
src/
  app/                  # expo-router 路由
    (auth)/             # 未登录屏
    (main)/             # 登录后
      (tabs)/           # 底部四 Tab
      tasks/[id]/       # 详情 + 编辑
  components/           # 跨屏组件
    memo/               # 业务 domain
    error-banner.tsx
    apple-sign-in-button.tsx
    audio-play-button.tsx
  lib/
    api.ts              # 所有后端调用在这一个文件
    session.ts          # 登录态 + SecureStore
    notifications.ts    # 本地定时提醒 reconcile
  store/index.ts        # zustand global state
```

## 相关约定

更多基建决策见 repo 根的 [DEV_NOTE.md](../../DEV_NOTE.md) 「iOS App」章节。
