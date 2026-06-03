import type { Action, TaskCore, TaskPlace, TaskStatus, TaskWindow, Utterance } from './validators.js';

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
  /** 周期任务实例所属的定义 id；非周期任务为空。仅用于 UI 标记。 */
  recurrenceId?: string | null;
  /** 周期序号；服务端只把「当前期」的已完成周期实例发到主列表。 */
  periodIndex?: number | null;
}

export type Bucket = 'doing' | 'now' | 'today_here' | 'today_else' | 'blocked' | 'later' | 'done_recurring';

const BUCKET_ORDER: Record<Bucket, number> = {
  doing: -1,
  now: 0,
  today_here: 1,
  today_else: 2,
  blocked: 3,
  later: 4,
  done_recurring: 5,
};

export const BUCKET_LABEL: Record<Bucket, string> = {
  doing: '正在做',
  now: '此刻可做',
  today_here: '今天 · 这里',
  today_else: '今天 · 别处',
  blocked: '被挡住',
  later: '不急',
  done_recurring: '本轮已完成',
};

/**
 * 把任务按场景分桶并排序，端口自设计稿 data.jsx。
 * linked 状态的子任务不会出现在主列表（由父任务的 linked[] 展示）。
 * 已完成的「周期实例」不直接过滤掉，而是落到 done_recurring 桶排到最后（本轮已完成）。
 */
export function rerank(tasks: TaskView[], ctxPlace: TaskPlace): Array<TaskView & { bucket: Bucket }> {
  // 保留：未完成的；以及已完成但属于周期任务的（本轮已完成，展示在最后）
  const list = tasks.filter((t) => t.status !== 'linked' && (!t.done || Boolean(t.recurrenceId)));
  // ctxPlace='any' = 「全部」tab：不做场景过滤，所有任务都视为「这里可做」
  const canDoHere = (t: TaskView) => ctxPlace === 'any' || t.place === 'any' || t.place === ctxPlace;

  const bucket = (t: TaskView): Bucket => {
    if (t.done && t.recurrenceId) return 'done_recurring';
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
// applyActions：把 actions[] 合并到当前任务列表
// ──────────────────────────────────────────────

export type ModifyPatch = Partial<TaskCore> & { status?: TaskStatus };

/** modify effect 用来给前端"取消 / 改为新增"用的命中前快照 */
export type TaskSnapshot = Partial<
  Pick<
    TaskView,
    'text' | 'place' | 'window' | 'energy' | 'priority' | 'tag' | 'deadline' | 'expectAt' | 'dueAt' | 'status'
  >
>;

export type IntentEffect =
  | { kind: 'add'; id: string; text: string; verb: string; reason: string }
  | { kind: 'status'; id: string; text: string; verb: string; reason: string }
  | { kind: 'done'; id: string; text: string; verb: string; reason: string }
  | { kind: 'done-backfill'; id: string; text: string; verb: string; reason: string }
  | {
      kind: 'modify';
      id: string;
      text: string;
      verb: string;
      reason: string;
      patch: ModifyPatch;
      before: TaskSnapshot;
    }
  | { kind: 'link'; id: string; text: string; verb: string; reason: string; host: string }
  | { kind: 'miss'; verb: string };

export interface ApplyResult {
  tasks: TaskView[];
  effect: IntentEffect;
}

export interface ApplyActionsResult {
  tasks: TaskView[];
  effects: IntentEffect[];
}

function genId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

type ResolvableAction = Extract<Action, { match?: string; matchId?: string }>;

function matchTaskByAction(tasks: TaskView[], action: ResolvableAction): TaskView | null {
  if (action.matchId) {
    const byId = tasks.find((t) => t.id === action.matchId && !t.done);
    if (byId) return byId;
  }
  if (!action.match) return null;
  let rx: RegExp;
  try {
    rx = new RegExp(action.match);
  } catch {
    return null;
  }
  return tasks.find((t) => !t.done && rx.test(t.text)) ?? null;
}

function snapshotForPatch(t: TaskView, patch: ModifyPatch): TaskSnapshot {
  const snap: TaskSnapshot = { text: t.text };
  if (patch.place !== undefined) snap.place = t.place;
  if (patch.window !== undefined) snap.window = t.window;
  if (patch.energy !== undefined) snap.energy = t.energy;
  if (patch.priority !== undefined) snap.priority = t.priority;
  if (patch.tag !== undefined) snap.tag = t.tag ?? undefined;
  if (patch.deadline !== undefined) snap.deadline = t.deadline ?? undefined;
  if (patch.expectAt !== undefined) snap.expectAt = t.expectAt ?? undefined;
  if (patch.dueAt !== undefined) snap.dueAt = t.dueAt ?? undefined;
  if (patch.status !== undefined) snap.status = t.status;
  if (patch.text !== undefined) snap.text = t.text;
  return snap;
}

/**
 * 应用单个 action 到任务列表。返回新列表 + 副作用描述。
 */
function applyAction(tasks: TaskView[], action: Action, raw: string): ApplyResult {
  if (action.intent === 'ADD') {
    const core = action.task ?? {};
    const id = genId();
    const nt: TaskView = {
      id,
      text: core.text ?? raw,
      rawText: raw,
      place: core.place ?? 'any',
      window: core.window ?? 'today',
      energy: core.energy ?? 2,
      priority: core.priority ?? 2,
      tag: core.tag,
      deadline: core.deadline,
      expectAt: core.expectAt,
      dueAt: core.dueAt,
      aiReason: action.aiReason,
      status: 'pending',
      done: false,
      addedAt: '刚才',
    };
    return {
      tasks: [nt, ...tasks],
      effect: { kind: 'add', id, text: nt.text, verb: action.aiVerb, reason: action.aiReason },
    };
  }

  if (action.intent === 'STATUS') {
    const t = matchTaskByAction(tasks, action);
    if (!t) return { tasks, effect: { kind: 'miss', verb: action.aiVerb } };
    const patch = action.patch ?? {};
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
      effect: { kind: 'status', id: t.id, text: t.text, verb: action.aiVerb, reason: action.aiReason },
    };
  }

  if (action.intent === 'DONE') {
    const t = matchTaskByAction(tasks, action);
    if (t) {
      return {
        tasks,
        effect: { kind: 'done', id: t.id, text: t.text, verb: '待确认完成', reason: action.aiReason },
      };
    }
    if (action.createIfMissing) {
      const core = action.createIfMissing;
      const id = genId();
      const nt: TaskView = {
        id,
        text: core.text ?? raw,
        rawText: raw,
        place: core.place ?? 'any',
        window: core.window ?? 'now',
        energy: core.energy ?? 2,
        priority: core.priority ?? 2,
        tag: core.tag,
        deadline: core.deadline,
        expectAt: core.expectAt,
        dueAt: core.dueAt,
        aiReason: action.aiReason,
        status: 'pending',
        done: false,
        addedAt: '刚才',
      };
      return {
        tasks: [nt, ...tasks],
        effect: {
          kind: 'done-backfill',
          id,
          text: nt.text,
          verb: '待确认完成',
          reason: action.aiReason,
        },
      };
    }
    return { tasks, effect: { kind: 'miss', verb: action.aiVerb } };
  }

  if (action.intent === 'MODIFY') {
    const t = matchTaskByAction(tasks, action);
    if (!t) return { tasks, effect: { kind: 'miss', verb: action.aiVerb } };
    const patch = action.patch ?? {};
    const before = snapshotForPatch(t, patch);
    const next = tasks.map((x) => (x.id === t.id ? { ...x, ...patch } : x));
    return {
      tasks: next,
      effect: {
        kind: 'modify',
        id: t.id,
        text: t.text,
        verb: action.aiVerb,
        reason: action.aiReason,
        patch,
        before,
      },
    };
  }

  if (action.intent === 'LINK') {
    const t = matchTaskByAction(tasks, action);
    const doing = tasks.find((x) => x.status === 'doing');
    if (!t || !doing) return { tasks, effect: { kind: 'miss', verb: action.aiVerb } };
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
        verb: action.aiVerb,
        reason: action.aiReason,
        host: doing.text,
      },
    };
  }

  return { tasks, effect: { kind: 'miss', verb: '无法识别' } };
}

/**
 * 把 utterance.actions 串行合并到当前任务列表。
 * 前一个 action 输出的 tasks 喂给下一个，这样「先 ADD 再 LINK 到刚 ADD 的」能命中。
 */
export function applyActions(tasks: TaskView[], utterance: Utterance, _now: Date = new Date()): ApplyActionsResult {
  let cur = tasks;
  const effects: IntentEffect[] = [];
  for (const action of utterance.actions) {
    const r = applyAction(cur, action, utterance.raw);
    cur = r.tasks;
    effects.push(r.effect);
  }
  return { tasks: cur, effects };
}

/**
 * 单 action 兼容入口。actions[0] 走 applyActions，返回第一个 effect。
 * 老的调用方在迁移期内仍可用。
 */
export function applyIntent(tasks: TaskView[], utterance: Utterance, now: Date = new Date()): ApplyResult {
  const r = applyActions(tasks, utterance, now);
  return { tasks: r.tasks, effect: r.effects[0] };
}

export const PLACE_LABEL: Record<TaskPlace, { label: string; icon: string }> = {
  home: { label: '在家', icon: '🏠' },
  work: { label: '在公司', icon: '💼' },
  out: { label: '在外', icon: '🚶' },
  any: { label: '任何地方', icon: '•' },
};

// 任务字段的可选值列表，前后端共享。
// label 文案保留在各端（web 与 app 措辞不同），这里只导出值列表。
export const PLACES: TaskPlace[] = ['home', 'work', 'out', 'any'];
export const WINDOWS: TaskWindow[] = ['now', 'today', 'later'];
export const STATUSES: TaskStatus[] = ['pending', 'doing', 'done'];
export const PRIORITIES = [1, 2, 3] as const;
