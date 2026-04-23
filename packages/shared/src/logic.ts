import type { TaskPlace, TaskStatus, TaskWindow, Utterance } from './validators.js';

/**
 * 前后端共享的任务视图模型。
 * 后端从 DB 读出后规整成这个形状喂给 rerank / applyIntent；前端直接渲染。
 */
export interface TaskView {
  id: string;
  text: string;
  rawText?: string;
  place: TaskPlace;
  window: TaskWindow;
  energy: number;
  priority: number;
  tag?: string | null;
  deadline?: string | null;
  expectAt?: string | null;
  dueAt?: string | null;
  aiReason?: string | null;
  status: TaskStatus;
  linkedTo?: string | null;
  linked?: { id: string; text: string }[];
  done: boolean;
  addedAt?: string;
  completedAt?: string | null;
  /** 产出该任务的原始语音 R2 key，空表示没有归档。 */
  audioKey?: string | null;
}

export type Bucket = 'doing' | 'now' | 'today_here' | 'today_else' | 'blocked' | 'later';

const BUCKET_ORDER: Record<Bucket, number> = {
  doing: -1,
  now: 0,
  today_here: 1,
  today_else: 2,
  blocked: 3,
  later: 4,
};

export const BUCKET_LABEL: Record<Bucket, string> = {
  doing: '正在做',
  now: '此刻可做',
  today_here: '今天 · 这里',
  today_else: '今天 · 别处',
  blocked: '被挡住',
  later: '不急',
};

/**
 * 把任务按场景分桶并排序，端口自设计稿 data.jsx。
 * linked 状态的子任务不会出现在主列表（由父任务的 linked[] 展示）。
 */
export function rerank(tasks: TaskView[], ctxPlace: TaskPlace): Array<TaskView & { bucket: Bucket }> {
  const list = tasks.filter((t) => !t.done && t.status !== 'linked');
  const canDoHere = (t: TaskView) => t.place === 'any' || t.place === ctxPlace;

  const bucket = (t: TaskView): Bucket => {
    if (t.status === 'doing') return 'doing';
    if (!canDoHere(t) && t.window === 'now') return 'blocked';
    if (t.window === 'now') return 'now';
    if (t.window === 'today' && canDoHere(t)) return 'today_here';
    if (t.window === 'today') return 'today_else';
    return 'later';
  };

  return list
    .map((t) => ({ ...t, bucket: bucket(t) }))
    .sort((a, b) => {
      if (BUCKET_ORDER[a.bucket] !== BUCKET_ORDER[b.bucket]) {
        return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
      }
      return b.priority - a.priority;
    });
}

// ──────────────────────────────────────────────
// applyIntent：把语音意图合并到当前任务列表
// ──────────────────────────────────────────────

export type IntentEffect =
  | { kind: 'add'; id: string; text: string; verb: string; reason: string }
  | { kind: 'status'; id: string; text: string; verb: string; reason: string }
  | { kind: 'done'; id: string; text: string; verb: string; reason: string }
  | { kind: 'done-backfill'; id: string; text: string; verb: string; reason: string }
  | { kind: 'modify'; id: string; text: string; verb: string; reason: string }
  | { kind: 'link'; id: string; text: string; verb: string; reason: string; host: string }
  | { kind: 'miss'; verb: string };

export interface ApplyResult {
  tasks: TaskView[];
  effect: IntentEffect;
}

function nowStamp(now: Date = new Date()) {
  // 返回 ISO 字符串，前端用 new Date(iso) 可直接格式化；后端能安全地 new Date() 再持久化
  return now.toISOString();
}

function genId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function matchTask(tasks: TaskView[], u: Utterance): TaskView | null {
  if (u.matchId) {
    const byId = tasks.find((t) => t.id === u.matchId && !t.done);
    if (byId) return byId;
  }
  if (!u.match) return null;
  let rx: RegExp;
  try {
    rx = new RegExp(u.match);
  } catch {
    return null;
  }
  return tasks.find((t) => !t.done && rx.test(t.text)) ?? null;
}

/**
 * 把一条 Utterance 合并到当前任务列表。
 * 返回新列表 + 副作用描述（用于 toast 提示）。
 */
export function applyIntent(tasks: TaskView[], u: Utterance, now: Date = new Date()): ApplyResult {
  const stamp = nowStamp(now);

  if (u.intent === 'ADD') {
    const core = u.task ?? {};
    const id = genId();
    const nt: TaskView = {
      id,
      text: core.text ?? u.raw,
      rawText: u.raw,
      place: core.place ?? 'any',
      window: core.window ?? 'today',
      energy: core.energy ?? 2,
      priority: core.priority ?? 2,
      tag: core.tag,
      deadline: core.deadline,
      expectAt: core.expectAt,
      dueAt: core.dueAt,
      aiReason: u.aiReason,
      status: 'pending',
      done: false,
      addedAt: '刚才',
    };
    return {
      tasks: [nt, ...tasks],
      effect: { kind: 'add', id, text: nt.text, verb: u.aiVerb, reason: u.aiReason },
    };
  }

  if (u.intent === 'STATUS') {
    const t = matchTask(tasks, u);
    if (!t) return { tasks, effect: { kind: 'miss', verb: u.aiVerb } };
    const patch = u.patch ?? {};
    const next = tasks.map((x) => {
      if (x.id === t.id) {
        return {
          ...x,
          ...patch,
          status: 'doing' as TaskStatus,
          window: 'now' as TaskWindow,
        };
      }
      if (x.status === 'doing') return { ...x, status: 'pending' as TaskStatus };
      return x;
    });
    return {
      tasks: next,
      effect: { kind: 'status', id: t.id, text: t.text, verb: u.aiVerb, reason: u.aiReason },
    };
  }

  if (u.intent === 'DONE') {
    const t = matchTask(tasks, u);
    if (t) {
      const next = tasks.map((x) =>
        x.id === t.id
          ? { ...x, done: true, status: 'done' as TaskStatus, completedAt: stamp }
          : x,
      );
      return {
        tasks: next,
        effect: { kind: 'done', id: t.id, text: t.text, verb: u.aiVerb, reason: u.aiReason },
      };
    }
    if (u.createIfMissing) {
      const core = u.createIfMissing;
      const id = genId();
      const nt: TaskView = {
        id,
        text: core.text ?? u.raw,
        rawText: u.raw,
        place: core.place ?? 'any',
        window: core.window ?? 'now',
        energy: core.energy ?? 2,
        priority: core.priority ?? 2,
        tag: core.tag,
        deadline: core.deadline,
        expectAt: core.expectAt,
      dueAt: core.dueAt,
        aiReason: u.aiReason,
        status: 'done',
        done: true,
        addedAt: '刚才',
        completedAt: stamp,
      };
      return {
        tasks: [nt, ...tasks],
        effect: {
          kind: 'done-backfill',
          id,
          text: nt.text,
          verb: u.aiVerb,
          reason: u.aiReason,
        },
      };
    }
    return { tasks, effect: { kind: 'miss', verb: u.aiVerb } };
  }

  if (u.intent === 'MODIFY') {
    const t = matchTask(tasks, u);
    if (!t) return { tasks, effect: { kind: 'miss', verb: u.aiVerb } };
    const patch = u.patch ?? {};
    const next = tasks.map((x) => (x.id === t.id ? { ...x, ...patch } : x));
    return {
      tasks: next,
      effect: { kind: 'modify', id: t.id, text: t.text, verb: u.aiVerb, reason: u.aiReason },
    };
  }

  if (u.intent === 'LINK') {
    const t = matchTask(tasks, u);
    const doing = tasks.find((x) => x.status === 'doing');
    if (!t || !doing) return { tasks, effect: { kind: 'miss', verb: u.aiVerb } };
    const next = tasks.map((x) => {
      if (x.id === doing.id) {
        return { ...x, linked: [...(x.linked ?? []), { id: t.id, text: t.text }] };
      }
      if (x.id === t.id) {
        return { ...x, status: 'linked' as TaskStatus, linkedTo: doing.id };
      }
      return x;
    });
    return {
      tasks: next,
      effect: {
        kind: 'link',
        id: t.id,
        text: t.text,
        verb: u.aiVerb,
        reason: u.aiReason,
        host: doing.text,
      },
    };
  }

  return { tasks, effect: { kind: 'miss', verb: '无法识别' } };
}

export const PLACE_LABEL: Record<TaskPlace, { label: string; icon: string }> = {
  home: { label: '在家', icon: '🏠' },
  work: { label: '在公司', icon: '💼' },
  out: { label: '在外', icon: '🚶' },
  any: { label: '任何地方', icon: '•' },
};
