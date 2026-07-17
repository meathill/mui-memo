# WIP · MuiMemo

## 当前迭代:任务保险箱(Secret Vault)

### 目标

- 每个任务可选附加「保险箱」:任务本体保持明文(便于检索),秘密值(API key 等自由文本,≤8000 字符)加密存用户自有 HSM(https://hsm.meathill.com)。
- 零知识:mui-memo 服务器只存 `vault_key` 指针(随机 UUID);密文在 HSM(信封加密),解密密钥(X-HSM-Secret,32 字节随机 hex)在设备 Keychain,iOS 经 iCloud Keychain 同步。
- 解锁走 App 层生物识别门控(expo-local-authentication;iOS 上 synchronizable 与条目级 SecAccessControl 互斥,故不用 Keychain 级门控)。
- v1 仅 App;web 详情页只显示「请在 App 查看」占位。恢复码(64 位 hex)兜底 Android/iCloud 关闭场景。

### 完整计划

见 `~/.claude/plans/to-do-list-ai-ai-apik-hsm-https-hsm-mea-misty-kite.md`(含错误处理矩阵、测试计划、风险)。

### 状态:✅ 代码完成,待真机验收

1. ✅ shared:tasks 加 `vault_key varchar(64)`;`updateTaskSchema`(vaultKey 只在手动 PATCH 出现,AI 链路 strip,不变量测试锁死);TaskView 加字段
2. ✅ web:PATCH/GET/rowToView/listTasksForUser 支持 vaultKey;迁移 0012 已生成(**db:migrate 由 Meathill 执行**);详情页占位提示
3. ✅ app 依赖:react-native-keychain ^10(iCloud cloudSync 确认)+ expo-local-authentication(faceIDPermission plugin)+ expo-clipboard
4. ✅ vault 基础库五件套(vault-model / vault-hsm 有单测;keychain/biometric 薄层手测)
5. ✅ 指针打通:api.ts TaskPatch、local-cache-model 三态透传
6. ✅ 保险箱编辑屏(modal)+ edit.tsx 入口 Section
7. ✅ 详情页解锁卡(task-vault-card 组件)
8. ✅ 设置屏 vault-settings(状态/查看恢复码/导入)+ profile 入口;注销时删本机 Keychain 条目
9. ✅ 文档与回归(TESTING.md 手测清单、DEV_NOTE.md 记 pnpm 11 / keychain 结论)

**遗留验收项(需要真机/模拟器,见 TESTING.md 保险箱手测清单)**:重建 dev client 后跑全流程;双机 iCloud 同步;恢复码导入导出。

**顺手修的仓库问题**:pnpm 11 不读 .npmrc → nodeLinker 迁入 pnpm-workspace.yaml(详见 DEV_NOTE.md),否则 Metro 与 pod install 都会挂。

### 关键不变量(实现时随时自检)

- 明文只活在 screen 的 useState / 函数返回值;禁入 zustand persist、SQLite、日志、`task.text`(该列被 TiDB EMBED_TEXT 自动嵌入)。
- vaultKey 指针只能经 `updateTaskSchema`(手动 PATCH)写入。
- 移除保险箱时 HSM DELETE 网络失败要中止(403/404 可继续),避免远端留可解密内容而本地丢入口。

## ⚠️ 待 Meathill 执行(需 `.env`)

- 迁移 0010 / 0011 若生产库尚未应用,以及本轮新增的 0012(保险箱):

```bash
pnpm -F @mui-memo/web db:generate   # 生成 0012(AI 无法执行,drizzle.config 需 TIDB_DATABASE_URL)
pnpm -F @mui-memo/web db:migrate
```

## 已完成的里程碑

| 版本 | 主要内容 |
|---|---|
| v0.9(待发) | 周期性任务:每天/每周/每两周/每月/工作日;定义表 + 实例为普通 task;lazy-on-fetch 对账生成/清理;编辑页「重复」开关 |
| v0.8.x | 编辑任务时设置具体预期时间,保留快捷键 |
| v0.8.0 | 任务删除(详情页 + 已完成页)+ 最短录音 5s→3s |
| v0.7.x | Gemini prompt 严格化(无时间词不填 expectAt)+ 最短录音时长守护 |
| v0.5–0.6 | TiDB 原生 hybrid search(自动 embedding + fulltext + RRF) |
| v0.4.x | 输入记录页 + utterance log;下拉刷新 + 游标分页;`expectAt` / `dueAt` 拆分 |
| v0.3.x | 任务详情页 + 附件(R2)+ 原始语音回放 |
| v0.2.x | e2e 套件扩充;Better-Auth baseURL 从 CF env 读取 |
| v0.1 | Web App MVP:语音意图闭环 + 5 页面 + 底部导航 + PWA |
