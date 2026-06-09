# WIP · MuiMemo

## 当前迭代：单标签 → 多标签（tags: string[]）

### 目标
任务从单个 `tag` 改为多个 `tags`。编辑页支持标签芯片增 / 删 / 点击改。
筛选栏仍单选（按某 tag 过滤 = 任务 `tags` 包含该 tag）——BarChip/activeTag 不动，只改 `filterByTag` 为 `.includes`。

### 数据与兼容策略
- DB(TiDB)：tasks / recurrences 加 `tags json`，**保留旧 `tag` 列**（弃用，作回填源 + 回滚）。
- 读：`tags ?? (tag ? [tag] : [])`（回填前也能读，不炸）。写：只写 `tags`（始终是数组，含空 `[]`）。
- 迁移：drizzle 加列 + 回填 `UPDATE ... SET tags = JSON_ARRAY(tag) WHERE tag <> ''`。我生成，你跑 `db:migrate`。

### 状态：✅ 代码完成（shared 96 + web 73 单测全过，app/web typecheck 全绿），待跑迁移 + 部署
1. ✅ **shared**：validators(`tags` 数组)、logic(`TaskView.tags` / `filterByTag` includes / applyAction / snapshot)、dto、recurrence、schema(json 列)、tests。
2. ✅ **web 后端**：lib/tasks.ts / recurrences.ts（读回退 + 写 tags）、api routes、intent-shared(AI schema + prompt)、tests。
3. ✅ **app**：edit.tsx 多标签芯片编辑器、today allTags、all 分组(按每个 tag)、index/completed 展示、lib/api.ts。
4. ✅ **web 前端**：all-view 分组、task-row/completed-view 展示、task-detail-view 多标签编辑。
5. ✅ **迁移**：`apps/web/drizzle/0011_keen_storm.sql`（加 `tags` json 列 + 从旧 `tag` 回填 `JSON_ARRAY`）。

### ⏳ 待你执行（需 `.env`）：跑迁移 + 部署
**顺序**：先跑 DB 迁移（加列 + 回填）→ 部署 web（读有回退，迁移前后都安全）→ 发 app。
```
pnpm -F @mui-memo/web db:migrate   # 应用 0010(若没跑过) + 0011
```

---

## ⚠️ 历史遗留待办（需 `.env`，由你执行）
迁移 0010 —— `pnpm -F @mui-memo/web db:migrate`
（`apps/web/drizzle/0010_small_rictor.sql`：建 `recurrences` 表 + 给 `tasks` 加 `recurrence_id/period_index` + 唯一约束。
若已应用过可忽略。多标签的新迁移会排在它之后。）

## 已完成的里程碑

| 版本 | 主要内容 |
|---|---|
| v0.9（待发） | 周期性任务：每天/每周/每两周/每月/工作日；定义表 + 实例为普通 task；lazy-on-fetch 对账生成/清理；编辑页「重复」开关 |
| v0.8.x | 编辑任务时设置具体预期时间，保留快捷键 |
| v0.8.0 | 任务删除（详情页 + 已完成页）+ 最短录音 5s→3s |
| v0.7.x | Gemini prompt 严格化（无时间词不填 expectAt）+ 最短录音时长守护 |
| v0.5–0.6 | TiDB 原生 hybrid search（自动 embedding + fulltext + RRF） |
| v0.4.x | 输入记录页 + utterance log；下拉刷新 + 游标分页；`expectAt` / `dueAt` 拆分 |
| v0.3.x | 任务详情页 + 附件（R2）+ 原始语音回放 |
| v0.2.x | e2e 套件扩充；Better-Auth baseURL 从 CF env 读取 |
| v0.1 | Web App MVP：语音意图闭环 + 5 页面 + 底部导航 + PWA |
