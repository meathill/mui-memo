# E2E (Playwright)

## 运行

```bash
# 在 apps/web 目录下
pnpm e2e           # 跑完整套件
pnpm e2e:ui        # Playwright UI 模式，便于单条调试
```

首次运行前：`pnpm exec playwright install chromium`（已在 CI/本地安装则跳过）。

## 架构

- **webServer**：Playwright 自动 `pnpm dev` 启一个 dev server（端口 3100），`BETTER_AUTH_URL=http://localhost:3100`。
- **E2E 守护**：只有 `wrangler.jsonc` 的 `env.dev.vars.E2E_ENABLED === "1"` 时，`/api/test-e2e/*` 端点才存在；production 环境不注入此 flag。
- **`/api/test-e2e/intent`**：接收 JSON Utterance + place，直接跑 `applyIntent` + 持久化，**绕过 Gemini**；嵌入可选（测试里默认 `skipEmbedding:true` 避免外部调用）。
- **`/api/test-e2e/cleanup`**：按邮箱（支持 SQL LIKE 通配 `%`）删除 tasks 或 user 级联。
- **Auth project**：`auth.setup.ts` 注册一个 `e2e+fixture@muimemo.test` 用户、走完 onboarding、把 cookies + localStorage 存到 `.auth/user.json`。后续所有 spec 复用这个 storageState。
- **Teardown**：`e2e/teardown.ts` 跑完测试后把 `e2e+%@muimemo.test` 邮箱的用户/会话/任务全部级联清除。
- **Fixtures**（`fixtures.ts`）：`inject()` / `resetTasks()` 用 `page.request` 保证带上 session cookie，任务归属正确。

## 套件范围

| 文件 | 覆盖 |
|---|---|
| `auth.setup.ts` | 注册 → onboarding → storage state |
| `today.spec.ts` | ADD / STATUS / DONE 意图注入 + 场景切换改变分桶 |
| `navigation.spec.ts` | 底部导航四 tab 往返 |
| `completion.spec.ts` | 手动勾选 → Today 消失 → Completed 出现 → Profile 统计 |
| `all.spec.ts` | 按 tag 分组展示 |
| `onboarding.spec.ts` | Profile 重置引导 + 跳过按钮 |

所有 spec 串行运行（`workers: 1`），共享同一个 e2e 用户；每个 spec 在 beforeEach 里 `resetTasks()` 清空任务保持独立。

## 已知注意点

- **E2E_ENABLED 注入在 wrangler.jsonc 的 dev env**：便于 `getCloudflareContext()` 读取；一定不要复制到 production env。
- **dev 端口默认 3100**，避开本地常用的 3000，防止误连开发中的个人实例。
- **不测录音 UI**：浏览器 `MediaRecorder` 在 headless 里很难稳定触发；语音链路通过注入 Utterance 验证。完整语音 + Gemini 回归由人工跑。
- **Better-Auth baseURL**：webServer.env 里设了 `BETTER_AUTH_URL`，同时 `createAuth()` 读取 `process.env.BETTER_AUTH_URL` 并写入 `trustedOrigins`，缺一都会导致登录后 cookie 不回种。
