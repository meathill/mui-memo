import { z } from 'zod';

// ──────────────────────────────────────────────
// Task Validators
// ──────────────────────────────────────────────

/**
 * 任务状态枚举
 */
export const taskStatusEnum = z.enum(['frozen', 'active', 'completed']);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

/**
 * AI 解析后的结构化实体
 */
export const taskEntitiesSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional();

/**
 * 创建任务时的输入校验（来自 AI 解析结果）
 */
export const createTaskSchema = z.object({
  rawText: z.string().min(1, '原始文本不能为空'),
  actionType: z.string().max(50).optional(),
  entities: taskEntitiesSchema,
  status: taskStatusEnum.default('frozen'),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * 场景声明 / 意图唤醒的输入校验
 */
export const intentQuerySchema = z.object({
  query: z.string().min(1, '查询内容不能为空'),
});
export type IntentQueryInput = z.infer<typeof intentQuerySchema>;

/**
 * 批量完成任务的输入
 */
export const batchCompleteSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, '至少选择一个任务'),
});
export type BatchCompleteInput = z.infer<typeof batchCompleteSchema>;
