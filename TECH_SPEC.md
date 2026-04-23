# TECH_SPEC: ContextMemo (MuiMemo)

## 1. 架构概述 (Architecture Overview)
本项目采用 **Monorepo** 架构进行全栈开发，确保前后端类型绝对一致，并支持产品形态的逐步演进。
* **阶段核心形态**：Mobile-first Web App (PWA) + Serverless API。
* **构建生态**：pnpm workspaces + Turborepo。

## 2. Monorepo 目录结构 (Directory Structure)
代码库分为 `apps` (具体应用) 和 `packages` (共享逻辑) 两大空间：

```text
/
├── apps/
│   └── web/        # 全栈 Web 端 (Next.js 16 + OpenNext 部署至 Cloudflare Workers)
├── packages/
│   └── shared/     # 核心共享库 (Zod Schemas / Drizzle Schema / 纯函数)
├── package.json
└── pnpm-workspace.yaml
```

> 未来扩展时会回填 `apps/app`（React Native + Expo，Phase 2）。目前只有 Web 一个 app；shared 之外的公共包（`packages/ui`、`packages/config`）按需再建。

## 3. 核心模块说明 (Core Modules)

### 3.1 全栈 Web 端 (`apps/web` - MVP 核心)
* **技术栈**：
  * **框架**：Next.js + OpenNext (完全部署于 Cloudflare Workers)
  * **样式与UI**：TailwindCSS + Coss UI (注重现代化和质感设计)
  * **状态管理**：Zustand (轻量级，适合处理录音状态和任务流)
  * **鉴权**：Better-Auth (全栈打通)
* **前端职责**：
  * 深度适配手机端 UI 交互（Mobile-first PWA）。
  * 接入浏览器 MediaRecorder 实现核心的“长按录音”直传功能。
* **服务端职责 (Next.js API Routes / Server Actions)**：
  * **鉴权网关**：集成 Better-Auth 处理用户登录与数据隔离。
  * **AI 编排层**：对接 Gemini 多模态大模型处理音频流，进行端到端意图抽取（Voice-to-JSON）。利用 `waitUntil` 将原声音频异步保存至 Cloudflare R2 以便后期 Debug。
  * **数据库管理**：引入 Drizzle ORM 并使用其 Migration 机制管理 TiDB Serverless 数据库，执行混合搜索 (SQL + Vector) 与持久化，确保 Cloudflare 环境下的端到端类型安全。
  * **环境变量**：严格遵循 Build Time 与 Runtime (wrangler.jsonc envs + secrets) 隔离机制，通过 `getCloudflareContext()` 获取边缘节点变量。

** NOTE: **

由于使用 Next.js + OpenNext + Cloudflare worker，请务必参考：

- https://opennext.js.org/cloudflare
- https://meathill.com/en/posts/best-practice-for-nextjs-on-cloudflare-worker-2026

### 3.3 共享层 (`packages/shared`)
* **职责**：消除前后端由于类型不一致导致的沟通成本，是整个项目的「真理之源」(Single Source of Truth)。
* **核心内容**：
  * **数据模型 (Types/Interfaces)**：如 `Task`, `UserIntent` 等类型定义。
  * **校验规则 (Zod Schemas)**：前后端共用的输入校验规则。
  * **常量 (Constants)**：如系统支持的枚举标签、错误码等。
* **构建工具**：`tsup`，输出 ESM，Cloudflare Workers / Node / Web 均可直接消费。

### 3.4 移动端（战略预留）
* **技术栈**：React Native + Expo。MVP 阶段未启动，待 Web 端核心逻辑稳定后复用 `packages/shared` 快速构建。
* **长期价值**：iOS Share Sheet 拦截、Siri Shortcuts、桌面 Widget。

## 4. 演进路线 (Roadmap)

### Phase 0: 筹备与项目搭建 (当前聚焦)
* 搭建 pnpm workspace + Turborepo 基础脚手架。
* 建立 `packages/shared` 核心共享库（定义 Task 数据结构与 Zod Schema）。

### Phase 1: Web App MVP
* `apps/web`: Next.js 全栈应用 (OpenNext)，实现移动端 PWA，接入浏览器录音 API。
* 服务端集成：基于 Server Actions / API Routes，对接 Gemini API (Voice-to-JSON) 与 TiDB 混合搜索，并配置好 Cloudflare 环境。
* 跑通“语音直录 -> AI解析归堆 -> 场景唤醒 -> 任务消除”全链路。

### Phase 2: iOS App
* `apps/app`: 基于 React Native (Expo) 初始化移动端，迁移 Web MVP 的核心体验至原生环境。

### Phase 3: Native Features
* 深度挖掘 iOS 原生能力：锁屏一键录音 Widget、Siri 快捷指令、微信 Share Sheet 转发直接转待办。

### Phase 4: Desktop Worker
* 桌面端应用（常驻后台/状态栏），用于在 PC 办公场景下的极速唤醒、录入与任务查阅。
