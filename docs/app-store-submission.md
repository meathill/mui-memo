# App Store 提交资料

> 慢慢提交。这份文档是「直接复制粘贴到 App Store Connect 后台」的素材库 +
> Pre-flight checklist + EAS 命令清单。

## 一、Apple 后台填写

### App 元数据

| 字段 | 内容 |
|---|---|
| **Name (App Store)** | `叨叨记` |
| **Subtitle** (≤30 字符) | `一句话，整理整张清单`（推荐）<br>备选：`语音操控的待办，全程靠说` / `叨叨一句，AI 接手清单` |
| **Bundle ID** | `com.meathill.muimemo` ✅ 已注册 |
| **SKU / ASC App ID** | `6763317433` ✅ 已存在 |
| **Apple Team ID** | `FNXZ69UX8K` |
| **Primary Category** | Productivity（生产力） |
| **Secondary Category**（可选） | Utilities（工具） |
| **Age Rating** | 4+（无受限内容） |

### 关键词（≤100 字符，逗号分隔）

```
语音清单,待办,语音输入,AI助手,提醒,任务,记事,GTD,叨叨,memo,效率,团队
```

### 描述（中文，App Store Connect → App 信息 → 描述 中粘贴）

```
叨叨记 — 一句话，整理整张清单

不只是用语音记录。说一句就能新建、修改、勾完成、找回、拆分。
整个 todo 生命周期，全程靠说。

— AI 不只在录入这一步 —
• 「明天上午 10 点把货单发给高老师」→ 自动建一条
• 「完了转，需要提供快递单号」→ 拆成独立的第二条
• 「把货单改到下午三点」→ 改时间不动文字
• 「物业费搞定了」→ 自动勾掉
• 「上次老张那事」→ 模糊指代也能找回

— 场景过滤 —
在家不显示工作的事，去公司不显示买菜，「下班路上」自动浮上来。
任务只在它该出现的时候出现。

— 适合谁 —
• 经常走路 / 开车 / 做家务时想到事的人
• 不喜欢手动分类、加标签的人
• 嫌 Todoist / 滴答清单太复杂的人
• （即将上线）小团队 / 家庭 / 店铺，把活儿用语音派来派去

— 价格 —
• 免费：每月 120 次 AI 操作，任务管理全功能不限
• Pro ¥6/月（年付 ¥58）：无限 AI + 优先 endpoint
• Team（即将上线）：@ 联系人协作，给小团队 / 家庭用

我们不打算让 AI 替你做事，只想让"记录、整理、找回"
这件事尽量轻——能省一秒就省一秒。
```

### 描述（英文，开美区或国际区时用）

```
MuiMemo - One sentence, the whole list.

Not just voice capture. Speak once to create, modify, complete,
recall, or split tasks. The whole todo lifecycle—done by talking.

— AI beyond capture —
• "Send the inventory to Prof Gao tomorrow 10am" → auto-created
• "Oh, also send the tracking number" → split as a separate task
• "Change the inventory one to 3pm" → time updated, text untouched
• "Property fee is done" → auto-checked
• "That call with Lao Zhang last time" → recalled by fuzzy reference

— Context filters —
At home you don't see work tasks. At work you don't see groceries.
Tasks surface only when they should.

— Pricing —
• Free: 120 AI operations/month, unlimited tasks
• Pro ~$0.99/month: unlimited AI + priority endpoint
• Team (coming): @ your contacts to delegate tasks
```

### 必填 URL

| 字段 | URL |
|---|---|
| **Privacy Policy** | `https://muimemo.meathill.com/privacy` ✅ 已部署 |
| **Support URL** | `https://muimemo.meathill.com/support` ✅ 已部署 |
| **Marketing URL**（选填） | `https://muimemo.meathill.com/` |

### What's New（首次提交可写）

```
v0.2.1 首次发布。

主要功能：
- 语音输入 → AI 解析成结构化任务（时间、地点、优先级）
- 一句话拆多任务、改时间、勾完成
- 场景过滤（在家 / 工位 / 在外）
- 4 档主题（浅色 / 深色 / 极简 / 跟随系统）
- iCloud 账号 · Apple Sign-in
- 原生提醒 · 支持后台触发
```

### 联系信息（App Review 后台）

| 字段 | 内容 |
|---|---|
| First Name | （你的名） |
| Last Name | （你的姓） |
| Email | `redodicer@outlook.com`（已配在 eas.json） |
| Phone | （备一个能接电话的） |

### Demo Account（如果需要审核登录）

```
邮箱：（建一个 reviewer@muimemo.test 之类的测试账号）
密码：（随便强密码）
说明：用 Email + 密码登录，或者直接用「Apple 登录」按钮（
nonce 验签实测能通过 sandbox 账号）。
```

### Notes（给审核员的说明）

```
1. 这个 app 需要麦克风权限来录制语音任务，权限弹窗已说明用途。
2. AI 解析在服务端用第三方 API 完成（小米 MIMO / Google Gemini，
   见 https://muimemo.meathill.com/privacy 「数据会发给哪些第三方」）。
3. Sign in with Apple 同时支持邮箱注册，符合 4.8 准则。
4. v0.2.1 暂未启用付费墙；订阅 / IAP 在下一版本里上线，
   会单独走配置流程。
```

---

## 二、视觉素材（自己做）

### 1024×1024 App Icon

- 文件：[`apps/app/assets/icon.png`](../apps/app/assets/icon.png)（如果还是 512 要重新出 1024）
- 要求：PNG，**不带 alpha 通道**，**不要预先圆角**（Apple 自动加），sRGB

### iPhone 6.9" 截图（必填，至少 3 张，建议 5 张）

- 尺寸：**1320×2868**
- 推荐方案：用 **iPhone 17 Pro Max 模拟器**截图（command+S），文件就在桌面

| # | 内容 | 操作步骤 |
|---|---|---|
| 1 | 主页：今天清单 + 麦克风 | 注册账号 → 录入 3-4 条任务（不同场景）→ 截图 |
| 2 | 录音中：波形动画 | 按住麦克风 2-3 秒，等波形动起来截图 |
| 3 | AI 解析成功 toast | 录一句两件事「明天 10 点开会，下午 3 点接娃」→ 看顶部 toast 截图 |
| 4 | 三按钮确认窗 | 录「把买菜改到下午三点」→ 等弹窗出现截图 |
| 5 | 主题切换 | 「我的」页 → 主题区 4 档展开截图 |

### iPad 截图（选填，没有 supportsTablet 就跳过）

[`app.config.ts`](../apps/app/app.config.ts) 里 `supportsTablet: false`，跳过。

### App Preview 视频（强烈建议但非必填）

- 30 秒以内
- 主要演示「语音解析 → 自动归到清单」的核心动作
- 如果做不出来可以先不传，后续可补

---

## 三、Pre-flight Checklist

在 `eas submit` 之前过一遍：

- [ ] [`apps/app/package.json`](../apps/app/package.json) 的 `version` 已更新（首次 0.2.1 OK）
- [ ] [`eas.json`](../apps/app/eas.json) 的 `appleId` / `ascAppId` / `appleTeamId` 都对（已对）
- [ ] App Store Connect 后台 App 信息表填完（描述 / 关键词 / 隐私 URL / Support URL）
- [ ] 1024 icon 上传完成
- [ ] 5 张 iPhone 6.9" 截图上传完成
- [ ] App Review 联系信息填好
- [ ] Demo Account（如需）配好可登录
- [ ] 隐私问卷（App Privacy）回答完毕：
  - 收集 邮箱 / 用户内容（任务 + 录音）
  - 不用于跟踪 / 广告
  - 与第三方共享：AI provider（MIMO / Gemini）
- [ ] 加密合规：[`app.config.ts`](../apps/app/app.config.ts) `ITSAppUsesNonExemptEncryption: false` ✅ 免问

---

## 四、Build 和 Submit 命令

```bash
cd apps/app

# 构建（远端，约 15-20 分钟，EAS 会发邮件通知）
eas build --platform ios --profile production

# 也可以本地构建，需要 Xcode 配好 signing：
# eas build --platform ios --profile production --local

# 提交最新一次成功的 build 到 App Store Connect
eas submit --platform ios --profile production --latest
```

第一次跑 `eas submit` 会要 App-specific password 或 ASC API key（在 [appleid.apple.com](https://appleid.apple.com/) 生成 app-specific password 即可）。EAS 缓存后续不再问。

提交后通常 24-48 小时内审核反馈。被拒看 [`apps/app/eas.json`](../apps/app/eas.json) 配的 appleId 邮箱（`redodicer@outlook.com`）。

---

## 五、被拒常见原因 + 应对

| 拒因 | 现状 | 应对 |
|---|---|---|
| 4.0 设计 | UI 有完整中文 + 暗色模式 + 主题切换 | 应该过 |
| 5.1 隐私 | 已部署 [/privacy](https://muimemo.meathill.com/privacy)，详细说明数据流 | 上传时把 URL 填对 |
| 4.8 Sign in with Apple | 邮箱 + Apple 双登录 | OK |
| 2.1 完整性 | 录音权限有用途说明 | 已写 [`NSMicrophoneUsageDescription`](../apps/app/app.config.ts) |
| 3.1.2 IAP | v0.2.1 没 IAP，跳过 | 下一版本上 paywall 时再处理 |
| 5.1.1(v) 数据收集 | 没收集广告 ID、不跟踪 | 隐私问卷如实填 |

如果被拒，response 里会写 guideline 编号 + 具体场景。回 Apple 时说明你的修复 / 解释，态度积极通常 1-2 轮可过。

---

## 六、上架后

- App Store Connect 里手动 release（默认是「自动发布」，可以改成「手动」给自己留一个稳定窗口）
- 下载 [Xcode → Window → Devices](xcdevices://) 看 crashes 日志
- 根据真实反馈：
  - 加 case 到 [`intent-prompt.cases.ts`](../apps/web/src/lib/intent-prompt.cases.ts)
  - 调 [`intent-shared.ts`](../apps/web/src/lib/intent-shared.ts) 的 SYSTEM_PROMPT
  - 跑 `pnpm -F @mui-memo/web test:prompt-eval` 验证

---

## 七、未来上 IAP 时要补的物料

到时候配的产品：

| Product ID | 类型 | 价格 | 描述 |
|---|---|---|---|
| `com.meathill.muimemo.pro.monthly` | Auto-Renewable Subscription | ¥6 | 叨叨记 Pro · 月度 |
| `com.meathill.muimemo.pro.yearly` | Auto-Renewable Subscription | ¥58 | 叨叨记 Pro · 年度（省 ¥14） |
| `com.meathill.muimemo.team.monthly` | Auto-Renewable Subscription | ¥18/人 | 叨叨记 Team · 月度（每人） |
| `com.meathill.muimemo.team.yearly` | Auto-Renewable Subscription | ¥168/人 | 叨叨记 Team · 年度（每人） |

订阅组（Subscription Group）名字：`MuiMemo Subscription`

每个产品都要：
- Reference Name（后台用，看你方便）
- 中文 / 英文 Display Name + Description
- 价格 tier
- Family Sharing：建议关（个人订阅）

提交时 IAP 跟 App build 一起审核。
