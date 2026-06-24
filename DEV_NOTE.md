# 开发笔记

长期关注的基建、框架知识、决策备忘录。面向 3 个月后入职的同事：看完能理解「为什么」，不只是「是什么」。

## 版本号约定

- web：`apps/web/package.json` 的 `version` 在构建时由 `apps/web/next.config.ts` 通过 `env.NEXT_PUBLIC_APP_VERSION` 注入客户端 bundle，「我的」页面底部展示
- app：`apps/app/package.json` 是版本号唯一源，`apps/app/app.config.ts` 用 `pkg.version` 注入 ExpoConfig；运行时通过 `expo-constants` 的 `Constants.expoConfig?.version` 读取。「我的」页面底部展示 `vX.Y.Z (build)`，build 号取 `ios.buildNumber` 或 `android.versionCode`（dev / Expo Go 里通常没有，回退为只显示 `vX.Y.Z`）
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
  - `build` = `pnpm -F shared build && next build --webpack`（普通 SSR 构建；`--webpack` 见下节）
  - `cf-build` = `opennextjs-cloudflare build`（打 Worker bundle）
  - `deploy` = `cf-build + wrangler deploy`
- `shared` 必须先 build，因为 `apps/web` 通过 workspace 消费其 `dist/` 产物（不是源码）

## Next.js build：用 webpack 不用 Turbopack（字体）

- production `build` 显式带 `--webpack`（`next build --webpack`），**不走 Next 16 默认的 Turbopack**
- 原因：Turbopack 处理 `next/font` 加载 Noto Serif SC（中文衬线、字重文件大）时报错、构建失败；webpack 路径正常
- `next dev` 仍用默认；只有 production `build` 锁死 webpack。换字体方案或升级 Next 后可再评估切回 Turbopack
- 背景：commit `fix(web): 构建改用 webpack，绕开 Turbopack 对 Noto Serif SC 字体的报错`

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

## AI Provider 切换：按来源地区在 Gemini / OpenAI 兼容端点间切换

- 入口 [apps/web/src/lib/intent.ts](apps/web/src/lib/intent.ts) 的 `pickProvider(env, country)` 决定 provider，`resolveAndParseVoiceIntent` 据此路由：
  - `AI_PROVIDER` 显式为 `'openai'` / `'gemini'` → 强制锁定（本地调试 / 手动覆盖）
  - `'auto'`（现行默认，见 wrangler.jsonc）或缺省 → **按来源地区切**：中国地区 `CN/HK/TW/MO` 走 MIMO，其余已识别地区走 Gemini
  - 识别不到来源（本地 dev、`XX`/`T1`、null）→ 回退 MIMO。理由：MIMO 端点在 SGP 全球可达，错路由也能用；而把大陆用户错发 Gemini（Google 被墙）会直接失败，回退 MIMO 最稳
- 来源国家取自 Cloudflare 边缘注入的 `cf-ipcountry` 请求头，在 [apps/web/src/app/api/intent/route.ts](apps/web/src/app/api/intent/route.ts) 里 `req.headers.get('cf-ipcountry')` 读出透传；`next dev` 没这个头 → null → 回退 MIMO。`/api/intent` 是唯一调用入口
- 共享部分（system prompt / userPrompt / audioToBase64 / extractJson / TimeAnchor）抽到 [apps/web/src/lib/intent-shared.ts](apps/web/src/lib/intent-shared.ts)，两个 provider 共用，确保输出 schema 一致
- OpenAI 路径默认目标是小米 MIMO（[platform.xiaomimimo.com](https://platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api)），用官方 `openai` SDK 直连，不走 CF Gateway（国内服务收益不大）
- `'auto'` 模式两个 provider 的凭据都要备齐（任一地区都可能命中）：MIMO 侧 `OPENAI_API_KEY` + `OPENAI_BASE_URL` + `OPENAI_MODEL`，Gemini 侧 `GEMINI_API_KEY`；在 `.dev.vars` 或 `wrangler secret put` 设。`AI_PROVIDER` 本身是 wrangler.jsonc 的 var（非 secret）
- `input_audio.format` 字段：OpenAI SDK 类型只声明 `'wav' | 'mp3'`，但 MIMO 实际接受 mp3 / wav / flac / m4a / ogg（[音频限制](https://platform.xiaomimimo.com/docs/zh-CN/usage-guide/multimodal-understanding/audio-understanding?target=%E9%9F%B3%E9%A2%91%E9%99%90%E5%88%B6)），代码里 cast 绕过类型限制
- **webm 不在 MIMO 白名单里**——这是 web MediaRecorder 的默认产物。[apps/web/src/components/memo/mic-button.tsx](apps/web/src/components/memo/mic-button.tsx) 把录音格式优先级改成 `mp4 > ogg/opus > webm/opus`，让 Chrome 116+ / Safari 录 mp4，Firefox 录 ogg；老 Chrome 兜底 webm 时切到 OpenAI provider 会被服务端 `pickAudioFormat` 拒绝
- MIMO 支持 OpenAI 的 JSON mode，已开 `response_format: { type: 'json_object' }`；保留 `extractJson` 兜底，万一某次返回带前缀也能救回

## Next.js 16 (App Router) 要注意

- `params` / `headers` / `cookies` 都是 **Promise**，必须 `await`
- `(app)/layout.tsx` 整体标了 `export const dynamic = 'force-dynamic'`，避免 session 被错误缓存
- 新增 route handler 前**先读 `node_modules/next/dist/docs/01-app/` 相关章节**，别凭记忆写

## Prompt：时间字段必须宁缺毋滥

- Gemini prompt 里反复强调：用户原话没明确时间词（具体时刻 / 日期 / 相对期限）就**不要**填 `expectAt` / `dueAt`
- 过期任务在 UI 里会变红；AI 擅自填时间 → 用户看到「莫名其妙过期的」任务，体验比「没时间」差得多
- 规则表格和反面样例都写在 prompt 里（见 [apps/web/src/lib/gemini.ts](apps/web/src/lib/gemini.ts)）。改 prompt 时保留这段

## Prompt：最近标签候选

- App 端提交 `/api/intent` 时会从本地任务快照收集标签候选（最多 100 个）随 `FormData.tagCandidates` 发送；服务端再读取当前用户最近任务里的标签，按任务 `updatedAt/createdAt` 倒序去重，最多 100 个。本地候选优先，服务端候选补足；合并逻辑在 [apps/web/src/lib/tasks.ts](apps/web/src/lib/tasks.ts)。
- `buildUserPrompt` 的 `tagCandidates` 参数优先于当前清单标签。当前清单仍只截前 30 条任务，标签候选独立注入，避免老标签因为任务已完成而消失；app 本地刚出现的标签也能参与下一次语音解析。
- Prompt 要求模型在同义、近义、上下位关系明显时复用候选标签原字符串；本轮不做硬性后处理，避免用户明确说的新标签被误改。

## Utterance schema：actions[] + 待确认队列（v0.9）

**背景**：v0.8 之前 utterance 是单意图（顶层 intent + task/patch/...），跑到线上发现两个问题：

1. 用户连说两件不同的事，AI 倾向用 MODIFY 把后说的内容覆盖前一条任务（朋友的 bug：「明天 10 点把货单提供给高老师」 → 「完了转需要提供快递单号」 被并成一条）
2. 用户希望一句多事能自动拆开

**结构改造**：[`packages/shared/src/validators.ts`](packages/shared/src/validators.ts) 把 utterance 重构成

```ts
{ raw, actions: Action[], dims }
```

`actionSchema` 是 `z.discriminatedUnion('intent', [...])`，每个分支的字段形状跟着 intent 变。`legacyToActions` + `parseUtteranceFlexible` 兜底老 JSON。

**applyActions（[`logic.ts`](packages/shared/src/logic.ts)）必须串行**：前一个 action 的 tasks 喂给下一个，否则「先 ADD 一条新任务再 LINK 它」就会找不到。`applyIntent` 保留为单 action wrapper。

**MODIFY / DONE 走待确认队列**，不立即落库：

- `/api/intent` 把 effects 分流，自动 effects 立刻 persist；MODIFY 命中的 task 在内存里 revert 到 `effect.before` 后再 persist，等用户在前端弹窗里选完才发 `/api/intent/confirm`
- 弹窗三按钮：**确认 / 改为新增 / 取消**。「改为新增」用 `patch` 字段当新 task 的字段新建一条，原任务保持不动——AI 把"另外提一件事"误判成 MODIFY 时的兜底
- DONE 仍弹两按钮，复用同一队列。store 里的 `pendingConfirms[]` 一个个串行弹

**logUtterance 写多行**：每个 action / effect 一行 `utterances` 表，`actions` JSON 列冗余存全量便于"输入记录"页回看。老行 `actions=NULL`，读端用 `legacyToActions` 兜底。

**Prompt 收紧 MODIFY**（[`intent-shared.ts`](apps/web/src/lib/intent-shared.ts)）：必须有显式信号词（"改成 / 改到 / 推迟到"），过渡词（"对了 / 另外 / 完了转"）一律走 ADD。反例表里专门列了朋友踩过的句式。

## AI prompt 评估套件

每次改 `SYSTEM_PROMPT` 或加 case 后必跑一轮：

```
pnpm -F @mui-memo/web test:prompt-eval
```

常规 `pnpm test` **不跑这套**（50+ 秒 + 真实 API 计费）。`test:prompt-eval` 这条
script 显式设了 `PROMPT_EVAL=1`，没这个 env 整套 `describe.skip` 跳过。

- **位置**：[`intent-prompt.cases.ts`](apps/web/src/lib/intent-prompt.cases.ts)（case 数据）+ [`intent-prompt.eval.test.ts`](apps/web/src/lib/intent-prompt.eval.test.ts)（驱动）
- **跑真实模型不 mock**。[`vitest.config.ts`](apps/web/vitest.config.ts) 启动时用 dotenv 把 `apps/web/.dev.vars` 注入 `process.env`，按优先级选 provider：
  1. `OPENAI_API_KEY` + `OPENAI_BASE_URL` + `OPENAI_MODEL` → OpenAI 兼容（MIMO）
  2. `GEMINI_API_KEY` → Gemini
  3. 都没有 → `describe.skip` 整套跳过
- 测试文件首行有 `@vitest-environment node`：OpenAI SDK 检测到 happy-dom 注入的 `window` 会拒跑（怕泄 key），eval 套件不动 DOM 切 node 即可
- **断言只锁结构和关键 token**（`intent`、`task.text` 包含某子串、`expectAt` 是否填），不锁文案——AI 用词会变，锁死会误报；挂了通常是真行为退化
- 11 条 case 跑一轮约 50 秒。新增 case 直接 `CASES.push(...)`
- 朋友再报 prompt-level bug，把那句原话直接搬进来一条 case 就成了永久回归保护

## 删除任务：级联清理

- `DELETE /api/tasks/[id]` 要清 4 处：
  1. attachments DB 行
  2. attachments 对应的 R2 对象
  3. utterances 表里 task_id 置空（保留语音历史，去掉悬挂指针）
  4. 任务自己的 audioKey 对应 R2 对象 + 任务行
- R2 delete 用 `Promise.allSettled`，单个失败不阻塞 DB 已清的语义

## 任务字段文案 & 跨端 DTO：单一词汇（app 为准）

- STATUS/WINDOW/PLACE/PRIORITY 的展示文案统一收在 [`packages/shared/src/logic.ts`](packages/shared/src/logic.ts)（`STATUS_LABEL` 等），web 与 app 共用，**app 措辞为准**（待办/进行中、马上/今天内/改天、工位/不限）。
- 早期两端各维护一套（web：待做/此刻/在公司…），同一字段文案漂移。统一时选 app 措辞，web 的详情页/统计卡/onboarding/营销文案 + e2e 断言一并对齐。注意：doing-card 的「正在做」是卡片标题、两端本就一致，不等于 status 标签，没动。
- 跨端响应 DTO（`Attachment`/`CompletedTask`/`ProfileStats`/`RecurrenceInfo`）收在 [`packages/shared/src/dto.ts`](packages/shared/src/dto.ts)，`Attachment.mime/size` 以 API 真实可空形状（`…| null`）为准，web 渲染端加空值兜底。
- 再见「两端文案/类型不一致」别各改各的——改 shared 这一份。

## iOS App（apps/app · Phase 2 起步）

**脚手架**：Expo SDK 55 + expo-router + TypeScript。手工搭，没跑 `create-expo-app`，所以装完依赖后第一次要 `cd apps/app && npx expo install --fix` 校准版本。

**⚠️ Prebuild 运行命令约定（避免 Node 26+ 报错）**：
- **正确**：使用 `pnpm exec expo prebuild --clean -p ios`（或 `pnpm expo prebuild ...`），这样会使用本地的 `typescript` 来转译 `app.config.ts`。
- **错误**：使用 `pnpx expo prebuild ...`。由于 `pnpx` (即 `pnpm dlx`) 在隔离沙盒中运行，找不到本地的 `typescript`，因此会回退到 Node.js 的原生 `stripTypeScriptTypes`。而在 Node 26 中，该 API 移除了 `mode: 'transform'` 支持，只接受 `mode: 'strip'`，导致报错：`The property 'options.mode' must be one of: 'strip'. Received 'transform'`。

**API base 默认远端**：[apps/app/app.config.ts](apps/app/app.config.ts) 把 `extra.apiBase` 默认指到生产部署 `https://muimemo.meathill.com`。朋友拿到模拟器 / 真机点开就能用，不依赖开发机。**本地开发**想指到自己 web 的话，在 `apps/app/.env.local` 里写 `EXPO_PUBLIC_API_BASE=http://<LAN-IP>:3200`（别用 localhost——真机 / 模拟器走不到宿主 loopback）。改完要重启 `expo start`，extra 是启动时注入不热更。

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

**Shared 包的雷区**：`apps/app` 只许 import `@mui-memo/shared/validators`、`@mui-memo/shared/logic` 和 `@mui-memo/shared/dto`（后者是纯类型 DTO，编译产物为空、运行时零依赖，Metro 安全）。`@mui-memo/shared/schema` 拖着 drizzle-orm + TiDB 驱动，Metro 不认，一碰就 bundle 失败。review 代码时搜一遍确认没有。

**音频格式**：Web MediaRecorder 走 `mp4 > ogg/opus > webm/opus` 优先级（[mic-button.tsx](apps/web/src/components/memo/mic-button.tsx) 的 `RECORDER_MIME_CANDIDATES`，见「AI Provider 切换」段落里关于 MIMO webm 不支持的说明），iOS `expo-audio` 默认 `.m4a`。[apps/web/src/app/api/intent/route.ts](apps/web/src/app/api/intent/route.ts) 的 R2 扩展名分支已同时覆盖 webm / m4a / wav；走 OpenAI provider 时 webm 会被拒，新录音才能命中 mp4。Gemini 对所有这些格式都能识别。

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

**启动与缓存**：
- `app.config.ts` 的 `splash.backgroundColor: '#f4ede0'`，避免默认白底 → paper 色跳色；没放 logo 图，等 [assets/README.md](apps/app/assets/README.md) 补
- `_layout.tsx` 手动 `SplashScreen.preventAutoHideAsync()`，等 `useSession.hydrate()`（读 SecureStore 毫秒级）完成后再 `hideAsync`，避免闪登录屏再跳 /today
- 任务读模型在 SQLite（`expo-sqlite`）里，入口是 [apps/app/src/lib/local-db.ts](apps/app/src/lib/local-db.ts)：`local_tasks`（主列表）、`local_completed_tasks`（已完成首屏）、`local_task_details`（详情 + 附件 + 重复摘要）、`sync_meta`（用户隔离 + 最近同步时间）。
- `useAppStore` 仍保留任务的内存快照，但不再把 `tasks` 写入 AsyncStorage；AsyncStorage 只持久化 `theme` / `queue` / `barChips` 这类轻量状态。启动时 `_layout.tsx` 按 SecureStore 里的用户 id 准备 SQLite 缓存并 hydrate 本地任务。老版本已写入 AsyncStorage 的 `tasks` 会通过 [apps/app/src/lib/task-sync.ts](apps/app/src/lib/task-sync.ts) 一次性迁入 SQLite，然后从旧 persist JSON 里删除，避免存量用户升级后首屏变空。
- 远程 API 是权威数据源；[apps/app/src/lib/task-sync.ts](apps/app/src/lib/task-sync.ts) 负责 60 秒 TTL 后台刷新、远程结果写回 SQLite + Zustand。下拉刷新强制远程请求。写操作是“本地乐观更新 + API + 失败回滚”，本轮没有离线 mutation outbox。
- `place` 是「当次场景上下文」**不持久化**——每次启动回到默认「全部」，`merge` 兜掉旧安装里残留的 place。

**Siri 入口 · 轻量派**：没做原生 App Intents（要 eject Expo managed workflow）。改走 URL scheme 让用户到 iOS「快捷指令」app 里自己建一个「打开 URL: muimemo://」的指令，然后说「嘿 Siri，记一下」触发。Profile 页的「Siri 快捷指令」卡片能一键跳到 Shortcuts app，并 Alert 里写清楚三步。expo-router 自动把 `muimemo://tasks/<id>` 深链到对应页面。真要做「一句话自动录完入库」，得 eject 写 Swift 实现 `AppIntent` 协议。

**录音权限 UX**：
- 进屏不预请求（`getRecordingPermissionsAsync` 只查不问）
- 首次按麦才弹系统权限框
- 拒过且 `canAskAgain=false` → 点按钮直接弹 Alert 引导 `Linking.openSettings()`
- 普通拒绝 → 按钮下方持久 hint，不用 Alert 闪一下就没

## 周期性任务（Recurring Tasks）

**为什么这么设计**：要「每天/每周/每两周/每月/工作日自动出现，没完成自动删，完成的进历史」。

- **定义 / 实例分离**：`recurrences` 表存「模板」（长期存在）；每期由对账生成一条**普通 `tasks` 行**（`recurrence_id` + `period_index` 指回模板）。实例就是普通任务 → 自动复用 rerank / 完成动画 / 已完成页 / 本地通知，几乎零额外读写路径。「完成可查」白嫖（done 实例本就进 completed 页）。
- **lazy-on-fetch 对账**：不上 cron / 远程推送（与「只用本地通知」的既有决策一致）。每次 `GET /api/tasks` 先 `applyRecurrenceReconcile`：生成本期缺失实例、删上期未完成（`status<>'done'`）。包 `try/catch`，周期逻辑出错绝不拖垮主列表。代价：app 长期不开就不生成（列表本就只在查看时有意义）。
- **周期数学**（纯函数 `packages/shared/src/recurrence.ts`，全单测）：
  - daily / weekly：锚点 + 定长毫秒区块，`k = floor((now-anchor)/区块)`。每两周 = weekly + interval 2。
  - monthly：本地日历月步进，月末号数夹取（1/31 → 2/28），粗算月差后 `while` 校正到 `start(k)<=now<start(k+1)`。
  - workday：按天计数（同 daily 的 index），但 `periodStart` 落在周末则**跳过生成**；周五未完成周六照常清掉。
- **时区**：daily/weekly 是定长区块，与时区无关。monthly/workday 要判「本地第几月 / 星期几」，故 `recurrences.tz_offset` 存创建端 `getTimezoneOffset()` 分钟数（UTC+8 = -480），用 `toLocal/fromLocalParts` 换算。**仅对固定偏移时区精确**（中国无 DST，OK）；DST 地区切换日可能 ±1h、极少 ±1 天，备忘类可接受，要更准就改存 IANA tz 串 + Intl。
- **去重**：`tasks` 上 `UNIQUE(recurrence_id, period_index)`。两列同 NULL（普通任务）在 MySQL/TiDB 唯一索引下不冲突；并发 fetch 重复生成靠它兜，insert 撞键吞掉。
- **创建入口**：编辑任务页「重复」开关，复用 `expectAt` 作锚点。换频率/间隔走「删定义 + 重建」重置周期序号，避免新旧 index 不一致冒重复实例。关闭重复 = 删定义 + 把未完成实例 unlink 成普通任务（保留用户正看的这条），done 实例留作历史。
- **锚点在未来**：预期时间预设都是将来时刻 → `currentPeriodIndex` 为 null 时按第 0 期挂当前任务，否则重开编辑页开关状态会丢。
