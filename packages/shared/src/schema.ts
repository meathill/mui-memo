import {
  customType,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  int,
} from 'drizzle-orm/mysql-core';

// ──────────────────────────────────────────────
// Custom Types (TiDB-specific)
// ──────────────────────────────────────────────

/**
 * TiDB Vector 类型
 * 用于存储语义向量 (Embedding)，支持 TiDB 的向量距离检索。
 */
const vector = customType<{ data: number[] }>({
  dataType() {
    return 'VECTOR(1536)';
  },
});

// ──────────────────────────────────────────────
// Better-Auth 鉴权表
// 参考: https://www.better-auth.com/docs/installation
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
 */
export const tasks = mysqlTable('tasks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  rawText: text('raw_text').notNull(),
  actionType: varchar('action_type', { length: 50 }),
  entities: json('entities'),
  status: varchar('status', { length: 20 }).notNull().default('frozen'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  embedding: vector('embedding'),
});
