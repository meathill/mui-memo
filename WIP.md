# WIP · MuiMemo

## 当前迭代：SQLite 本地读模型 + 语音标签增强

### 目标

- App 以本地 SQLite 读模型为主：任务列表、已完成首屏、任务详情先读本地，再后台刷新远程。
- 远程 API 仍是权威数据源；本轮不做离线 mutation outbox。
- 语音解析带上 app 本地 + 服务端最近使用过的标签候选，最多 100 个，引导 AI 复用接近标签。

### 状态：✅ 代码完成，验证通过

1. ✅ **语音标签候选**：app 上传本地标签候选，服务端再合并 TiDB 最近标签候选；prompt 最多注入 100 个标签，并要求近义/同义/上下位时复用原标签。
2. ✅ **App 本地缓存**：新增 `expo-sqlite` + `local-db.ts`，建 `local_tasks` / `local_completed_tasks` / `local_task_details` / `sync_meta`。
3. ✅ **同步辅助层**：新增 `task-sync.ts`，集中处理 SQLite hydrate、60 秒 TTL 后台刷新、远程结果写回 SQLite + Zustand。
4. ✅ **页面改造**：Today / All / Completed / Detail / Edit 改为缓存优先；完成、恢复、删除、编辑先本地乐观更新，远程失败回滚。
5. ✅ **账号隔离 + 存量迁移**：启动时按用户准备本地缓存；旧 AsyncStorage tasks 一次性迁入 SQLite；退出/注销时清 SQLite 缓存和内存任务快照。

### 已跑验证

```bash
pnpm --config.store-dir=/Users/meathill/Library/pnpm/store/v11 -F @mui-memo/app check-types
pnpm --config.store-dir=/Users/meathill/Library/pnpm/store/v11 -F @mui-memo/app test
pnpm --config.store-dir=/Users/meathill/Library/pnpm/store/v11 -F @mui-memo/web test
pnpm --config.store-dir=/Users/meathill/Library/pnpm/store/v11 -F @mui-memo/shared test
pnpm --config.store-dir=/Users/meathill/Library/pnpm/store/v11 run format
pnpm --config.store-dir=/Users/meathill/Library/pnpm/store/v11 run build
```

## ⚠️ 历史遗留待办（需 `.env`，由你执行）

迁移 0010 / 0011 若生产库尚未应用，仍需执行：

```bash
pnpm -F @mui-memo/web db:migrate
```

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
