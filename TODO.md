# MuiMemo 任务清单

> Phase 0 已完成。Phase 1 (Web App MVP v1) 已经跑通端到端闭环，详见 `WIP.md`。

## Phase 0: 筹备与搭建

## 1. 基础架构 (Workspace & Monorepo)
- [x] 1.1 初始化根目录 `package.json` 并启用 pnpm workspaces
- [x] 1.2 配置 `pnpm-workspace.yaml` (`apps/*`, `packages/*`)
- [x] 1.3 初始化并配置 Turborepo (`turbo.json`)
- [x] 1.4 配置全局代码规范 (Biome) 及基础 `tsconfig.json`

## 2. 共享层构建 (`packages/shared`)
- [x] 2.1 初始化 `packages/shared` 项目
- [x] 2.2 配置 `tsup` 用于导出类型与 Schema
- [x] 2.3 引入 `drizzle-orm` 与 `zod`
- [x] 2.4 定义初始数据库表结构 (`schema.ts`)
  - [x] 业务表: `tasks` (包含兼容 TiDB 的自定义 Vector 字段)
  - [x] 鉴权表: Better-Auth 所需的 `user`, `session`, `account`, `verification`
- [x] 2.5 编写首批 Zod Schema 用于前后端校验

## 3. 全栈应用层 (`apps/web`)
- [x] 3.1 使用 Next.js 初始化项目 (`create-next-app`) 并集成 TailwindCSS
- [x] 3.2 配置 OpenNext 适配器用于 Cloudflare Workers 部署
- [x] 3.3 建立 Cloudflare 配置文件体系
  - [x] `wrangler.jsonc` (开发/生产多环境隔离，R2 binding 已预留)
  - [x] `.dev.vars` (存放本地测试 Secrets 模板)
  - [x] 自动生成 `cloudflare-env.d.ts` 类型声明 (手动维护了初始版)
- [x] 3.4 基础集成 (UI & State)
  - [x] 集成 Coss UI
  - [x] 引入 Zustand 并建立简单的录音/全局状态 Store

## 4. 数据库与鉴权联动测试
- [x] 4.1 在 `apps/web` 中配置 `drizzle-kit` (`drizzle.config.ts`)
- [x] 4.2 配置 TiDB Serverless 连通性测试 (需要填入真实 `.dev.vars` URL)
- [x] 4.3 生成并执行第一次 Migration (需要 TiDB 连接)
- [x] 4.4 初始化 Better-Auth 实例配置，连接 Drizzle Adapter

## Phase 1: Web App MVP v1（当前进度）

### v1 已完成（端到端闭环）
- [x] tasks schema 扩展 + migration
- [x] 前后端共享 rerank / applyIntent 逻辑
- [x] Better-Auth 登录/注册 UI + 服务端 session gate
- [x] Gemini 2.0 Flash 语音意图解析
- [x] `POST /api/intent`、`GET /api/tasks`、`/api/tasks/[id]/done`、`/api/tasks/batch-done`
- [x] paper 主题 Today 单页（ContextStrip / DoingCard / TaskRow / SectionHeader / MicButton / EffectToast）
- [x] 浏览器 MediaRecorder 录音（长按 Space / 触摸 / 鼠标）
- [x] PWA manifest
- [x] typecheck + biome format + next build 三连过

### v1.1 已完成
- [x] TiDB Vector Embedding 混合搜索（Gemini text-embedding-004 + VEC_COSINE_DISTANCE + 关键词 LIKE 加权）
- [x] All / Completed / Profile / Onboarding 四个页面
- [x] 底部导航 BottomNav
- [x] Onboarding 首登引导 + 可重置

### v1.2 待办
- [ ] night / mono 主题 + Tweaks 面板
- [ ] check 动画 fade / fly 变体
- [ ] XP / 等级 / 连击游戏化
- [ ] `@cloudflare/workers-types` 接入 + `pnpm cf-typegen`
- [x] `logic.ts` rerank/applyIntent vitest 单测（26/26 通过，含 utteranceSchema）
- [x] Playwright e2e 套件（10 测试：auth.setup + today×4 + navigation + completion + all + onboarding×2），走真实 TiDB，绕过 Gemini
- [ ] 音频归档 R2：完整测试 binding + 回放机制
- [ ] 任务手动编辑（TaskSheet 底部抽屉）

## Phase 2: iOS App
（战略预留）

## Phase 3: Native Features
（战略预留）

## Phase 4: Desktop Worker
（战略预留）
