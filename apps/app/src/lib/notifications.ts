import type { TaskView } from '@mui-memo/shared/logic';
import * as Notifications from 'expo-notifications';

/**
 * 本地定时提醒。核心思路：
 *
 * - 只在客户端：服务端 expectAt/dueAt 是数据，客户端观察任务列表变化后
 *   按 taskId 维度注册/撤销 iOS 本地通知。
 * - 不用远程推：依赖 APNs / 后端托管成本高，MVP 对离线友好比准不准重要。
 * - 「提前 N 分钟」先不做，一律在 expectAt 那一刻响一次；将来要可以
 *   在 scheduleTrigger 里加偏移。
 * - 过期（now > expectAt）的任务不发通知。
 */
// 展示策略：前台也弹，避免用户忽略；后台走系统 banner
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** 一条通知携带的 data，点击时用来跳详情 */
export interface TaskNotificationData {
  taskId: string;
}

export type PermStatus = 'granted' | 'prompt' | 'blocked';

export async function getPermissionStatus(): Promise<PermStatus> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (canAskAgain) return 'prompt';
  return 'blocked';
}

export async function requestPermission(): Promise<PermStatus> {
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'prompt' : 'blocked';
}

/**
 * 把 server 任务列表 diff 成「应存在的通知」，和系统当前 scheduled 的做
 * 并集 reconcile：多的删掉、少的补上、identifier 用 taskId 稳定化。
 */
export async function reconcileTaskReminders(tasks: TaskView[]): Promise<void> {
  // 只处理 pending/doing 且有 expectAt（或 fallback 到 dueAt）且未过期的
  const now = Date.now();
  const wanted = new Map<string, Date>();
  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'linked') continue;
    const anchor = t.expectAt ?? t.dueAt;
    if (!anchor) continue;
    const ts = new Date(anchor).getTime();
    if (Number.isNaN(ts) || ts <= now) continue;
    wanted.set(t.id, new Date(ts));
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set<string>();
  for (const s of scheduled) {
    // 只管我们自己登记的（带 taskId 的），别的留原样
    const data = s.content.data as TaskNotificationData | undefined;
    if (data?.taskId) {
      scheduledIds.add(s.identifier);
      if (!wanted.has(s.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(s.identifier);
      }
    }
  }

  const permStatus = await getPermissionStatus();
  if (permStatus !== 'granted') return; // 没权限就 diff 不发，等用户授权后下次 reconcile

  for (const [taskId, when] of wanted) {
    if (scheduledIds.has(taskId)) continue; // 已经登记过了
    const text = tasks.find((t) => t.id === taskId)?.text ?? '该做事了';
    await Notifications.scheduleNotificationAsync({
      identifier: taskId,
      content: {
        title: '该做事了',
        body: text,
        data: { taskId } satisfies TaskNotificationData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
  }
}

/** 直接清掉某条任务的通知（比如用户标 done 时调一下） */
export async function cancelTaskReminder(taskId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(taskId).catch(() => undefined);
}

export { Notifications };
