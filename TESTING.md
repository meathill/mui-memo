# 测试指南

本仓库测试分两层：

| 层 | 工具 | 范围 |
|---|---|---|
| 单元测试 | Vitest | 纯函数、工具库、(后续) UI 组件、API 路由的 unit |
| 端到端 | Playwright | 真实浏览器跑完整业务流（音频上传、登录、详情页等） |

## 怎么跑

```bash
# 全仓单测（turbo 派发到各包）
pnpm test

# 单独跑某个包
pnpm -F @mui-memo/shared test         # 共享层 logic / validators 测试
pnpm -F @mui-memo/web test            # web 单测
pnpm -F @mui-memo/web test:watch      # web watch 模式
pnpm -F @mui-memo/app test            # app 纯逻辑单测（SQLite/native 不直接跑）
pnpm -F @mui-memo/app check-types     # app 类型检查

# Web e2e（启动本地 next + Playwright）
pnpm -F @mui-memo/web e2e
pnpm -F @mui-memo/web e2e:ui
```

## 测试文件位置

**单测**：与被测文件**同级**、用 `*.test.ts(x)` 命名。

```
src/lib/time.ts
src/lib/time.test.ts          ← 同级，单测
```

**e2e**：放在各 app 的 `e2e/` 目录，用 `*.spec.ts`。

```
apps/web/e2e/auth.spec.ts
apps/web/e2e/intent.spec.ts
```

`vitest.config.ts` 的 `include` 显式只匹配 `src/**`，所以 `e2e/` 永远不会被 vitest 跑到。

## Web 端测试环境

`apps/web/vitest.config.ts` 配置：

- `environment: 'happy-dom'` — 提供轻量级 DOM 实现，比 jsdom 快、依赖少
- `setupFiles: ['./src/test/setup.ts']` — 全局 setup

`src/test/setup.ts` 给 `matchMedia` / `ResizeObserver` / `IntersectionObserver` 补了最小 stub。要测响应式或 observer 行为时，在具体测试里用 `vi.spyOn(window, 'matchMedia').mockImplementation(...)` 覆盖。

## App 端测试环境

`apps/app/vitest.config.ts` 用 Node 环境，只跑 `src/**/*.test.ts` 的纯逻辑测试。

- 不直接 import / mock `expo-sqlite`、`expo-audio` 等 native runtime。
- 本地缓存、迁移、TTL、标签候选这类策略先抽到纯函数再测。
- 需要模拟器或真机验证的页面行为，先写清验收步骤，不要把 native 模块硬塞进 Vitest。

## Shared 包测试

`packages/shared` 测试纯函数，覆盖率目标 100%。新增 `rerank` / `applyIntent` 路径时**必须**补单测——logic.ts 是前后端共用的真理源，回归代价高。

测试已覆盖：
- `logic.test.ts` — `rerank` 分桶排序、`applyIntent` 6 种 intent 全路径
- `validators.test.ts` — Zod schema 边界情况

## 保险箱（Secret Vault）手测清单

vault-keychain / vault-biometric 是 native 薄层，不进 Vitest，靠以下手测覆盖。
**新增了原生模块（react-native-keychain / expo-local-authentication / expo-clipboard），
必须重建 dev client**（`pnpm -F @mui-memo/app ios`），Expo Go 跑不了。

模拟器 Face ID：Features → Face ID → Enrolled，配合 Matching / Non-matching 两分支。

- [ ] 编辑任务 → 保险箱 → Face ID → 输入内容保存；首次保存弹「备份恢复码」引导
- [ ] 详情页出现保险箱卡片 → 解锁查看 → 复制（系统弹粘贴提示）→ 收起
- [ ] 修改已有内容；移除内容（两步确认）后详情页卡片消失，web 详情页占位提示同步消失
- [ ] 生物识别取消 → 静默返回不弹错；切后台再回来 → 自动上锁，重新认证后草稿还在
- [ ] 飞行模式：解锁/保存报「网络异常」，内容不丢；移除流程被中止（不清指针）
- [ ] 8000 字符粘贴被截断，计数器 >7800 变警示色
- [ ] 设置 → 任务保险箱：查看恢复码（Face ID）→ 抄下 → 卸载重装（或第二台设备）→ 导入恢复码 → 能解锁旧内容
- [ ] 导入错误的恢复码 → 解锁旧内容报「密钥与写入时不一致」（403），换回正确恢复码恢复
- [ ] 双真机同 Apple ID：设备 A 创建保险箱，设备 B（iCloud 钥匙串开启）稍候可直接解锁
- [ ] web 详情页：带保险箱的任务显示「请在 App 中查看」占位；web 上编辑其它字段不影响解锁

## 修 bug 的测试纪律

参见 [AGENTS.md](./AGENTS.md) 的「修复 bug」章节：

- 找到能稳定重现 bug 的方式（构建数据 / 重复步骤）
- 把重现方式固化成测试用例
- 修复后这些用例必须稳定通过
- 这些用例一直留下来作为回归保护

## Playwright Fixtures

`apps/web/e2e/fixtures/` 提供：

- `inject` — 直接注入语音意图，绕过 Gemini，用于隔离测前端逻辑
- `resetTasks` — 清空当前用户任务，保证用例独立性

测前请先 `pnpm install`、`pnpm exec playwright install`、`.dev.vars` 里配好 `BETTER_AUTH_URL=http://localhost:3200` 与 `TEST_USER_*`。

## 下一轮要补的覆盖

测试基建已就位，但业务代码大量未覆盖。下一轮预计补：

- [ ] `apps/web/src/lib/` 下未测的工具（gemini.ts / openai.ts / auth.ts / db.ts / intent.ts / search.ts / tasks.ts / theme.ts / utils.ts 等）
- [ ] `apps/web/src/app/api/` 路由的 schema 校验单测
- [ ] `apps/web/src/store/` Zustand store
- [ ] `apps/web/src/hooks/` 自定义 hook
- [ ] 复杂 components 的渲染 / 交互测（先挑高频高风险的几个）

不在本轮范围。
