import { describe, expect, it } from 'vitest';
import {
  describeNow,
  formatDueAt,
  isOverdue,
  isoToLocalInput,
  localInputToISO,
  normalizeTz,
  relativeTimeLabel,
  tzOffset,
} from './time';

const TZ = 'Asia/Shanghai';

describe('normalizeTz', () => {
  it('保留合法时区', () => {
    expect(normalizeTz('Asia/Shanghai')).toBe('Asia/Shanghai');
    expect(normalizeTz('America/New_York')).toBe('America/New_York');
  });

  it('非法 / 空值 fallback 到 Asia/Shanghai', () => {
    expect(normalizeTz(undefined)).toBe(TZ);
    expect(normalizeTz(null)).toBe(TZ);
    expect(normalizeTz('')).toBe(TZ);
    expect(normalizeTz('Not/AZone')).toBe(TZ);
  });
});

describe('tzOffset', () => {
  it('Asia/Shanghai 全年 +08:00', () => {
    const jan = new Date('2026-01-15T00:00:00Z');
    const jul = new Date('2026-07-15T00:00:00Z');
    expect(tzOffset(jan, 'Asia/Shanghai')).toBe('+08:00');
    expect(tzOffset(jul, 'Asia/Shanghai')).toBe('+08:00');
  });

  it('UTC 返回 +00:00', () => {
    expect(tzOffset(new Date('2026-04-23T00:00:00Z'), 'UTC')).toBe('+00:00');
  });
});

describe('describeNow', () => {
  it('返回目标时区下的 ISO 串和中文星期', () => {
    // 2026-04-23 (周四) UTC 12:00 → 上海 20:00
    const now = new Date('2026-04-23T12:00:00Z');
    const { iso, weekday } = describeNow('Asia/Shanghai', now);
    expect(iso).toBe('2026-04-23T20:00:00+08:00');
    expect(weekday).toBe('周四');
  });
});

describe('formatDueAt', () => {
  it('合法 ISO 渲染成中文短标签', () => {
    const out = formatDueAt('2026-04-23T15:00:00+08:00', TZ);
    // 格式因 Intl 引擎微差，仅验证关键片段
    expect(out).toMatch(/4月23日/);
    expect(out).toMatch(/15:00/);
  });

  it('非法 ISO 原样返回', () => {
    expect(formatDueAt('not-an-iso')).toBe('not-an-iso');
  });
});

describe('relativeTimeLabel', () => {
  const now = new Date('2026-04-23T12:00:00+08:00');

  it('空值返回空串', () => {
    expect(relativeTimeLabel(null, now)).toBe('');
    expect(relativeTimeLabel(undefined, now)).toBe('');
    expect(relativeTimeLabel('', now)).toBe('');
  });

  it('过期：按分/小时/天拆档', () => {
    // <30s（取整后 <1 分钟）→「刚过期」
    expect(relativeTimeLabel('2026-04-23T11:59:45+08:00', now)).toBe('刚过期');
    expect(relativeTimeLabel('2026-04-23T11:30:00+08:00', now)).toBe('过期 30 分钟');
    expect(relativeTimeLabel('2026-04-23T09:00:00+08:00', now)).toBe('过期 3 小时');
    expect(relativeTimeLabel('2026-04-21T12:00:00+08:00', now)).toBe('过期 2 天');
  });

  it('临近：分/小时', () => {
    expect(relativeTimeLabel('2026-04-23T12:12:00+08:00', now)).toBe('12 分钟后');
    expect(relativeTimeLabel('2026-04-23T15:00:00+08:00', now)).toBe('3 小时后');
  });

  it('跨过 24 小时：落到「明天 HH:mm」', () => {
    // 25 小时后：hrs≥24 走日期分支，tKey 命中明天
    expect(relativeTimeLabel('2026-04-24T13:00:00+08:00', now)).toMatch(/^明天 /);
  });

  it('7 天内返回 N 天后', () => {
    // 3 天 + 8 小时：走 N 天后分支
    expect(relativeTimeLabel('2026-04-26T20:00:00+08:00', now)).toBe('3 天后');
  });

  it('超过 7 天回落到具体日期', () => {
    const label = relativeTimeLabel('2026-05-10T12:00:00+08:00', now, TZ);
    expect(label).toMatch(/5月10日/);
  });

  it('非法 ISO 返回空串', () => {
    expect(relativeTimeLabel('not-an-iso', now)).toBe('');
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-04-23T12:00:00+08:00');
  it('过去的时间点为 true', () => {
    expect(isOverdue('2026-04-23T11:59:59+08:00', now)).toBe(true);
  });
  it('未来的时间点为 false', () => {
    expect(isOverdue('2026-04-23T12:00:01+08:00', now)).toBe(false);
  });
  it('空值 / 非法值为 false', () => {
    expect(isOverdue(null, now)).toBe(false);
    expect(isOverdue(undefined, now)).toBe(false);
    expect(isOverdue('bad', now)).toBe(false);
  });
});

describe('isoToLocalInput / localInputToISO 往返', () => {
  it('isoToLocalInput 空值 → 空串', () => {
    expect(isoToLocalInput(null)).toBe('');
    expect(isoToLocalInput(undefined)).toBe('');
    expect(isoToLocalInput('bad')).toBe('');
  });

  it('localInputToISO 空串 → null', () => {
    expect(localInputToISO('')).toBeNull();
    expect(localInputToISO('not-a-date')).toBeNull();
  });

  it('往返同一时刻：input → iso → input 恒等', () => {
    // 输入是本地时间，取回来也应是同一本地时间
    const input = '2027-01-02T09:30';
    const iso = localInputToISO(input);
    expect(iso).toBeTruthy();
    expect(isoToLocalInput(iso)).toBe(input);
  });
});
