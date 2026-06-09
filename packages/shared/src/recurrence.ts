import type { RecurrenceFreq, TaskPlace, TaskStatus, TaskWindow } from './validators.js';

// ──────────────────────────────────────────────
// 周期数学 + 对账（纯函数，无 DB / 无副作用，便于单测）
//
// 频率：
// - daily   : 每 interval 天，定长区块
// - weekly  : 每 interval 周，定长区块（interval=2 即每两周）
// - monthly : 每 interval 月，按本地日历（月长不一，需 tzOffset）
// - workday : 工作日（周一~周五），按天计数但周末不生成（需 tzOffset 判本地星期）
//
// tzOffset：JS getTimezoneOffset() 约定的分钟数（本地→UTC 的差，UTC+8 为 -480）。
// 仅 monthly / workday 用到；daily / weekly 是定长区块，与时区无关。
// ──────────────────────────────────────────────

/** 周期定义（模板）的纯数据投影。anchorAt 为 ISO 8601 字符串。 */
export interface RecurrenceDef {
  id: string;
  text: string;
  place: TaskPlace;
  window: TaskWindow;
  energy: number;
  priority: number;
  tags?: string[];
  freq: RecurrenceFreq;
  interval: number;
  anchorAt: string;
  tzOffset: number;
}

/** 对账只关心实例的这几列。 */
export interface RecurrenceInstanceLite {
  id: string;
  recurrenceId: string;
  periodIndex: number;
  status: TaskStatus;
}

/** 待生成实例的描述（落库层再补 id / userId / status 等）。 */
export interface NewInstanceSpec {
  recurrenceId: string;
  periodIndex: number;
  text: string;
  place: TaskPlace;
  window: TaskWindow;
  energy: number;
  priority: number;
  tags?: string[];
  /** = 本期 periodStart 的 ISO，复用现有本地通知到点提醒 */
  expectAt: string;
}

export interface ReconcilePlan {
  toCreate: NewInstanceSpec[];
  /** 过期未完成实例的 id */
  toDelete: string[];
}

const DAY_MS = 86_400_000;

// 把 UTC 瞬时按固定 offset 转成「本地挂钟」Date，可直接用 getUTC* 读本地年月日时分。
function toLocal(ms: number, tzOffset: number): Date {
  return new Date(ms - tzOffset * 60_000);
}
// 由本地挂钟分量反推 UTC 瞬时（toLocal 的逆运算）。
function fromLocalParts(y: number, mo: number, d: number, h: number, mi: number, tzOffset: number): number {
  return Date.UTC(y, mo, d, h, mi) + tzOffset * 60_000;
}
function daysInMonth(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
}

/** daily / weekly 的定长区块毫秒。 */
export function periodLengthMs(freq: RecurrenceFreq, interval: number): number {
  return (freq === 'weekly' ? 7 : 1) * interval * DAY_MS;
}

/** monthly 第 k 期（从 anchor 起 k*interval 个月）的起点 UTC 毫秒，按本地日历、夹住月末。 */
function monthlyStartMs(anchorMs: number, k: number, interval: number, tzOffset: number): number {
  const a = toLocal(anchorMs, tzOffset);
  const monthIdx = a.getUTCMonth() + k * interval;
  const y = a.getUTCFullYear() + Math.floor(monthIdx / 12);
  const mo = ((monthIdx % 12) + 12) % 12;
  const day = Math.min(a.getUTCDate(), daysInMonth(y, mo));
  return fromLocalParts(y, mo, day, a.getUTCHours(), a.getUTCMinutes(), tzOffset);
}

function monthlyIndex(anchorMs: number, nowMs: number, interval: number, tzOffset: number): number {
  const a = toLocal(anchorMs, tzOffset);
  const n = toLocal(nowMs, tzOffset);
  const months = (n.getUTCFullYear() - a.getUTCFullYear()) * 12 + (n.getUTCMonth() - a.getUTCMonth());
  let k = Math.max(0, Math.floor(months / interval));
  // 月长/号数夹取会让粗算有 ±1 偏差，校正到 start(k) <= now < start(k+1)
  while (k > 0 && monthlyStartMs(anchorMs, k, interval, tzOffset) > nowMs) k--;
  while (monthlyStartMs(anchorMs, k + 1, interval, tzOffset) <= nowMs) k++;
  return k;
}

/**
 * 当前周期序号 k。now 早于 anchor（还没开始）返回 null。
 * daily/weekly: floor(经过/区块长)；workday: 按天计数；monthly: 本地日历月数。
 */
export function currentPeriodIndex(
  anchorAt: Date,
  now: Date,
  freq: RecurrenceFreq,
  interval: number,
  tzOffset = 0,
): number | null {
  const anchorMs = anchorAt.getTime();
  const nowMs = now.getTime();
  if (nowMs < anchorMs) return null;
  if (freq === 'monthly') return monthlyIndex(anchorMs, nowMs, interval, tzOffset);
  if (freq === 'workday') return Math.floor((nowMs - anchorMs) / DAY_MS);
  return Math.floor((nowMs - anchorMs) / periodLengthMs(freq, interval));
}

/** 第 index 期的起点时刻。 */
export function periodStart(anchorAt: Date, index: number, freq: RecurrenceFreq, interval: number, tzOffset = 0): Date {
  const anchorMs = anchorAt.getTime();
  if (freq === 'monthly') return new Date(monthlyStartMs(anchorMs, index, interval, tzOffset));
  if (freq === 'workday') return new Date(anchorMs + index * DAY_MS);
  return new Date(anchorMs + index * periodLengthMs(freq, interval));
}

/** 该期起点是否落在周末（仅 workday 用本地星期判断）。 */
function isWeekendWorkdayPeriod(def: RecurrenceDef, index: number): boolean {
  const startMs = new Date(def.anchorAt).getTime() + index * DAY_MS;
  const weekday = toLocal(startMs, def.tzOffset).getUTCDay(); // 0=周日, 6=周六
  return weekday === 0 || weekday === 6;
}

/**
 * 对账：对每个定义，
 * - 若当前期 k 无实例 → 生成（expectAt = 本期起点）；workday 当期为周末则跳过；
 * - 其名下 periodIndex < k 且未完成的实例 → 删除（满足「未完成自动删除」）；done 的保留为历史。
 * 仅遍历传入的定义；孤立实例（定义已删）不在此处理（删定义时已 unlink 未完成实例）。
 */
export function reconcileRecurrences(
  defs: RecurrenceDef[],
  instances: RecurrenceInstanceLite[],
  now: Date,
): ReconcilePlan {
  const toCreate: NewInstanceSpec[] = [];
  const toDelete: string[] = [];

  const byDef = new Map<string, RecurrenceInstanceLite[]>();
  for (const inst of instances) {
    const arr = byDef.get(inst.recurrenceId) ?? [];
    arr.push(inst);
    byDef.set(inst.recurrenceId, arr);
  }

  for (const def of defs) {
    const anchor = new Date(def.anchorAt);
    const k = currentPeriodIndex(anchor, now, def.freq, def.interval, def.tzOffset);
    if (k === null) continue; // 还没开始

    const insts = byDef.get(def.id) ?? [];
    const skipCreate = def.freq === 'workday' && isWeekendWorkdayPeriod(def, k);

    if (!skipCreate && !insts.some((i) => i.periodIndex === k)) {
      toCreate.push({
        recurrenceId: def.id,
        periodIndex: k,
        text: def.text,
        place: def.place,
        window: def.window,
        energy: def.energy,
        priority: def.priority,
        tags: def.tags ?? [],
        expectAt: periodStart(anchor, k, def.freq, def.interval, def.tzOffset).toISOString(),
      });
    }

    for (const inst of insts) {
      if (inst.periodIndex < k && inst.status !== 'done') {
        toDelete.push(inst.id);
      }
    }
  }

  return { toCreate, toDelete };
}
