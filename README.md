# MuiMemo

> 用一句话记下来，剩下的交给它。

MuiMemo 是一个**语音驱动**的待办应用：长按一下、说一句话，AI 会自动判断这件事属于「现在做」「今天做」还是「以后再说」、放进合适的桶；当你回到对应场景（在家、在工位、在外面）时，它会把当下能做的那批事推到你眼前。

## 为谁做的

- 一边走路一边想到事情的人
- 不愿打断手头工作专门去开 todo app 的人
- 试过若干 todo 工具但每一款都「躺平」的人

我们不和「全功能项目管理」竞争。MuiMemo 只解决一件事：**让「想到」到「记下」之间的成本接近零**。

## 核心体验

**1. 长按说话，零摩擦录入**
按住麦克风、说一句话、松开。3 秒就能完成「想到 → 记下」。不用打字、不用归类、不用打开任何分类菜单。

**2. AI 自动归桶**
Gemini / OpenAI 端到端解析你的原话，提取任务文本、时间预期、场景（在家 / 在工位 / 在外）、优先级。模糊表达（「下周吧」「等闲下来」）也能正确归类。没明确时间词时**不会**乱填 deadline，避免「莫名其妙过期的任务」。

**3. 跨场景唤醒**
打开 App 切到「在家」桶，看到的就是「家里能做」的那批事；切到「工位」桶，那些事自动隐去、被「公司能做」的事替代。任务不再是一长条扁平列表，而是按你**此刻在哪、有多少时间**自然分组。

**4. 多端同步**
Web App（PWA）已稳定运行，iOS App 处于 Phase 2 开发中。两端共享同一份后端、同一份意图解析逻辑、同一套数据模型。

## 当前状态

- **Web 端**：已稳定运行（v0.8+），覆盖语音录入、AI 归类、Today / All / Completed / 详情页 / 附件 / PWA 离线壳。
- **iOS 端**：Phase 2 进行中，对齐 Web MVP（语音录入、列表、详情页、Sign in with Apple、SecureStore token）。Siri / Live Activity / 端侧 ASR 等原生差异化能力作为 Phase 3 战略预留。
- **完整路线图**：见 [TODO.md](./TODO.md)。

## 技术栈一句话

Monorepo（pnpm + Turborepo），Web 用 Next.js 16 + OpenNext 部署到 Cloudflare Workers，iOS 用 Expo + React Native，数据库 TiDB Serverless（自带向量 + 全文混合搜索），AI 走 Gemini / 兼容 OpenAI 协议双 provider。深入细节见下方「项目结构」与 [DEV_NOTE.md](./DEV_NOTE.md)。

---

## 项目结构

代码库是 pnpm workspaces + Turborepo 单仓，分为 `apps/`（具体应用）和 `packages/`（共享逻辑）：

```
/
├── apps/
│   ├── web/        # 全栈 Web 端（Next.js 16 + OpenNext + Cloudflare Workers）
│   └── app/        # iOS 端（Expo SDK 55 + React Native + expo-router）
├── packages/
│   └── shared/     # 共享层：Zod schemas + Drizzle schema + rerank/applyIntent 纯函数
├── package.json
└── pnpm-workspace.yaml
```

### 各模块职责

**`apps/web` · 全栈 Web 端 · MVP 核心**
- 框架：Next.js 16 + OpenNext，整体部署到 Cloudflare Workers。
- 前端：TailwindCSS + 自研 base-ui 风格 UI 组件库，Zustand 管录音/任务流状态，Better-Auth 全栈打通鉴权。
- 服务端：API Routes 处理鉴权、AI 编排（Gemini / OpenAI）、TiDB 混合搜索、R2 音频归档。`waitUntil` 异步存原声音频供后续 debug。
- 环境变量：严格区分 build-time 与 runtime（wrangler.jsonc envs + secrets），通过 `getCloudflareContext()` 取边缘节点变量。

**`apps/app` · iOS 端**
- 脚手架：Expo SDK 55 + expo-router，pnpm monorepo + `node-linker=hoisted`。
- 鉴权：Better-Auth bearer plugin + `expo-secure-store` 持久 token；Sign in with Apple 走纯原生流。
- UI：NativeWind v4，paper 主题 token 硬编码（RN 不支持 CSS 变量）。
- API：类型来自 `@mui-memo/shared`，bearer header 自动挂。

**`packages/shared` · 单一真理源**
- 职责：消除前后端类型不一致导致的沟通成本。
- 内容：数据模型（`TaskView` 等）、Zod schemas、纯函数（`rerank` 分桶排序、`applyIntent` 把语音意图合并到任务列表）。
- 构建：`tsup` 输出 ESM，三个子路径导出 `./schema` / `./validators` / `./logic`。Cloudflare Workers / Node / RN Metro 均可消费。
- ⚠️ RN 端**只许** import `./validators` 和 `./logic`，`./schema` 拖 drizzle-orm + TiDB 驱动，Metro 不认。

### 想了解更多

- [DEV_NOTE.md](./DEV_NOTE.md) — 长期关注的基建、框架知识、决策备忘录（TiDB 自动 embedding、OpenNext 构建、Better-Auth bearer、Metro 配置、AI Provider 切换、iOS 鉴权细节等）。面向 3 个月后入职的同事。
- [TODO.md](./TODO.md) — 演进路线 Phase 0-4：Phase 0 / 1 / Web MVP 已完成，Phase 2 iOS 进行中，Phase 3 / 4 战略预留。
- [AGENTS.md](./AGENTS.md) — AI 协作规范（中文优先、TS 严格类型、小步提交、测试先行等）。
- [TESTING.md](./TESTING.md) — 测试约定（vitest 单测 + Playwright e2e）。
