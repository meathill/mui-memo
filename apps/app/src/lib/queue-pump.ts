import { AppState } from 'react-native';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAppStore } from '@/store';

/**
 * 待处理录音队列的后台 pump：录音与 AI 处理解耦后，由它逐条顺序处理队列。
 *
 * 为什么是模块级单例而不是 hook：处理要跨 tab、不受任何页面挂载/卸载影响，且
 * 全局只能有一条在飞（`/api/intent` 是有状态的，并发会让多条录音看不到彼此结果
 * 而误判）。`pumping` 是进程级 flag，比组件内 ref 稳。
 *
 * 串行与停止条件天然由状态机决定：
 * - `pumping` 为真 → 已有一条在处理，不重入。
 * - `pendingConfirms` 非空 → 有确认弹窗没答，先等用户（维持任务上下文正确）。
 * - 队首是 `error`（非 `queued`）→ 毒丸停在队首，挡住其后；但录音不被禁用，
 *   新项仍可入队排在后面，用户去详情页重试/删除即可放行。
 */
let started = false;
let pumping = false;

async function tick(): Promise<void> {
  if (pumping) return;
  if (!useSession.getState().token) return;
  const state = useAppStore.getState();
  if (state.pendingConfirms.length > 0) return;

  // 走到这里 pumping=false，真正在飞的项不存在；此刻任何 `processing` 都是上次进程
  // 被杀留下的悬空态（持久化里残留），复位为 queued 重跑。放这里而非启动时，是为了
  // 不和「异步 rehydrate」抢时序——恢复无论先后到，都会被这里兜住。
  const stale = state.queue.filter((q) => q.status === 'processing');
  if (stale.length > 0) {
    for (const q of stale) useAppStore.getState().updateQueueItem(q.id, { status: 'queued' });
    return; // 状态已变，subscribe 会再触发一次 tick
  }

  // 严格按队首处理，不跳过：队首是 error（毒丸）就停，挡住其后所有项，等用户重试/删除。
  // 不用 find(queued) 是因为那会绕过 error 项继续跑，破坏有状态处理的顺序正确性。
  const head = state.queue[0];
  if (!head || head.status !== 'queued') return;

  pumping = true;
  useAppStore.getState().updateQueueItem(head.id, { status: 'processing' });
  try {
    const { utterance, effects, tasks, pendingConfirms } = await api.intent.submit({
      audioUri: head.localUri,
      mimeType: head.mimeType,
      place: head.place,
      tz: head.tz,
    });
    useAppStore.getState().hydrate({ tasks, ranked: [] });
    useAppStore.getState().setLastEffects(effects, utterance);
    if (pendingConfirms?.length) {
      useAppStore
        .getState()
        .pushPendingConfirms(pendingConfirms.map((p) => ({ index: p.index, effect: p.effect, utterance })));
    }
    useAppStore.getState().removeQueueItem(head.id);
  } catch (err) {
    useAppStore.getState().updateQueueItem(head.id, {
      status: 'error',
      error: err instanceof Error ? err.message : '处理失败',
    });
  } finally {
    pumping = false;
    void tick();
  }
}

/**
 * 在根 layout 挂载一次。返回 cleanup。重复调用无副作用。
 */
export function startQueuePump(): () => void {
  if (started) return () => undefined;
  started = true;

  const unsub = useAppStore.subscribe((s, prev) => {
    if (s.queue === prev.queue && s.pendingConfirms === prev.pendingConfirms) return;
    void tick();
  });
  const appSub = AppState.addEventListener('change', (st) => {
    if (st === 'active') void tick();
  });
  void tick();

  return () => {
    unsub();
    appSub.remove();
    started = false;
  };
}
