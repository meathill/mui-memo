# 开发笔记

长期关注的基建、框架知识、决策备忘录。

## 版本号约定

- `apps/web/package.json` 的 `version` 在构建时由 `apps/web/next.config.ts` 通过 `env.NEXT_PUBLIC_APP_VERSION` 注入到客户端 bundle
- 「我的」页面底部展示当前版本号，方便与用户沟通线上问题
- 每次开发迭代合入前请手动调升版本号：bug 修复 patch、功能 minor、破坏性变更 major
- 暂不做自动化 bump（changesets 等），保持简洁

## 不装 @cloudflare/workers-types

- 2026-04 尝试过把官方 types 当 devDep 装进 `apps/web`（顺带搬到
  `packages/shared`），想换掉 `cloudflare-env.d.ts` 里手写的 R2Bucket 接口。
- pnpm 按 peer-dep 上下文给 drizzle-orm 另起了一份实例
  (`drizzle-orm_@cloudflare+workers-types_..._hash`)，和 `packages/shared`
  里 drizzle 实例分裂，schema 定义的表在 `apps/web` 侧直接变成"不兼容"，
  所有 `eq(tasksTable.userId, ...)` 全报 TS 错。
- 试过 pnpm `overrides` 锁版本、`public-hoist-pattern=drizzle-orm`、给
  shared 也补 workers-types —— 都因为 peer 上下文 hash 不同没解决。
- 结论：继续用 `cloudflare-env.d.ts` 手写最小 R2Bucket / R2ObjectBody
  接口。OpenNext 运行时不依赖这些 types；少量手写 < pnpm/drizzle 生态债。
