import {
  boolean,
  customType,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

// ──────────────────────────────────────────────
// Custom Types (TiDB-specific)
// ──────────────────────────────────────────────

/**
 * TiDB Vector 类型（768 维，匹配 Gemini text-embedding-004）
 * TiDB 接受 '[1.0,2.0,…]' 格式的字符串；读出时也是字符串，需要解析。
 */
export const EMBEDDING_DIM = 768;

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `VECTOR(${EMBEDDING_DIM})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) return value as number[];
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return [];
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
  embedding: vector('embedding'),
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
