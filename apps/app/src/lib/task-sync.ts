import type { CompletedTask } from '@mui-memo/shared/dto';
import type { TaskView } from '@mui-memo/shared/logic';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api';
import {
  APP_STATE_STORAGE_KEY,
  completedTaskToView,
  extractLegacyTasksFromPersistedState,
  shouldRefreshTasks,
  stripLegacyTasksFromPersistedState,
  taskPatchToLocalPatch,
  type LocalTaskPatch,
} from '@/lib/local-cache-model';
import {
  applyLocalTaskPatch,
  getTasksSyncedAt,
  loadCachedTasks,
  removeCachedCompletedTask,
  removeLocalTask,
  replaceCachedTasks,
} from '@/lib/local-db';
import { TASKS_REFRESH_TTL_MS } from '@/lib/task-sync-constants';
import { useAppStore } from '@/store';

export async function hydrateTasksFromLocalCache(): Promise<TaskView[]> {
  const tasks = await loadCachedTasks();
  if (tasks.length) {
    useAppStore.getState().hydrate({ tasks, ranked: [] });
  }
  const syncedAt = await getTasksSyncedAt();
  if (syncedAt) {
    useAppStore.getState().setTasksSyncState({ lastTasksSyncedAt: Date.parse(syncedAt) || null });
  }
  return tasks;
}

export async function replaceTasksEverywhere(tasks: TaskView[]): Promise<void> {
  await replaceCachedTasks(tasks);
  useAppStore.getState().hydrate({ tasks, ranked: [] });
  useAppStore.getState().setTasksSyncState({ lastTasksSyncedAt: Date.now(), tasksSyncError: null });
}

export async function refreshTasksFromRemote(opts: { force?: boolean } = {}): Promise<TaskView[]> {
  const state = useAppStore.getState();
  if (
    !shouldRefreshTasks({
      force: opts.force,
      tasksLength: state.tasks.length,
      lastTasksSyncedAt: state.lastTasksSyncedAt,
      now: Date.now(),
      ttlMs: TASKS_REFRESH_TTL_MS,
    })
  ) {
    return state.tasks;
  }

  state.setTasksSyncState({ isTasksSyncing: true });
  try {
    const { tasks } = await api.tasks.list();
    await replaceTasksEverywhere(tasks);
    return tasks;
  } catch (err) {
    useAppStore.getState().setTasksSyncState({
      tasksSyncError: err instanceof Error ? err.message : '请求失败',
    });
    throw err;
  } finally {
    useAppStore.getState().setTasksSyncState({ isTasksSyncing: false });
  }
}

export async function patchTaskEverywhere(id: string, patch: LocalTaskPatch): Promise<TaskView | null> {
  const next = await applyLocalTaskPatch(id, patch);
  if (next) {
    const current = useAppStore.getState().tasks;
    useAppStore.getState().hydrate({
      tasks: current.map((task) => (task.id === id ? next : task)),
      ranked: [],
    });
  }
  return next;
}

export async function removeTaskEverywhere(id: string): Promise<void> {
  await removeLocalTask(id);
  const current = useAppStore.getState().tasks;
  useAppStore.getState().hydrate({ tasks: current.filter((task) => task.id !== id), ranked: [] });
}

export async function reopenCompletedTaskLocally(task: CompletedTask): Promise<void> {
  await removeCachedCompletedTask(task.id);
  const view = completedTaskToView(task);
  await restoreTaskEverywhere({ ...view, status: 'pending', done: false, completedAt: null });
}

export async function restoreTaskEverywhere(task: TaskView): Promise<void> {
  const current = useAppStore.getState().tasks;
  const tasks = current.some((item) => item.id === task.id)
    ? current.map((item) => (item.id === task.id ? task : item))
    : [task, ...current];
  await replaceCachedTasks(tasks);
  useAppStore.getState().hydrate({ tasks, ranked: [] });
}

export async function migrateLegacyTasksFromAsyncStorage(): Promise<TaskView[]> {
  const stored = await AsyncStorage.getItem(APP_STATE_STORAGE_KEY);
  const legacyTasks = extractLegacyTasksFromPersistedState(stored);
  if (!legacyTasks.length) return [];

  const cached = await loadCachedTasks();
  if (!cached.length) {
    await replaceCachedTasks(legacyTasks);
  }

  const stripped = stripLegacyTasksFromPersistedState(stored);
  if (stripped && stripped !== stored) {
    await AsyncStorage.setItem(APP_STATE_STORAGE_KEY, stripped);
  }
  return legacyTasks;
}

export { taskPatchToLocalPatch };
