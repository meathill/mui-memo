# WIP · MuiMemo

> 当前活跃迭代：**landing 收尾 + web SEO / 静态内容页**（2026-04-23）。

线上稳定运行中。长期待办见 [TODO.md](./TODO.md)，架构与决策备忘见 [DEV_NOTE.md](./DEV_NOTE.md)。

## 当前任务

### Web SEO + 静态内容页

- 目标：把首页收成真正可索引的营销页，并补齐公开站点的基础内容与 SEO 入口
- 已完成：
  - [x] 单独提交漏掉的 landing 排版修正，不混入本轮 SEO 改动
  - [x] 首页从依赖 server session 的动态页改成静态营销页，CTA 改成客户端增强
  - [x] 抽出共享 marketing shell / footer，补齐 About / Contact / Privacy / Terms 入口
  - [x] 接入 `md` / `mdx` 内容体系，新增静态内容页模板与 `content-doc` 样式
  - [x] 新增 `/about`、`/contact`、`/privacy`、`/terms`
  - [x] 新增 `/robots.txt`、`/sitemap.xml`、统一站点级 OG / Twitter 分享图
  - [x] 根布局补齐 canonical / Open Graph / Twitter / authors / keywords
  - [x] `(auth)`、`(app)`、`/onboarding` 明确输出 `noindex`
  - [x] 校正 landing FAQ 中与当前数据删除能力不一致的表述
  - [x] 本地通过 build 验证：首页与四个静态内容页为静态路由，`/app` 保持动态

### 品牌 Logo + 平台 Icon

- 已完成：
  - [x] 以现有 `logo-mark / lockup / safari-pinned-tab` 为基础，补 `app-icon` 母版
  - [x] 用脚本批量导出 `apple-icon`、`192/512` 标准图标、`192/512 maskable`
  - [x] 将 landing 顶部品牌露出替换为 logo，避免只剩纯文本字标

## 已完成的里程碑

| 版本 | 主要内容 |
|---|---|
| v0.8.0 | 任务删除（详情页 + 已完成页）+ 最短录音 5s→3s |
| v0.7.x | Gemini prompt 严格化（无时间词不填 expectAt）+ 最短录音时长守护 |
| v0.5–0.6 | 切换 TiDB 原生 hybrid search（自动 embedding + fulltext + RRF）；移除手动 Gemini embedding |
| v0.4.x | 输入记录页 + utterance log；Today/All 下拉刷新 + Completed 游标分页；`expectAt` / `dueAt` 拆分 |
| v0.3.x | 任务详情页 + 附件（R2，前缀 `muimemo/`）+ 原始语音回放 |
| v0.2.x | e2e 套件扩充；Better-Auth baseURL 从 CF env 读取 |
| v0.1 | Web App MVP：语音意图闭环 + 5 页面 + 底部导航 + PWA |
