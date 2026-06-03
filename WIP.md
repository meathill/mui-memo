# WIP · MuiMemo

> 周期性任务功能代码已完成（shared / web / app 三层 + 单测）。
> **唯一待办（需 `.env`，由你执行）**：应用迁移 0010 —— `pnpm -F @mui-memo/web db:migrate`
> （迁移文件 `apps/web/drizzle/0010_small_rictor.sql` 已就位且核对过：仅建 `recurrences` 表 +
> 给 `tasks` 加 `recurrence_id/period_index` + 唯一约束，未触碰向量/全文索引）。
> 架构与决策见 [DEV_NOTE.md](./DEV_NOTE.md) 的「周期性任务」章节。

下一轮起新迭代时，再把当轮目标与任务分解写到这里。

## 已完成的里程碑

| 版本 | 主要内容 |
|---|---|
| v0.9（待发） | 周期性任务：每天/每周/每两周/每月/工作日；定义表 + 实例为普通 task；lazy-on-fetch 对账生成/清理；编辑页「重复」开关；未完成自动删、完成进历史 |
| v0.8.x | 支持在编辑任务时设置自定义的具体预期时间，保留原有快捷键 |
| v0.8.0 | 任务删除（详情页 + 已完成页）+ 最短录音 5s→3s |
| v0.7.x | Gemini prompt 严格化（无时间词不填 expectAt）+ 最短录音时长守护 |
| v0.5–0.6 | 切换 TiDB 原生 hybrid search（自动 embedding + fulltext + RRF）；移除手动 Gemini embedding |
| v0.4.x | 输入记录页 + utterance log；Today/All 下拉刷新 + Completed 游标分页；`expectAt` / `dueAt` 拆分 |
| v0.3.x | 任务详情页 + 附件（R2，前缀 `muimemo/`）+ 原始语音回放 |
| v0.2.x | e2e 套件扩充；Better-Auth baseURL 从 CF env 读取 |
| v0.1 | Web App MVP：语音意图闭环 + 5 页面 + 底部导航 + PWA |
