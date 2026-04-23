import { sql } from 'drizzle-orm';
import { boolean, customType, int, json, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';

// ──────────────────────────────────────────────
// Custom Types (TiDB-specific)
// ──────────────────────────────────────────────

/**
 * TiDB 自动嵌入用到的模型。`tidbcloud_free/...` 前缀是 TiDB 自己托管的 free tier
 * 入口，不需要任何外部 API key；维度 1024。详见 TiDB Auto-Embedding 文档。
 */
export const TIDB_EMBED_MODEL = 'tidbcloud_free/amazon/titan-embed-text-v2';
export const EMBEDDING_DIM = 1024;

/**
 * TiDB Vector 类型。值直接用字符串 '[f,f,...]' 和 DB 交换；
 * 我们不再手动写 embedding，列是 GENERATED ALWAYS AS (EMBED_TEXT(...)) STORED
 * 由 TiDB 自己填。
 */
const vector1024 = customType<{ data: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIM})`;
  },
});

// ──────────────────────────────────────────────
// Better-Auth 鉴权表
// ──────────────────────────────────────────────

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accounts = mysqlTable('accounts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verifications = mysqlTable('verifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ──────────────────────────────────────────────
// 业务表：Tasks
// ──────────────────────────────────────────────

/**
 * 任务主表
 * 存储用户通过语音录入的意图，包含 AI 解析后的结构化数据及语义向量。
 *
 * 字段设计对齐产品设计稿：
 * - rawText: 原始语音转写文本（用户说的原话）
 * - text: 展示用的任务正文（AI 提炼/总结后的简洁表达）
 * - place: 执行地点 home / work / out / any
 * - taskWindow: 时间窗口 now / today / later（`window` 是保留字，避开冲突）
 * - energy: 精力开销 1-3
 * - priority: 优先级 1-3
 * - tag: 分类标签（中文，如「工作」「家务」「财务」）
 * - deadline: 自然语言截止（「下周一」「17:00」，不要求结构化）
 * - aiReason: AI 给出的排序/推断理由，在卡片小字展示
 * - status: pending | doing | done | linked
 * - linkedTo: 如果是挂在 doing 任务下的子任务，记录父任务 id
 * - entities: 其它 AI 解析的结构化实体 (people/amount/...)
 * - embedding: 语义向量（v1 暂不写入，v1.1 接入混合搜索）
 */
export const tasks = mysqlTable('tasks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  rawText: text('raw_text').notNull(),
  text: text('text').notNull(),
  place: varchar('place', { length: 10 }).notNull().default('any'),
  taskWindow: varchar('task_window', { length: 10 }).notNull().default('today'),
  energy: int('energy').notNull().default(2),
  priority: int('priority').notNull().default(2),
  tag: varchar('tag', { length: 32 }),
  deadline: varchar('deadline', { length: 64 }),
  /**
   * 预期完成时间：用户原话里「打算做的时间」，如「明天下午三点」。
   * 未来会被 rerank 用来排序、被 UI 用来显示相对时间 label。
   */
  expectAt: timestamp('expect_at'),
  /**
   * 真正的 deadline：可以晚于 expectAt，AI 只有用户显式说了才填。
   * 例如「明天做，最晚这周」→ expectAt=明天，dueAt=周日 23:59。
   */
  dueAt: timestamp('due_at'),
  aiReason: text('ai_reason'),
  actionType: varchar('action_type', { length: 50 }),
  entities: json('entities'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  linkedTo: varchar('linked_to', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  /**
   * TiDB 自动生成的语义向量（基于 `text` 列）。写入时不要手动赋值。
   * 读出来的值我们用不到；声明它只是为了 schema 一致 + 让 drizzle
   * 能识别该列。
   */
  embedding: vector1024('embedding').generatedAlwaysAs(sql.raw(`EMBED_TEXT("${TIDB_EMBED_MODEL}", \`text\`)`), {
    mode: 'stored',
  }),
  /** 创建这条任务的原始语音 R2 key（仅 ADD / DONE-backfill 会填）。 */
  audioKey: varchar('audio_key', { length: 512 }),
});

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;

// ──────────────────────────────────────────────
// 附件
// ──────────────────────────────────────────────

/**
 * 任务附件：指向 R2 中的实际对象。
 * `key` 是完整 R2 object key，已包含 `muimemo/` 前缀。
 */
export const attachments = mysqlTable('attachments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  taskId: varchar('task_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  key: varchar('r2_key', { length: 512 }).notNull(),
  mime: varchar('mime', { length: 128 }).notNull(),
  size: int('size').notNull(),
  originalName: varchar('original_name', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type AttachmentRow = typeof attachments.$inferSelect;
export type NewAttachmentRow = typeof attachments.$inferInsert;

// ──────────────────────────────────────────────
// 输入记录（每一次 /api/intent 的原始语音 → AI 结果）
// ──────────────────────────────────────────────

/**
 * 每条 utterance 是一次用户语音事件（ADD / STATUS / DONE / MODIFY / LINK）。
 * 存下来让用户能在「我的 · 输入记录」里翻看自己说过什么、AI 是怎么理解的。
 */
export const utterances = mysqlTable('utterances', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  /** AI 转写出的原话 */
  rawText: text('raw_text').notNull(),
  /** ADD / STATUS / DONE / MODIFY / LINK */
  intent: varchar('intent', { length: 16 }).notNull(),
  /** effect.kind：add / status / done / done-backfill / modify / link / miss */
  effectKind: varchar('effect_kind', { length: 24 }).notNull(),
  /** effect.verb 直接用作展示主文案 */
  verb: varchar('verb', { length: 32 }),
  /** effect.reason 保存为展示副文案 */
  reason: text('reason'),
  /** 如果命中 / 产生了某个 task，记它的 id（可能是新建、可能是已存在） */
  taskId: varchar('task_id', { length: 36 }),
  /** R2 里原始语音的 key，没存音频就为 null */
  audioKey: varchar('audio_key', { length: 512 }),
  /** AI 给出的 dims[]，用 JSON 保留便于未来加调试面板 */
  dims: json('dims'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type UtteranceRow = typeof utterances.$inferSelect;
export type NewUtteranceRow = typeof utterances.$inferInsert;
