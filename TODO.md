# MuiMemo 任务清单

> Phase 0（脚手架）与 Phase 1（Web App MVP v1 + v1.1 扩展）均已完成。
> 版本演进见 [WIP.md](./WIP.md)。

## Phase 1: Web App（验证语音能力，不追求完整性）

> 定位：验证「语音驱动任务」的可行性，不负责「手动编辑」「提醒推送」等重交互。
> 这些体验在 web 上天花板明显，留给 Phase 2 native。

### 已完成
- [x] Monorepo 骨架 + Coss UI + Zustand + Better-Auth + TiDB/Drizzle + Cloudflare Workers
- [x] Web App MVP：语音意图闭环、Today / All / Completed / Profile / Onboarding、底部导航、PWA
- [x] TiDB 原生 hybrid search（`EMBED_TEXT()` 生成列 + `fts_match_word` + `VEC_EMBED_COSINE_DISTANCE` + RRF）
- [x] `expectAt` / `dueAt` 拆分 + 动态相对时间 label + 过期红标
- [x] 任务详情页 + 附件（R2，`muimemo/` 前缀）+ 原始语音回放
- [x] Today / All 下拉刷新 + Completed 游标分页 + 无限滚动
- [x] 输入记录页（utterance log）
- [x] 任务删除（详情页 + 已完成页，AlertDialog 确认，级联清 R2 + DB）
- [x] `logic.ts` rerank/applyIntent vitest 单测
- [x] Playwright e2e（真实 TiDB，绕过 Gemini）
- [x] ~~`@cloudflare/workers-types` 正式接入~~ → 改用 wrangler 自带 `wrangler types`（`pnpm cf-typegen`），见 DEV_NOTE.md
- [x] night / mono 主题 + Tweaks 面板
- [x] check 动画 fade / fly 变体
- [x] Google Analytics（@next/third-parties）+ 关键埋点（voice_intent / task_complete / task_delete / theme_change）

### 未完成（按需排期）
- [ ] 音频归档 R2：完整测试 binding + 管理界面

### 已砍（web 上价值不足，转移到 native）
- XP / 等级 / 连击游戏化 → 依赖推送、徽章、锁屏 widget 才有留存意义
- 任务手动编辑底部抽屉（TaskSheet）→ 语音兜底手感在 native 才成立
- 到点提醒 → Web Push 在 iOS 上可靠性不够（见本轮讨论）

## Phase 2: iOS App（战略预留 · 核心差异化）

> 赌的是 native 独有的三件事：Siri 入口、端侧 ASR、Live Activity。
> 顺带把 Phase 1 砍掉的 TaskSheet / 提醒 / 游戏化补齐。

- Siri + Shortcuts 入口（「Hey Siri, 记一下 X」不开 app）
- 端侧 ASR（Apple Speech / Whisper.cpp）+ 实时转写
- Live Activity / 动态岛录音反馈
- 本地定时提醒（UNCalendarNotificationTrigger）
- TaskSheet 手动编辑底部抽屉
- Foundation Models（端侧 LLM，隐私 + 零成本的简单分类/标签）

## Phase 3: Native Features（战略预留）
## Phase 4: Desktop Worker（战略预留）
