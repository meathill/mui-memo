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

export const dimKindEnum = z.enum(['intent', 'match', 'time', 'place', 'people', 'tag', 'note', 'energy', 'link']);

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
  tags: z.array(z.string().min(1).max(32)).max(12).optional(),
  deadline: z.string().max(64).optional(),
  /**
   * 预期完成时间（用户「打算做」的时刻）。ISO 8601 带时区偏移。
   * 例：「明天下午三点给老妈打电话」→ expectAt = 明天 15:00。
   */
  expectAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: 'invalid ISO datetime',
    })
    .optional(),
  /**
   * 真正的 deadline（最晚要完成的时刻），可能晚于 expectAt。
   * 例：「明天做，最晚这周」→ expectAt=明天，dueAt=本周日 23:59。
   */
  dueAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: 'invalid ISO datetime',
    })
    .optional(),
});
export type TaskCore = z.infer<typeof taskCoreSchema>;

export const taskEntitiesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional();

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
// 周期性任务（Recurring Tasks）
// ──────────────────────────────────────────────

/**
 * 重复频率：
 * - daily   每天（interval 天）
 * - weekly  每周（interval 周，interval=2 即每两周）
 * - monthly 每月（interval 月，按本地日历）
 * - workday 工作日（周一~周五）
 */
export const recurrenceFreqEnum = z.enum(['daily', 'weekly', 'monthly', 'workday']);
export type RecurrenceFreq = z.infer<typeof recurrenceFreqEnum>;

/**
 * 周期定义（模板）的核心字段。实例每期从这里复制生成。
 * anchorAt 是锚点时刻（ISO 8601），编码「星期几 / 号数 / 时刻」，也是周期切分的起点。
 * 不传则由服务端默认 now。
 * tzOffset 是创建端 getTimezoneOffset() 的分钟数，monthly / workday 用它按本地日历切分。
 */
export const recurrenceCoreSchema = z.object({
  text: z.string().min(1),
  place: taskPlaceEnum.default('any'),
  window: taskWindowEnum.default('today'),
  energy: z.number().int().min(1).max(3).default(2),
  priority: z.number().int().min(1).max(3).default(2),
  tags: z.array(z.string().min(1).max(32)).max(12).optional(),
  freq: recurrenceFreqEnum.default('weekly'),
  interval: z.number().int().min(1).max(52).default(1),
  anchorAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: 'invalid ISO datetime',
    })
    .optional(),
  tzOffset: z.number().int().min(-720).max(840).default(0),
});
export type RecurrenceCore = z.infer<typeof recurrenceCoreSchema>;

/** 创建周期任务：可选 linkTaskId，把现有任务挂成「当前期实例」。 */
export const createRecurrenceSchema = recurrenceCoreSchema.extend({
  linkTaskId: z.string().optional(),
});
export type CreateRecurrenceInput = z.infer<typeof createRecurrenceSchema>;

/** 编辑周期任务：所有字段可选。 */
export const updateRecurrenceSchema = recurrenceCoreSchema.partial();
export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;

// ──────────────────────────────────────────────
// 语音意图 (Utterance) —— AI 输出契约
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

const taskPatchSchema = taskCoreSchema.partial().extend({ status: taskStatusEnum.optional() });

/**
 * 单个 Action：一句话可以包含多个独立 action，由 AI 拆分。
 * 用 discriminated union 锁住每种 intent 的字段形状。
 */
export const actionSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('ADD'),
    aiReason: z.string().default(''),
    aiVerb: z.string().default(''),
    task: taskCoreSchema.partial(),
  }),
  z.object({
    intent: z.literal('STATUS'),
    aiReason: z.string().default(''),
    aiVerb: z.string().default(''),
    match: z.string().optional(),
    matchId: z.string().optional(),
    patch: taskPatchSchema.optional(),
  }),
  z.object({
    intent: z.literal('DONE'),
    aiReason: z.string().default(''),
    aiVerb: z.string().default(''),
    match: z.string().optional(),
    matchId: z.string().optional(),
    createIfMissing: taskCoreSchema.partial().optional(),
  }),
  z.object({
    intent: z.literal('MODIFY'),
    aiReason: z.string().default(''),
    aiVerb: z.string().default(''),
    match: z.string().optional(),
    matchId: z.string().optional(),
    patch: taskPatchSchema.optional(),
  }),
  z.object({
    intent: z.literal('LINK'),
    aiReason: z.string().default(''),
    aiVerb: z.string().default(''),
    match: z.string().optional(),
    matchId: z.string().optional(),
  }),
]);
export type Action = z.infer<typeof actionSchema>;

/**
 * 一次语音输入完整结构。AI 解析后吐出来的 JSON，前端/后端共用。
 */
export const utteranceSchema = z.object({
  raw: z.string(),
  actions: z.array(actionSchema).min(1),
  dims: z.array(dimSchema).default([]),
});
export type Utterance = z.infer<typeof utteranceSchema>;

// ──────────────────────────────────────────────
// 老 schema（兼容存量 DB 行 / 老客户端）
// ──────────────────────────────────────────────

/**
 * v0.x 时期的单意图 schema。仅供 `legacyToActions` 把存量数据规整到新结构。
 * 新写入一律用 `utteranceSchema`。
 */
export const legacyUtteranceSchema = z.object({
  raw: z.string(),
  intent: intentKindEnum,
  match: z.string().optional(),
  matchId: z.string().optional(),
  aiReason: z.string().default(''),
  aiVerb: z.string().default(''),
  task: taskCoreSchema.partial().optional(),
  patch: taskPatchSchema.optional(),
  createIfMissing: taskCoreSchema.partial().optional(),
  dims: z.array(dimSchema).default([]),
});
export type LegacyUtterance = z.infer<typeof legacyUtteranceSchema>;

/**
 * 把老的单意图 utterance 包装成新的 actions[1] 形态。
 * AI 客户端在 parse 失败时也用它兜底（旧 prompt 输出的 JSON 走这里）。
 */
export function legacyToActions(legacy: LegacyUtterance): Utterance {
  const base = {
    aiReason: legacy.aiReason,
    aiVerb: legacy.aiVerb,
  };
  let action: Action;
  switch (legacy.intent) {
    case 'ADD':
      action = { intent: 'ADD', ...base, task: legacy.task ?? { text: legacy.raw } };
      break;
    case 'STATUS':
      action = {
        intent: 'STATUS',
        ...base,
        ...(legacy.match ? { match: legacy.match } : {}),
        ...(legacy.matchId ? { matchId: legacy.matchId } : {}),
        ...(legacy.patch ? { patch: legacy.patch } : {}),
      };
      break;
    case 'DONE':
      action = {
        intent: 'DONE',
        ...base,
        ...(legacy.match ? { match: legacy.match } : {}),
        ...(legacy.matchId ? { matchId: legacy.matchId } : {}),
        ...(legacy.createIfMissing ? { createIfMissing: legacy.createIfMissing } : {}),
      };
      break;
    case 'MODIFY':
      action = {
        intent: 'MODIFY',
        ...base,
        ...(legacy.match ? { match: legacy.match } : {}),
        ...(legacy.matchId ? { matchId: legacy.matchId } : {}),
        ...(legacy.patch ? { patch: legacy.patch } : {}),
      };
      break;
    case 'LINK':
      action = {
        intent: 'LINK',
        ...base,
        ...(legacy.match ? { match: legacy.match } : {}),
        ...(legacy.matchId ? { matchId: legacy.matchId } : {}),
      };
      break;
  }
  return {
    raw: legacy.raw,
    actions: [action],
    dims: legacy.dims,
  };
}

/**
 * AI 返回的 JSON 既可能是新 schema 也可能是旧 schema（迁移期）。
 * 先尝试新，失败再走老。两个都失败抛错。
 */
export function parseUtteranceFlexible(json: unknown): Utterance {
  const newResult = utteranceSchema.safeParse(json);
  if (newResult.success) return newResult.data;
  const oldResult = legacyUtteranceSchema.safeParse(json);
  if (oldResult.success) return legacyToActions(oldResult.data);
  // 抛新 schema 的错误（信息更多）
  throw newResult.error;
}

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

// ──────────────────────────────────────────────
// /api/intent/confirm 输入
// ──────────────────────────────────────────────

const taskPatchPersistableSchema = taskPatchSchema; // 与 action.patch 同形

export const intentConfirmSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('modify'),
    taskId: z.string(),
    patch: taskPatchPersistableSchema,
  }),
  z.object({
    kind: z.literal('modify-as-add'),
    rawText: z.string(),
    task: taskCoreSchema.partial(),
    aiReason: z.string().optional(),
  }),
  z.object({
    kind: z.literal('done'),
    taskId: z.string(),
  }),
]);
export type IntentConfirmInput = z.infer<typeof intentConfirmSchema>;
