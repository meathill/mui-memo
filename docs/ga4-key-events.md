# GA4 关键事件配置（issue #11 / SEO-21）

代码侧事件已就绪（`apps/web/src/lib/analytics.ts`），但 GA4 的「关键事件」标记必须在界面手动开。开完才能解决「关键事件数为 0」。

## 1. 标记为关键事件（GA4 界面，约 5 分钟）

管理 → 数据收集和修改 → 事件 → 对以下 6 个点「标记为关键事件」：

| 事件 | 含义 | 触发点 |
|---|---|---|
| `sign_up` | 注册成功（推荐事件） | `/register` 成功 |
| `login` | 登录成功（推荐事件） | `/login` 成功 |
| `tutorial_complete` | 走完 onboarding（推荐事件） | onboarding 点完最后一步 |
| `first_task_created` | 首次成功落库一条任务 | 语音 intent 首次出现 `add` effect，全端只发一次 |
| `task_complete` | 任务完成（沿用旧名，保历史） | `/api/tasks/[id]/done` 返回 ok 后 |
| `app_store_click` | 点 App Store 外链 | hero / pricing-free，带 `location` + `landing_path` |

诊断事件不要标：`voice_intent` / `task_delete` / `task_reopen` / `theme_change` / `web_trial_click`。

验证：实时报告（Realtime）里自己走一遍注册 → onboarding → 语音记一条 → 勾完成 → 点 App Store，事件应逐个出现；24 小时后看「互动度 → 事件」，关键事件数 > 0 即闭环。

## 2. 去重规则

- `first_task_created`：`localStorage muimemo:first-task-created` 去重，换设备/清缓存会重发——最终以 DB（tasks/utterances 首条记录）为准复核。
- `sign_up` / `login`：只在服务端返回成功后发一次，loading 态防连点。
- `task_complete`：只在 `/done` 返回 `ok` 后发，乐观更新不发。
- `app_store_click`：每次点击都发（点击侧计数，不去重）。

## 3. App / Web 跨端归因

- Web→App：App Store 会剥离 referrer，GA4 只能看到点击侧。`app_store_click` 自带 `landing_path` + `location`，知道用户从哪个落地页跳走；店内下载/打开以 App Store Connect 为准，两边按日期对齐看趋势，不强求 ID 级对齐。
- 登录后：`identifyUser(userId)` 写 `user_id`，Web 侧同一用户多设备可关联。App 原生侧无 gtag，以服务端 DB（同一 userId 的任务/utterance）为权威，不伪造 App 事件进 GA。
- UTM：外链投放时带 `utm_source/medium/campaign`，GA4 自动归因到会话，`app_store_click` 发生时的会话即带上。

## 4. Consent Mode v2（基础版）

- `layout.tsx` 在 gtag 加载前推 `consent default`：`ad_*` 全部 `denied`，`analytics_storage` 默认 `granted`（产品内分析、privacy 已披露、无广告）。
- 存量选择持久化在 `localStorage muimemo:consent`，`AnalyticsConsent` 挂载后按存量 `update`。
- 需要完整 cookie 横幅时再升级（GDPR 严格场景）：把默认值改 `denied` + 横幅里调 `grantAnalyticsConsent()` / `denyAnalyticsConsent()` 即可，接口已备好。

## 5. Organic Search 复核（不把事件数当用户数）

- 报告 → 获客 → 流量获取：默认渠道分组选 `Organic Search`，次级维度加「着陆页 + 会话来源/媒介」。
- 探索（Explore）→ 自由表格：行 = 着陆页，列 = 关键事件数 + 触发关键事件的用户数（Key users），对比看「哪个落地页带来的注册/首次记录用户最多」。
- 口径：事件数（每次触发都计）≠ 用户数（一人多次完成计多次）。SEO 结论只看用户数列；事件数只用于漏斗定位（比如 `app_store_click` 高但 `sign_up` 低 → 落地页承接问题）。
