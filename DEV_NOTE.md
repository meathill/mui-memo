# 开发笔记

长期关注的基建、框架知识、决策备忘录。

## 版本号约定

- `apps/web/package.json` 的 `version` 在构建时由 `apps/web/next.config.ts` 通过 `env.NEXT_PUBLIC_APP_VERSION` 注入到客户端 bundle
- 「我的」页面底部展示当前版本号，方便与用户沟通线上问题
- 每次开发迭代合入前请手动调升版本号：bug 修复 patch、功能 minor、破坏性变更 major
- 暂不做自动化 bump（changesets 等），保持简洁
