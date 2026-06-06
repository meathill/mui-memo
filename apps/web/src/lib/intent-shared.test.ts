/**
 * @vitest-environment node
 *
 * buildUserPrompt 纯逻辑单测：验证「用户已有的标签」列表的注入、去重与过滤，
 * 全程不调用任何模型。
 */
import type { TaskView } from '@mui-memo/shared/logic';
import { describe, expect, it } from 'vitest';
import { buildUserPrompt, type TimeAnchor } from './intent-shared';

const NOW: TimeAnchor = { iso: '2026-06-06T14:00:00+08:00', tz: 'Asia/Shanghai', weekday: '周六' };

function task(partial: Partial<TaskView> & { id: string; text: string }): TaskView {
  return {
    place: 'any',
    window: 'today',
    energy: 2,
    priority: 2,
    status: 'pending',
    done: false,
    ...partial,
  };
}

/** 取出注入的「用户已有的标签」那一行，方便只在该行内做断言。 */
function tagLine(out: string): string {
  return out.split('\n').find((l) => l.includes('用户已有的标签')) ?? '';
}

describe('buildUserPrompt · 已有标签注入', () => {
  it('有带标签的任务时，输出包含「用户已有的标签」及各标签', () => {
    const tasks = [
      task({ id: '1', text: '查网银流水', tag: '网银' }),
      task({ id: '2', text: '买打印纸', tag: '采购' }),
    ];
    const line = tagLine(buildUserPrompt(tasks, NOW, '记一笔'));
    expect(line).toContain('用户已有的标签');
    expect(line).toContain('网银');
    expect(line).toContain('采购');
  });

  it('标签去重，重复只出现一次', () => {
    const tasks = [
      task({ id: '1', text: 'a', tag: '网银' }),
      task({ id: '2', text: 'b', tag: '网银' }),
      task({ id: '3', text: 'c', tag: '采购' }),
    ];
    const line = tagLine(buildUserPrompt(tasks, NOW));
    expect(line.match(/网银/g)?.length).toBe(1);
  });

  it('done / linked 任务的标签不计入', () => {
    const tasks = [
      task({ id: '1', text: '已完成', tag: '旧标签', done: true, status: 'done' }),
      task({ id: '2', text: '子任务', tag: '关联标签', status: 'linked' }),
      task({ id: '3', text: '活跃', tag: '网银' }),
    ];
    const line = tagLine(buildUserPrompt(tasks, NOW));
    expect(line).toContain('网银');
    expect(line).not.toContain('旧标签');
    expect(line).not.toContain('关联标签');
  });

  it('没有任何带标签任务时，不出现该行', () => {
    const tasks = [task({ id: '1', text: '没有标签的事' })];
    expect(buildUserPrompt(tasks, NOW)).not.toContain('用户已有的标签');
  });

  it('空清单不报错也不出现标签行', () => {
    const out = buildUserPrompt([], NOW, '记一笔');
    expect(out).toContain('当前清单：空');
    expect(out).not.toContain('用户已有的标签');
  });
});
