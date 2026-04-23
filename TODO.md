# MuiMemo 任务清单

> Phase 0（脚手架）与 Phase 1（Web App MVP v1 + v1.1 扩展）均已完成。
> 版本演进见 [WIP.md](./WIP.md)。

## Phase 1: Web App（持续迭代中）

### 已完成
- [x] Monorepo 骨架 + Coss UI + Zustand + Better-Auth + TiDB/Drizzle + Cloudflare Workers
- [x] Web App MVP：语音意图闭环、Today / All / Completed / Profile / Onboarding、底部导航、PWA
- [x] TiDB 原生 hybrid search（`EMBED_TEXT()` 生成列 + `fts_match_word` + `VEC_EMBED_COSINE_DISTANCE` + RRF）
- [x] `expectAt` / `dueAt` 拆分 + 动态相对时间 label + 过期红标
- [x] 任务详情页 + 附件（R2，`muimemo/` 前缀）+ 原始语音回放
- [x] Today / All 下拉刷新 + Completed 游标分页 + 无限滚动
- [x] 输入记录页（utterance log）
- [x] 任务删除（详情页 + 已完成页，AlertDialog 确认，级联清 R2 + DB）
- [x] `logic.ts` rerank/applyIntent vitest 单测（31/31）
- [x] Playwright e2e（真实 TiDB，绕过 Gemini）

### 未完成（按需排期）
- [ ] night / mono 主题 + Tweaks 面板
- [ ] check 动画 fade / fly 变体
- [ ] XP / 等级 / 连击游戏化
- [ ] `@cloudflare/workers-types` 正式接入（阻塞原因见 DEV_NOTE.md）
- [ ] 音频归档 R2：完整测试 binding + 管理界面
- [ ] 任务手动编辑底部抽屉（TaskSheet）

## Phase 2: iOS App（战略预留）
## Phase 3: Native Features（战略预留）
## Phase 4: Desktop Worker（战略预留）
