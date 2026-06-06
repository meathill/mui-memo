import type { Bucket, IntentEffect, TaskView } from '@mui-memo/shared/logic';
import type { TaskPlace, Utterance } from '@mui-memo/shared/validators';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ThemePreference } from '@/lib/theme';

type RankedTask = TaskView & { bucket: Bucket };

export interface PendingConfirm {
  index: number;
  effect: IntentEffect;
  utterance: Utterance;
}

export type QueueItemStatus = 'queued' | 'processing' | 'error';

/**
 * 待处理录音队列项。录音与 AI 处理解耦：录完即入队，后台 pump 逐条顺序处理。
 * `localUri` 是 expo-audio 录的本地 file://...m4a，处理成功后后端自动归档到 R2，
 * 本地文件交给 OS 管（不主动删，也不复制到 documentDirectory）。
 */
export interface QueueItem {
  id: string;
  localUri: string;
  mimeType: string;
  durationMs: number;
  createdAt: string;
  status: QueueItemStatus;
  error?: string;
  place: TaskPlace;
  tz: string;
}

interface AppState {
  place: TaskPlace;
  tasks: TaskView[];
  ranked: RankedTask[];
  lastEffects: IntentEffect[];
  lastUtterance: Utterance | null;
  pendingConfirms: PendingConfirm[];
  queue: QueueItem[];
  isRecording: boolean;
  theme: ThemePreference;

  setPlace: (p: TaskPlace) => void;
  hydrate: (payload: { tasks: TaskView[]; ranked: RankedTask[]; place?: TaskPlace }) => void;
  setRecording: (v: boolean) => void;
  setLastEffects: (effects: IntentEffect[], u?: Utterance | null) => void;
  pushPendingConfirms: (list: PendingConfirm[]) => void;
  shiftPendingConfirm: () => void;
  clearPendingConfirms: () => void;
  enqueueAudio: (item: Omit<QueueItem, 'id' | 'status' | 'createdAt'>) => void;
  updateQueueItem: (id: string, patch: Partial<QueueItem>) => void;
  removeQueueItem: (id: string) => void;
  setTheme: (t: ThemePreference) => void;
}

/**
 * 全局应用状态。
 *
 * **持久化策略**：把 `tasks`、`place`、`theme`、`queue` 存到 AsyncStorage，杀 app
 * 再开能立刻看到上次列表（避免白屏等 API）、上次的主题选择，以及没来得及处理完的
 * 待处理录音队列。`lastEffects` / `pendingConfirms` / `ranked` / recording 是当次
 * 会话瞬时信息，不存。
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      place: 'any',
      tasks: [],
      ranked: [],
      lastEffects: [],
      lastUtterance: null,
      pendingConfirms: [],
      queue: [],
      isRecording: false,
      theme: 'system',

      setPlace: (p) => set({ place: p }),
      hydrate: ({ tasks, ranked, place }) => set((s) => ({ tasks, ranked, place: place ?? s.place })),
      setRecording: (v) => set({ isRecording: v }),
      setLastEffects: (effects, u) => set({ lastEffects: effects, lastUtterance: u ?? null }),
      pushPendingConfirms: (list) => set((s) => ({ pendingConfirms: [...s.pendingConfirms, ...list] })),
      shiftPendingConfirm: () => set((s) => ({ pendingConfirms: s.pendingConfirms.slice(1) })),
      clearPendingConfirms: () => set({ pendingConfirms: [] }),
      enqueueAudio: (item) =>
        set((s) => ({
          queue: [
            ...s.queue,
            { ...item, id: Crypto.randomUUID(), status: 'queued', createdAt: new Date().toISOString() },
          ],
        })),
      updateQueueItem: (id, patch) =>
        set((s) => ({ queue: s.queue.map((q) => (q.id === id ? { ...q, ...patch } : q)) })),
      removeQueueItem: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
      setTheme: (t) => set({ theme: t }),
    }),
    {
      name: 'mui-memo.app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ tasks: s.tasks, theme: s.theme, queue: s.queue }),
      // place 是「当次场景上下文」，不跨重启保留：每次启动都回到默认「全部」。
      // merge 兜旧安装——之前持久化过的 place 一律忽略，避免旧值盖回默认。
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppState>),
        place: current.place,
      }),
    },
  ),
);
