import { describe, expect, it } from 'vitest';
import { utteranceSchema } from './validators.js';

describe('utteranceSchema', () => {
  it('ADD 意图最小载荷可通过，顶层字段取默认值', () => {
    // 注意：utterance.task 是 taskCoreSchema.partial()，子字段是可选无默认的
    const parsed = utteranceSchema.parse({
      raw: '晚上下班带点水',
      intent: 'ADD',
      task: { text: '带水' },
    });
    expect(parsed.intent).toBe('ADD');
    expect(parsed.dims).toEqual([]);
    expect(parsed.aiReason).toBe('');
    expect(parsed.aiVerb).toBe('');
    expect(parsed.task?.text).toBe('带水');
    // task 是 partial schema：未传字段保持 undefined，交给 applyIntent 兜底
    expect(parsed.task?.place).toBeUndefined();
    expect(parsed.task?.window).toBeUndefined();
  });

  it('未知 intent 被拒绝', () => {
    const res = utteranceSchema.safeParse({
      raw: 'x',
      intent: 'UNKNOWN',
    });
    expect(res.success).toBe(false);
  });

  it('dim 的默认 tone 是 mute', () => {
    const parsed = utteranceSchema.parse({
      raw: 'x',
      intent: 'DONE',
      dims: [{ kind: 'intent', label: '已完成' }],
    });
    expect(parsed.dims[0].tone).toBe('mute');
    expect(parsed.dims[0].hint).toBe('');
  });

  it('matchId 可选，传入后保留', () => {
    const parsed = utteranceSchema.parse({
      raw: 'x',
      intent: 'DONE',
      matchId: 'abc-123',
    });
    expect(parsed.matchId).toBe('abc-123');
  });

  it('非法 task.place 被拒绝', () => {
    const res = utteranceSchema.safeParse({
      raw: 'x',
      intent: 'ADD',
      task: { text: '买菜', place: 'market' },
    });
    expect(res.success).toBe(false);
  });

  it('patch 可以单独带 status', () => {
    const parsed = utteranceSchema.parse({
      raw: 'x',
      intent: 'STATUS',
      patch: { status: 'doing' },
    });
    expect(parsed.patch?.status).toBe('doing');
  });
});
