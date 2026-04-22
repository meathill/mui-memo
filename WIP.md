# WIP · MuiMemo Web App v1.1

## 本轮迭代：向量搜索 + 完整页面群

在 v1 端到端闭环之上，完成 TiDB 向量混合搜索和另外 4 个页面，现已覆盖 Today / All / Completed / Profile / Onboarding 全部设计稿页面。

### 向量搜索

- **嵌入模型**：Gemini `text-embedding-004`（768 维），新 `lib/embedding.ts` 封装；`createEmbedder(apiKey)` 返回 `Embedder`。
- **Schema**：`schema.ts` 的 vector customType 改为 `VECTOR(768)`，并实现 `toDriver`/`fromDriver`（TiDB 需要 `'[...]' ` 字符串）。migration `0002_sour_kang.sql` 已执行。
- **混合搜索**：新 `lib/search.ts:resolveTargetTask()` 用 TiDB `VEC_COSINE_DISTANCE` + `LIKE` 关键词同时查询，按 0.7×语义 + 0.3×关键词 加权返回最佳匹配任务。
- **写入流程**：`persistIntentResult()` 现在 optional 接收 `embedder`；新插入/文本变更时同步生成 embedding。
- **回填**：新 `backfillEmbeddings()`，对 embedding 为 NULL 的历史任务机会性补齐，挂在 `ctx.waitUntil` 后台跑。
- **applyIntent**：`Utterance` 增加 `matchId`（后端混合搜索解析结果），applyIntent 的 `matchTask` 优先认 id，其次正则，保持前后端兼容。
- **POST /api/intent**：STATUS/DONE/MODIFY/LINK 意图在 applyIntent 前先跑 hybrid resolver，失败时回退正则。

### 页面与导航

- 新 `BottomNav`：Today / 全部 / 已完成 / 我的 四个标签，`(app)/layout.tsx` 注入，全局悬浮。
- **/all**（`components/memo/all-view.tsx`）：按 tag 分组展示所有待办；勾选任务同步 `/api/tasks/[id]/done`。
- **/completed**（`completed-view.tsx`）：按天（今天/昨天/具体日期）分组，新 `GET /api/tasks/completed` 返回最近 500 条已完成。
- **/profile**（`profile-view.tsx`）：用户头像/邮箱 + 4 张统计卡（今日已勾 / 累计完成 / 清单待办 / 正在做）+ 重置引导 + 退出登录。新 `GET /api/profile/stats` 返回 `{user, stats}`。
- **/onboarding**（`onboarding-view.tsx`）：5 页 carousel，localStorage `muimemo:onboarded` 首登引导；Today 页加载时发现未完成引导会自动跳转。
- TodayView：移除自带的「退出」按钮（迁到 Profile），麦克风悬浮层上移 60px 给底栏让位。

### 新增文件
- `packages/shared/src/schema.ts`（扩展 vector 类型 + toDriver/fromDriver + 导出 `EMBEDDING_DIM`）
- `packages/shared/src/logic.ts`（applyIntent 支持 matchId）
- `packages/shared/src/validators.ts`（utteranceSchema 加 `matchId`）
- `apps/web/src/lib/embedding.ts`
- `apps/web/src/lib/search.ts`
- `apps/web/src/lib/tasks.ts`（嵌入写入 + backfill）
- `apps/web/src/app/api/intent/route.ts`（hybrid resolver 接入）
- `apps/web/src/app/api/tasks/completed/route.ts`
- `apps/web/src/app/api/profile/stats/route.ts`
- `apps/web/src/app/(app)/layout.tsx`（`force-dynamic` + BottomNav）
- `apps/web/src/app/(app)/all/page.tsx` + `all-view.tsx`
- `apps/web/src/app/(app)/completed/page.tsx` + `completed-view.tsx`
- `apps/web/src/app/(app)/profile/page.tsx` + `profile-view.tsx`
- `apps/web/src/app/onboarding/page.tsx` + `onboarding-view.tsx`
- `apps/web/src/components/memo/bottom-nav.tsx`
- `apps/web/drizzle/0002_sour_kang.sql`

### 质检
- `pnpm --filter @mui-memo/shared build` ✓
- `pnpm exec tsc --noEmit` ✓
- `pnpm run format` ✓
- `pnpm build` ✓（Routes：/, /all, /completed, /profile, /onboarding, /login, /register + 7 个 API）

## 验收场景（手动）

1. **向量搜索**：录一条「我去银行办那个转账」——如果清单里有包含「招行转账」「付物业费」等语义相关的任务，应当精准命中并切 doing，不依赖 AI 给出精确正则。
2. **All 页**：录几条不同 tag 的任务，看 /all 按 tag 分组；勾选后任务消失并同步到 /completed。
3. **Completed 页**：已勾选任务出现在今天分组，次日后自动滚到「昨天」/具体日期。
4. **Profile 页**：统计数字实时；点退出登录回 /login；点「再看一次入门引导」跳 /onboarding。
5. **Onboarding**：清除 localStorage 后访问 /，应被自动带到 /onboarding；完成后写入 `muimemo:onboarded` 并回到 /。
6. **底部导航**：四个标签切换无感，active 状态高亮；录音条悬浮在 BottomNav 之上，不遮挡。

## 测试

- **单测**（`packages/shared`）：26/26 ✓。`pnpm test` 从根目录跑 turbo。
- **E2E**（`apps/web/e2e`）：10/10 ✓。`pnpm --filter @mui-memo/web e2e`。架构与运行方式见 [apps/web/e2e/README.md](apps/web/e2e/README.md)。

## 下一步候选（v1.2）

- night / mono 两套主题 + Tweaks 面板
- XP / 等级 / 连击游戏化 + 动画反馈（fade / fly 勾选变体）
- `logic.ts` rerank/applyIntent vitest 单测 + `search.ts` e2e 用真实 TiDB
- `@cloudflare/workers-types` 正式接入 + `pnpm cf-typegen`
- R2 音频归档回放页（debug 用）
- 任务手动编辑（TaskSheet 底部抽屉）
