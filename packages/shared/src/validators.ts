import { z } from 'zod';

// ──────────────────────────────────────────────
// 枚举
// ──────────────────────────────────────────────

export const taskPlaceEnum = z.enum(['home', 'work', 'out', 'any']);
export type TaskPlace = z.infer<typeof taskPlaceEnum>;

export const taskWindowEnum = z.enum(['now', 'today', 'later']);
export type TaskWindow = z.infer<typeof taskWindowEnum>;

export const taskStatusEnum = z.enum(['pending', 'doing', 'done', 'linked']);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

export const intentKindEnum = z.enum(['ADD', 'STATUS', 'DONE', 'MODIFY', 'LINK']);
export type IntentKind = z.infer<typeof intentKindEnum>;

export const dimKindEnum = z.enum([
  'intent',
  'match',
  'time',
  'place',
  'people',
  'tag',
  'note',
  'energy',
  'link',
]);

export const dimToneEnum = z.enum(['accent', 'good', 'warn', 'mute']);

// ──────────────────────────────────────────────
// 任务基础 schema
// ──────────────────────────────────────────────

/**
 * 任务的结构化字段（AI 从语音中抽取的核心维度）
 */
export const taskCoreSchema = z.object({
  text: z.string().min(1),
  place: taskPlaceEnum.default('any'),
  window: taskWindowEnum.default('today'),
  energy: z.number().int().min(1).max(3).default(2),
  priority: z.number().int().min(1).max(3).default(2),
  tag: z.string().max(32).optional(),
  deadline: z.string().max(64).optional(),
  /**
   * 预期完成时间（用户「打算做」的时刻）。ISO 8601 带时区偏移。
   * 例：「明天下午三点给老妈打电话」→ expectAt = 明天 15:00。
   */
  expectAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: "invalid ISO datetime",
    })
    .optional(),
  /**
   * 真正的 deadline（最晚要完成的时刻），可能晚于 expectAt。
   * 例：「明天做，最晚这周」→ expectAt=明天，dueAt=本周日 23:59。
   */
  dueAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: "invalid ISO datetime",
    })
    .optional(),
});
export type TaskCore = z.infer<typeof taskCoreSchema>;

export const taskEntitiesSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional();

/**
 * 创建任务（含 AI 原始输入）
 */
export const createTaskSchema = taskCoreSchema.extend({
  rawText: z.string().min(1, '原始文本不能为空'),
  actionType: z.string().max(50).optional(),
  entities: taskEntitiesSchema,
  aiReason: z.string().optional(),
  status: taskStatusEnum.default('pending'),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// ──────────────────────────────────────────────
// 语音意图 (Utterance) —— Gemini 输出契约
// ──────────────────────────────────────────────

/**
 * AI 逐步推断出来的维度，前端以 chip 流式展示
 */
export const dimSchema = z.object({
  kind: dimKindEnum,
  label: z.string(),
  tone: dimToneEnum.default('mute'),
  hint: z.string().default(''),
});
export type Dim = z.infer<typeof dimSchema>;

/**
 * 语音意图完整结构
 * 这是 Gemini 解析后吐出来的 JSON，前端/后端共用。
 */
export const utteranceSchema = z.object({
  raw: z.string(),
  intent: intentKindEnum,
  /** 供 applyIntent 在现有任务里做字符串匹配（支持正则） */
  match: z.string().optional(),
  /** 经服务端混合搜索后解析到的任务 id（优先于 match） */
  matchId: z.string().optional(),
  aiReason: z.string().default(''),
  aiVerb: z.string().default(''),
  /** ADD 时必填：新建任务的字段 */
  task: taskCoreSchema.partial().optional(),
  /** MODIFY / STATUS 时的补丁 */
  patch: taskCoreSchema.partial().extend({ status: taskStatusEnum.optional() }).optional(),
  /** DONE 时如果清单无匹配，允许 AI 提供补记字段 */
  createIfMissing: taskCoreSchema.partial().optional(),
  dims: z.array(dimSchema).default([]),
});
export type Utterance = z.infer<typeof utteranceSchema>;

// ──────────────────────────────────────────────
// API 输入校验
// ──────────────────────────────────────────────

export const intentQuerySchema = z.object({
  query: z.string().min(1, '查询内容不能为空'),
});
export type IntentQueryInput = z.infer<typeof intentQuerySchema>;

export const batchCompleteSchema = z.object({
  taskIds: z.array(z.string()).min(1, '至少选择一个任务'),
});
export type BatchCompleteInput = z.infer<typeof batchCompleteSchema>;

export const setPlaceSchema = z.object({
  place: taskPlaceEnum,
});
