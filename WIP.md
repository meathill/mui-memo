# WIP · MuiMemo

> 当前活跃迭代：**landing 中度重构 + 场景插画**（2026-04-23）。

线上稳定运行中。长期待办见 [TODO.md](./TODO.md)，架构与决策备忘见 [DEV_NOTE.md](./DEV_NOTE.md)。

## 当前任务

### 品牌 Logo + 平台 Icon

- 设计一套符合 `paper / deliberate / calm` 基线的 MuiMemo logo
- 提供可复用的矢量母版（logo mark / lockup）
- 生成 favicon、Apple touch icon、PWA / Android icon
- 补齐 manifest 里的 `icons` 声明
- 尽量让桌面浏览器、iOS 主屏、Android 安装图标都能直接吃到
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
