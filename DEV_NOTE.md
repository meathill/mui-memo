# 开发笔记

长期关注的基建、框架知识、决策备忘录。面向 3 个月后入职的同事：看完能理解「为什么」，不只是「是什么」。

## 版本号约定

- `apps/web/package.json` 的 `version` 在构建时由 `apps/web/next.config.ts` 通过 `env.NEXT_PUBLIC_APP_VERSION` 注入客户端 bundle
- 「我的」页面底部展示当前版本号，方便与用户沟通线上问题
- 每次迭代合入前手动调升：bug 修复 **patch**、功能 **minor**、破坏性变更 **major**
- 不做自动化（changesets 等），保持简洁

## TiDB：Auto-Embedding + 混合搜索

**核心决策（2026-04）**：不再手动调 Gemini embedding；`tasks.embedding` 是 TiDB 生成列，DB 自己维护。

```sql
embedding VECTOR(1024)
  GENERATED ALWAYS AS (EMBED_TEXT('tidbcloud_free/amazon/titan-embed-text-v2', `text`)) STORED
```

- 模型 `tidbcloud_free/...` 是 TiDB 免费托管的入口，零外部 key、零并发限流
- 维度 1024（最初用 Gemini text-embedding-004 是 768，切换时删了整张表重建）
- 应用层只写 `text`，embedding 自动填。`NewTaskRow` 里不要出现 embedding 字段

**混合搜索**（[apps/web/src/lib/search.ts](apps/web/src/lib/search.ts)）：
- `fts_match_word(q, text)` 走 TiDB 全文索引 + `VEC_EMBED_COSINE_DISTANCE` 走向量，各取 Top-K=8
- TS 侧用 RRF 合并：`score = weight / (K + rank + 1)`，K=60，fts weight=1.2 > vec weight=1.0
- **VEC_ONLY_MAX_DIST = 0.75**：纯向量命中要求距离 ≤ 0.75，否则视为无关。Titan embed-v2 实测：中文语义相似 ≈ 0.66，完全无关 ≥ 0.85，0.75 留足间距
- fts 是 TiDB 的 early-stage 特性，部分 region 可能没开；失败时回退 LIKE

## TiDB：生成列不能用 ALTER 添加

- 想把现有 `tasks.embedding` 从普通列改为 `GENERATED ALWAYS AS (...) STORED` 时，`ALTER TABLE ... ADD COLUMN ... STORED` 报错 3106 `Adding generated stored column through ALTER TABLE`
- 解决：建 `tasks_new` 带生成列，`INSERT INTO tasks_new SELECT ... FROM tasks`，`DROP TABLE tasks`，`RENAME tasks_new TO tasks`。迁移 SQL 见 `apps/web/drizzle/` 对应版本

## TiDB：TIMESTAMP 秒精度

- `created_at` / `completed_at` 等默认是 `TIMESTAMP`，精度到秒
- 游标分页 `WHERE completed_at < ? OR (completed_at = ? AND id < ?)` 在同一秒大量插入时会跳过记录
- 目前通过 id 做 tiebreaker 兜底。**e2e 测试里**同秒创建多任务会产生歧义，测试 case 加 `await page.waitForTimeout(1100)` 是 workaround
- 真要精确可以升级到 `TIMESTAMP(6)`，但 TiDB 对生成列索引/比较函数的支持要再验证

## Better-Auth：baseURL 来源

- Better-Auth 需要 `baseURL` 来校验 `trustedOrigins`、种 cookie domain
- Cloudflare Workers 运行时**不注入 wrangler vars 到 `process.env`**——只能通过 `getCloudflareContext().env` 拿
- 但 Playwright / Next dev 又只认 `process.env`
- 当前策略：`process.env.BETTER_AUTH_URL` 优先（覆盖 dev/e2e），其次 `env.BETTER_AUTH_URL`（prod）。见 [apps/web/src/lib/auth.ts](apps/web/src/lib/auth.ts)
- 缺失时登录看似成功但 cookie 不回种，表现为请求 401 循环

## OpenNext + Cloudflare Workers 构建

- **不要**让 `build` 脚本调 `opennextjs-cloudflare build`——后者内部会再调 `npm run build`，递归。已踩过
- 现行 `apps/web/package.json`：
  - `build` = `pnpm -F shared build && next build`（普通 SSR 构建）
  - `cf-build` = `opennextjs-cloudflare build`（打 Worker bundle）
  - `deploy` = `cf-build + wrangler deploy`
- `shared` 必须先 build，因为 `apps/web` 通过 workspace 消费其 `dist/` 产物（不是源码）

## Cloudflare Workers：`waitUntil` 预算

- Workers 对后台任务总时长有隐式上限，跑太久会被 cancel
- 反面例子：以前 `backfillEmbeddings` 串行 8× Gemini 调用挂 `waitUntil`，经常被砍
- 切 TiDB auto-embedding 后这段逻辑整体移除了。未来如果要挂后台任务：`Promise.allSettled` + 限并发 ≤ 4，单任务 < 1s

## R2：所有 key 强制 `muimemo/` 前缀

- 公共 bucket `roudan-io` 多项目共用
- 约定：所有 put/delete/fetch 都加 `muimemo/` 前缀。写入端在 `apps/web/src/lib/audio.ts` / `attachments.ts` 统一拼装
- 资源公开回放靠 `NEXT_PUBLIC_ASSETS_URL` 环境变量，格式 `https://<host>/<path>`，前端拼 `${ASSETS_URL}/${key}`

## Cloudflare 类型：用 `wrangler types`，不装 `@cloudflare/workers-types`

- 2026-04 曾试过把 `@cloudflare/workers-types` 当 devDep 装进 `apps/web`，pnpm 按 peer-dep 上下文给 drizzle-orm 另起一份实例（`drizzle-orm_@cloudflare+workers-types_..._hash`），和 `packages/shared` 的 drizzle 实例分裂，所有 `eq(tasksTable.userId, ...)` 报 TS 错。`overrides` / `public-hoist-pattern` / shared 也装一份——都因 peer hash 不同无效
- 结论：**改用 wrangler 自带的类型生成能力**（wrangler 4 起内置 runtime types，不依赖 `@cloudflare/workers-types` npm 包）
- 脚本 `pnpm cf-typegen`（= `wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts`）：根据 `wrangler.toml` 里的 bindings 自动生成 `CloudflareEnv`，同时带上 R2Bucket / Fetcher 等 runtime 类型
- 加/改 binding → 跑 `pnpm cf-typegen` → 提交生成文件。不要手动编辑 `cloudflare-env.d.ts` 里由 wrangler 生成的段落

## Gemini：走 AI Gateway

- 用 `@google/genai` SDK（不是老的 `@google/generative-ai`）
- 通过 `httpOptions.baseUrl` 指到 Cloudflare AI Gateway：`https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/{CF_AI_GATEWAY_ID}/google-ai-studio`
- SDK 内部会自动补 `/v1beta/models/...`
- 主模型 `gemini-3-flash-preview`（多模态，直接吃音频 base64）；早期 `gemini-2.0-flash` 已下线

## Next.js 16 (App Router) 要注意

- `params` / `headers` / `cookies` 都是 **Promise**，必须 `await`
- `(app)/layout.tsx` 整体标了 `export const dynamic = 'force-dynamic'`，避免 session 被错误缓存
- 新增 route handler 前**先读 `node_modules/next/dist/docs/01-app/` 相关章节**，别凭记忆写

## Prompt：时间字段必须宁缺毋滥

- Gemini prompt 里反复强调：用户原话没明确时间词（具体时刻 / 日期 / 相对期限）就**不要**填 `expectAt` / `dueAt`
- 过期任务在 UI 里会变红；AI 擅自填时间 → 用户看到「莫名其妙过期的」任务，体验比「没时间」差得多
- 规则表格和反面样例都写在 prompt 里（见 [apps/web/src/lib/gemini.ts](apps/web/src/lib/gemini.ts)）。改 prompt 时保留这段

## 删除任务：级联清理

- `DELETE /api/tasks/[id]` 要清 4 处：
  1. attachments DB 行
  2. attachments 对应的 R2 对象
  3. utterances 表里 task_id 置空（保留语音历史，去掉悬挂指针）
  4. 任务自己的 audioKey 对应 R2 对象 + 任务行
- R2 delete 用 `Promise.allSettled`，单个失败不阻塞 DB 已清的语义

## iOS App（apps/app · Phase 2 起步）

**脚手架**：Expo SDK 55 + expo-router + TypeScript。手工搭，没跑 `create-expo-app`，所以装完依赖后第一次要 `cd apps/app && npx expo install --fix` 校准版本。

**API base 默认远端**：[apps/app/app.config.ts](apps/app/app.config.ts) 把 `extra.apiBase` 默认指到生产部署 `https://muimemo.roudan.io`。朋友拿到模拟器 / 真机点开就能用，不依赖开发机。**本地开发**想指到自己 web 的话，在 `apps/app/.env.local` 里写 `EXPO_PUBLIC_API_BASE=http://<LAN-IP>:3200`（别用 localhost——真机 / 模拟器走不到宿主 loopback）。改完要重启 `expo start`，extra 是启动时注入不热更。

**Web dev 端口约定 3200**：`apps/web/package.json` 的 dev 脚本是 `next dev --port ${PORT:-3200}`。改这个是因为 3000 经常被 react-email / 其他项目占。Playwright webServer 走 `PORT=3100` 不受影响。`.dev.vars` 里的 `BETTER_AUTH_URL` 也要对齐到 `http://localhost:3200`，否则登录 cookie 种错。

**鉴权 · Bearer**：Better-Auth 在 [apps/web/src/lib/auth.ts](apps/web/src/lib/auth.ts) 开了 `bearer()` plugin。RN 端登录后拿到 `Authorization: Bearer <token>` 存进 `expo-secure-store`，之后所有请求带这个 header。Web 仍走 cookie，两条路并存。

**Sign in with Apple · 纯原生流**：iOS 端用 `expo-apple-authentication` 走系统 UI，拿到 `identityToken` 直接打 Better-Auth 的 `POST /api/auth/sign-in/social`（`provider: 'apple', idToken: { token, nonce, user }`）。Better-Auth 内部拉 `https://appleid.apple.com/auth/keys` 验签 + 校 `aud`，通过就创 / 登 user 并返回 bearer token。
- nonce 本地生成明文，SHA-256 后交给 Apple，原文一起发给后端比对，防 replay
- Better-Auth 的 apple provider `clientId` 和 `appBundleIdentifier` 都传 `com.meathill.muimemo`（Xcode bundle id）
- 不走 Web OAuth 回调 → 不需要 `clientSecret`、不需要 .p8 / teamId / keyId
- `fullName` 只在首次授权时有值，Apple 不会再给第二次（想恢复 → 系统设置 Apple ID → Apps Using Apple ID → MuiMemo → 停止使用）
- App Store 上架硬性要求：只要接了其它第三方登录就得同时接 Apple（4.8 条款）

**Metro + pnpm monorepo**：[apps/app/metro.config.js](apps/app/metro.config.js) 里 `watchFolders` 指向 repo 根，`nodeModulesPaths` 同时加 `apps/app/node_modules` 和根 `node_modules`，`disableHierarchicalLookup: true`。少一项都会 bundle 挂。

**⚠️ 根 `.npmrc` 必须设 `node-linker=hoisted`**：Expo / RN 生态大量 peer dep（`react-native-web` / `react-native-css-interop` / `whatwg-fetch` / `@expo/metro-runtime` …）在 pnpm 默认隔离下 Metro 穿透 `.pnpm` 路径后找不到兄弟依赖，`expo-router` 的 entry 一进来就 resolve 失败。hoisted linker 把整个 workspace 扁平化为 npm 布局，一劳永逸。对 apps/web (Next.js) 和 packages/shared (tsup) 无副作用。实测已 iOS bundle 通过（3.8MB hbc）。

**NativeWind v4**：RN 不支持 CSS 变量，Web 的 `globals.css` 走 `color-mix` + `oklch` + var 那套完全没法运行时解析。所以 [apps/app/tailwind.config.ts](apps/app/tailwind.config.ts) 把 paper 主题的 token 预计算成 hex 硬编码。dark / mono 主题后续再补 JS 侧的 theme switch。

**Shared 包的雷区**：`apps/app` 只许 import `@mui-memo/shared/validators` 和 `@mui-memo/shared/logic`。`@mui-memo/shared/schema` 拖着 drizzle-orm + TiDB 驱动，Metro 不认，一碰就 bundle 失败。review 代码时搜一遍确认没有。

**音频格式**：Web MediaRecorder 默认 `audio/webm;codecs=opus`，iOS `expo-audio` 默认 `.m4a`。[apps/web/src/app/api/intent/route.ts](apps/web/src/app/api/intent/route.ts) 的 R2 扩展名分支已同时覆盖 webm / m4a / wav。Gemini 对两种格式都能识别，实测 m4a 联调成功。

**图标库**：`lucide-react-native` + `react-native-svg` 对齐 Web 的 `lucide-react`。peer 依赖 `buffer` 要显式装（react-native-svg 的 `fetchData.ts` 用），否则 bundle 报 `Unable to resolve module buffer`。

**路由结构**：
```
(main)/            Stack — 登录后总入口，未登录 redirect /login
  (tabs)/          Tabs — 底部四 Tab
    today.tsx      DoingCard + ContextStrip + MicButton + 分桶列表 + 下拉刷新
    all.tsx        按 tag 分组
    completed.tsx  按天分组 + 游标分页 + 删除
    profile.tsx    统计卡 + 退出
  tasks/[id].tsx   全屏可推详情（状态 / AI 理由 / 附件 / 搞定 / 删除）
```
入口 `index.tsx` 纯 gate：hydrating 时 spinner，token 有/无分别 replace 去 /today 或 /login。

**Siri 入口 · 轻量派**：没做原生 App Intents（要 eject Expo managed workflow）。改走 URL scheme 让用户到 iOS「快捷指令」app 里自己建一个「打开 URL: muimemo://」的指令，然后说「嘿 Siri，记一下」触发。Profile 页的「Siri 快捷指令」卡片能一键跳到 Shortcuts app，并 Alert 里写清楚三步。expo-router 自动把 `muimemo://tasks/<id>` 深链到对应页面。真要做「一句话自动录完入库」，得 eject 写 Swift 实现 `AppIntent` 协议。

**录音权限 UX**：
- 进屏不预请求（`getRecordingPermissionsAsync` 只查不问）
- 首次按麦才弹系统权限框
- 拒过且 `canAskAgain=false` → 点按钮直接弹 Alert 引导 `Linking.openSettings()`
- 普通拒绝 → 按钮下方持久 hint，不用 Alert 闪一下就没
