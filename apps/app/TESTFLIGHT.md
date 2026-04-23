# MuiMemo 第一个 TestFlight 发布手册

> 目标：从零把 MuiMemo 打进 TestFlight，给朋友装上玩。
> 阅读时间 10 分钟，实际跑完 1-2 小时（主要卡在 Apple 后台等审批）。

---

## 0. 账号 & 工具清单

| 需要 | 说明 |
|---|---|
| **Apple Developer Program 账号** | $99/年。`meathill@gmail.com` 如果还没开通就到 https://developer.apple.com/programs/ 付费。 |
| **App Store Connect 登录权** | 用同一个 Apple ID 登 https://appstoreconnect.apple.com — 开通 Dev 账号后会自动有。 |
| **Expo 账号** | 免费。https://expo.dev 注册；`eas-cli` 用它登录。 |
| **eas-cli** | 本地装 `npm i -g eas-cli`。 |
| **macOS 主机** | 你手上这台就行。Xcode 装不装都可以——EAS 是云上打包，不碰你本机。 |

检查一遍：

```bash
eas --version            # ≥ 10.0.0
node -v                  # ≥ 20
pnpm -v                  # ≥ 10
```

---

## 1. Apple Developer 后台：注册 App ID

1. 打开 https://developer.apple.com/account/resources/identifiers/list
2. 右上角 `+`，选 **App IDs** → Continue → **App**
3. 填：
   - **Description**：`MuiMemo`
   - **Bundle ID** → Explicit → `com.meathill.muimemo`（**必须**和 `app.config.ts` 里的 `ios.bundleIdentifier` 完全一致）
4. **Capabilities** 勾：
   - ✅ **Sign In with Apple**（Apple 登录必须）
   - ✅ **Push Notifications**（留着以后用，勾不花钱）
5. 保存。

> ⚠️ 如果 Bundle ID 已被别人占，改一个带你后缀的名字（比如 `com.meathill.muimemo.dev`），同步改 `app.config.ts` 的 `bundleIdentifier`。

---

## 2. App Store Connect：建 App 记录

1. 打开 https://appstoreconnect.apple.com/apps
2. 左上角 `+` → **新建 App**
3. 填：
   - **平台**：iOS
   - **名称**：`MuiMemo`（要改也行，这是 App Store 显示名）
   - **主要语言**：简体中文
   - **Bundle ID**：从下拉选 `com.meathill.muimemo` — 上一步建完后这里就有
   - **SKU**：`muimemo-ios`（自己取，唯一标识，给 Apple 统计用）
   - **用户访问权限**：完全访问
4. 创建完进入 App 页面，**复制地址栏里的 App ID**（是纯数字的，类似 `6738291234`）——下一步要。

---

## 3. 回来填 `eas.json`

编辑 [apps/app/eas.json](./eas.json)：

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "meathill@gmail.com",
      "ascAppId": "6738291234",        ← 上一步复制的数字
      "appleTeamId": "XXXXXXXXXX"      ← 见下一步
    }
  }
}
```

**Team ID** 到 https://developer.apple.com/account 登录后右上角，或者 Membership 页面 —— 10 位字母数字。

提交改动：

```bash
cd apps/app
git add eas.json
git commit -m "chore(app): 填上 TestFlight 真实的 ascAppId / appleTeamId"
git push
```

---

## 4. 登录 Expo + 关联项目

```bash
cd apps/app
eas login                 # 按提示输 Expo 账号 / 密码
eas whoami                # 确认登上了

eas init                  # 首次给这个项目分配 projectId
```

`eas init` 会在 `app.config.ts` 的 `extra` 里写入：

```ts
extra: {
  apiBase,
  eas: { projectId: "xxxx-xxxx-xxxx-xxxx" }
}
```

提交这个改动（`projectId` 要长期稳定）：

```bash
git add app.config.ts
git commit -m "chore(app): eas init 生成 projectId"
git push
```

---

## 5. 第一次 EAS 打包

```bash
cd apps/app
eas build --profile preview --platform ios
```

**第一次跑会交互问几个事**：

1. **注册 Apple 证书？** 选 `Yes, let EAS handle it`——让 EAS 全自动管证书 / profile，省心。需要你输一次 Apple Developer 账号密码。
2. **要 Apple 双因子验证码**：手机会弹一个 6 位码。
3. **是否注册设备？** preview profile 是 internal ad-hoc 分发，得把目标设备的 UDID 登记进 provisioning profile。几个选项：
   - 如果只给自己装：跟着提示 `eas device:create` 扫二维码注册
   - 如果要走 TestFlight（推荐）：改用 `production` profile，**跳过设备注册**，TestFlight 自己管分发

**推荐直接上 TestFlight 流**：

```bash
eas build --profile production --platform ios
```

`production` profile 不需要 UDID，打出来的 `.ipa` 能直接传 TestFlight。等 20-30 分钟，云上编译完你会收到邮件 + 终端里链接。

---

## 6. 提交到 TestFlight

```bash
eas submit --profile production --platform ios --latest
```

`--latest` 自动用上一步最新的 build。几分钟内 EAS 把 ipa 传到 App Store Connect。

到 https://appstoreconnect.apple.com → 你的 App → **TestFlight** tab：
- 新 build 会在「iOS」列表里，状态先是「处理中」（Apple 跑病毒扫 + ipa 校验，5-30 分钟）
- 处理完状态会变「缺少合规信息」—— 点进去回答一个「是否使用非豁免加密？」选 **不**（我们 app.config.ts 里已经声明 `ITSAppUsesNonExemptEncryption: false` 省这步，但首版偶尔还会问）

---

## 7. 邀请朋友测试

### 7.1 加测试员

App Store Connect → TestFlight → 左侧「内部测试」→ 点「测试员」右上角 `+`：

- **内部测试**：必须是 App Store Connect 里的成员（你团队的 Apple ID），**免审核**立即可装
- **外部测试**：朋友的 Apple ID 邮箱就行，**首版要过一轮 Apple Beta Review**（通常一天内）

**朋友少的话推荐内部**：App Store Connect → 用户和访问 → 邀请朋友 Apple ID 加入你团队（角色选「开发者」或「Marketing」都行），之后加到内部测试员。

### 7.2 朋友装 TestFlight

1. App Store 里装 **TestFlight** app
2. 打开邀请邮件里的链接，或者用兑换码
3. 装完第一次打开会看你 app.config.ts 里的 `NSMicrophoneUsageDescription` 文案—— 这一步就是你跟他们说「来对着 Mic 说话」的关键

---

## 8. 迭代：改代码后怎么推

两种更新渠道：

### 8.1 只改 JS / 资源 → OTA（几秒钟）

```bash
eas update --channel production --message "修了字号"
```

用户下次打开 app 自动拉新 bundle，不用重装。**前提**：`runtimeVersion` 没变（我们设的 `{ policy: 'appVersion' }`，只要 `app.config.ts` 里 `version` 没改，OTA 生效）。

### 8.2 改了原生（新增 expo-* 包、改权限、改 bundle id）→ 重新打包

```bash
# 1. 升 version: 0.0.1 → 0.0.2（app.config.ts）
# 2. 重新打包
eas build --profile production --platform ios
eas submit --profile production --platform ios --latest
```

朋友从 TestFlight 点「更新」。

---

## 9. 常见翻车点

| 现象 | 原因 | 修法 |
|---|---|---|
| `eas build` 报 "bundle identifier mismatch" | `app.config.ts` 和 Apple Dev 后台 App ID 不一致 | 对齐两边 |
| TestFlight 上 build 卡「处理中」超 1 小时 | Apple 扫描慢 / 卡在合规问题 | 看邮件，或 App Store Connect 顶栏通知 |
| 朋友装了打开白屏 | `EXPO_PUBLIC_API_BASE` 没在 eas.json 的 env 里设置对 | 我们已经在 preview / production profile 里写了 `https://muimemo.roudan.io`，默认 OK |
| Apple 登录点了没反应 | App ID 没开 Sign In with Apple capability | Apple Dev 后台 App ID → Edit → 勾 Sign In with Apple → 保存 |
| 通知不响 | TestFlight 装的时候拒过权限 | 系统设置 → MuiMemo → 通知 → 打开；Profile 页的「到点提醒」卡片也能引导 |
| `eas submit` 报 "app version already exists" | 上次 build 的 version 没递增 | 升 `app.config.ts` 里的 `version`，或者在 eas.json production profile 加 `"autoIncrement": "buildNumber"` （我们已经设了 `autoIncrement: true`，默认升 buildNumber）|

---

## 10. 速查（收藏用）

```bash
# 本地联调（web 必须跑在 :3200）
cd apps/web && pnpm dev &
cd apps/app && echo "EXPO_PUBLIC_API_BASE=http://<LAN-IP>:3200" > .env.local && pnpm dev

# 打 TestFlight
cd apps/app
eas build --profile production --platform ios          # 编译 ipa
eas submit --profile production --platform ios --latest # 上传 App Store Connect

# OTA 热更（JS-only 改动）
eas update --channel production --message "bug fix"

# 看 build 历史
eas build:list --platform ios --limit 5

# 取消一个卡住的 build
eas build:cancel
```

---

## 11. 下一步（不在这次流程里，列给你心里有数）

- **正式上架 App Store**：TestFlight 跑稳了再走 `App Review`。需要 **截图 / 描述 / 隐私政策链接 / 支持 URL**。
- **推送通知**：我们留了 APNs 能力，但服务端还没接远程推。Live Activity / 动态岛录音反馈也在这条路上。
- **真正的 Siri App Intents**：要 eject Expo managed workflow 写 Swift，单独开一轮。
