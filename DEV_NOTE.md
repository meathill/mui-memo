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
