# MuiMemo 任务清单 (Phase 0: 筹备与搭建)

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
