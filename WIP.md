# WIP · MuiMemo

> 当前无活跃迭代。最近一次发布：**0.8.0**（2026-04）。

线上稳定运行中。长期待办见 [TODO.md](./TODO.md)，架构与决策备忘见 [DEV_NOTE.md](./DEV_NOTE.md)。

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
