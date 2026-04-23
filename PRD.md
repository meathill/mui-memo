# 产品需求文档 (PRD)：MuiMemo

## 1. 产品愿景与定位
**产品定位**：一款「意图驱动」的 AI 语音轻量任务调度引擎。
**核心愿景**：不强迫用户管理时间，而是顺应用户的「注意力流」和「当前场景」，通过 AI 自动归拢相关任务，极大地降低上下文切换的认知负担。

## 2. 目标用户与痛点分析
**目标画像**：主妇、小卖铺店主、自由职业者等「杂货铺杂役」型人群。
**核心痛点**：
* **任务极其碎片化**：每天几十件小事（转账、拿快递、回复特定信息），没有完整的连续时间块。
* **传统工具摩擦力大**：打字记录太慢，传统备忘录缺少动态优先级，导致需要不断在不同 App（如网银、微信）间反复横跳。
* **计划赶不上变化**：无法严格按照时间轴（如 10:00 做什么，11:00 做什么）执行，任务的执行更多依赖于「状态」或「地点」。

## 3. 核心功能模块 (MVP 阶段)

> [!NOTE]
> MVP 阶段为了保证能最快进行用户测试（发链接给朋友直接体验），客户端采用 Web App (PWA) 形态，核心发力点在于“语音转意图”与“混合搜索归堆”。原生 App 将放在 Phase 2，原生特性（如 Share Sheet、桌面 Widget）将放在 Phase 3，桌面端工具放在 Phase 4。

### 3.1 极简语音输入（Zero-Friction Capture）
* **Web 端语音直录**：App 首页核心位置是一个巨大的麦克风按钮（Hold to talk），支持浏览器级语音输入。
* **AI 隐式解析**：用户用大白话输入（如“等下记得给王老板转五百”），后端 AI 自动提取核心信息并转化为结构化任务，无需手动打标签。

### 3.2 意图唤醒与智能归堆（Context Batching）- MVP核心壁垒
* **状态声明（State Declaration）**：用户通过语音或快捷按钮声明当前状态（例：“我打开电脑了”、“我准备登网银”、“我去王府井了”）。
* **混合检索引擎**：基于当前声明的意图，系统自动通过全文匹配（精确找地名/人名）和语义向量（模糊找相似操作）聚合相关任务。
* **临时任务包（Task Bundle）**：生成一个针对当前场景的临时列表，处理完后一键批量打勾。

### 3.3 动态优先级池（Dynamic Queue）
* 无默认的死板时间线排序。
* 任务分为 `Active`（激活，匹配当前场景）和 `Frozen`（冻结，不符合当前场景或前置条件未满足）。

## 4. 技术架构选型 (MVP 导向)

为了实现极速开发验证，同时保全长期的 AI 混合搜索能力，采用以下架构：

* **客户端 (Client)**：**Next.js / Vite (React) + TailwindCSS + Coss UI**
    * *状态管理*：使用 **Zustand** 管理录音、归堆任务等全局状态。
    * *理由*：通过 URL 极速分发，朋友点开即用。无需应对 App Store 审核。Coss UI 提供了极佳的现代化组件，Zustand 足够轻量。使用浏览器的 MediaRecorder 录制音频直接交给大模型处理，足以验证语音输入的核心体验。
* **鉴权层 (Auth)**：**Better-Auth**
    * *理由*：作为 Web App，我们需要多用户数据隔离以方便朋友们测试。Better-Auth 是现代化的全栈认证方案，接入极快。
* **API 网关与业务逻辑 (BFF)**：**Next.js API Routes / Server Actions (基于 OpenNext + Cloudflare Workers)**
    * *理由*：利用 OpenNext 将 Next.js 全栈直挂 Cloudflare Workers，享受边缘节点的极速冷启动和免运维特性。前后端工程合并，极大地提升单兵 Vibe Coding 效率。严格遵循 Cloudflare Worker 的环境变量管理最佳实践。
* **AI 大脑 (LLM)**：**Google Gemini**
    * *理由*：原生支持多模态（直接接收音频输入），可以直接将客户端传来的录音进行语音到意图（Voice-to-JSON）的端到端抽取，省去独立 STT 服务。同时 API 定价性价比极高，非常适合高频的日常调度场景。
* **数据库管理 (Database & ORM)**：**TiDB Serverless + Drizzle ORM**
    * *理由*：TiDB 提供了一体化 SQL 接口，一条语句即可同时完成 Full-text 和 Vector 检索。搭配 **Drizzle ORM** 与其 Migration 机制，不仅提供端到端的 TypeScript 类型安全，完全掌控表结构演进，而且在 Cloudflare 边缘节点上运行极其高效。

## 5. 核心数据模型

实际 schema 见 [packages/shared/src/schema.ts](./packages/shared/src/schema.ts)。要点：

* `tasks.embedding` 是 **TiDB 生成列**（`VECTOR(1024)`），由 `EMBED_TEXT('tidbcloud_free/amazon/titan-embed-text-v2', text)` 自动维护，应用层只写 `text`。
* 语义检索由 `VEC_EMBED_COSINE_DISTANCE` + 关键词 `fts_match_word` 的 RRF 融合完成，见 [apps/web/src/lib/search.ts](./apps/web/src/lib/search.ts)。

## 6. 用户交互流 (User Flow - Web MVP版)

**场景 A：信息录入**
1. 用户在店里理货，突然想起事情。
2. 打开手机浏览器中的 MuiMemo (PWA)，长按页面麦克风录音：“下午三点前记得给供货商老张转 5000 块尾款”。
3. Cloudflare Worker 接收音频流 -> 直接调用 Gemini API 进行端到端语音意图抽取（输出 JSON）并生成向量 -> 存入 TiDB。系统默默记下，不打扰用户当前工作。

**场景 B：意图处理 (智能归堆)**
1. 下午 2:30，用户坐到电脑前。点击 Web App 上的常用场景标签“🖥️ 电脑前/网银”，或对着手机说“我要登网银打款了”。
2. TiDB 执行混合搜索，命中“给供货商老张转 5000”（语义命中），同时带出了昨天遗留的“退一下 3 号桌的押金”（动作关联命中）。
3. 界面弹出一个「网银任务包」，包含这 2 个任务。用户顺手全部搞定，点击“全搞定了”。
