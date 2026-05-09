import type { Bucket, IntentEffect, TaskView } from '@mui-memo/shared/logic';
import type { TaskPlace, Utterance } from '@mui-memo/shared/validators';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ThemePreference } from '@/lib/theme';

type RankedTask = TaskView & { bucket: Bucket };

export interface PendingConfirm {
  index: number;
  effect: IntentEffect;
  utterance: Utterance;
}

interface AppState {
  place: TaskPlace;
  tasks: TaskView[];
  ranked: RankedTask[];
  lastEffects: IntentEffect[];
  lastUtterance: Utterance | null;
  pendingConfirms: PendingConfirm[];
  isProcessing: boolean;
  isRecording: boolean;
  theme: ThemePreference;

  setPlace: (p: TaskPlace) => void;
  hydrate: (payload: { tasks: TaskView[]; ranked: RankedTask[]; place?: TaskPlace }) => void;
  setRecording: (v: boolean) => void;
  setProcessing: (v: boolean) => void;
  setLastEffects: (effects: IntentEffect[], u?: Utterance | null) => void;
  pushPendingConfirms: (list: PendingConfirm[]) => void;
  shiftPendingConfirm: () => void;
  clearPendingConfirms: () => void;
  setTheme: (t: ThemePreference) => void;
}

/**
 * 全局应用状态。
 *
 * **持久化策略**：把 `tasks`、`place`、`theme` 存到 AsyncStorage，杀 app 再开能
 * 立刻看到上次列表（避免白屏等 API）和上次的主题选择。`lastEffects` /
 * `pendingConfirms` / `ranked` / recording 是当次会话瞬时信息，不存。
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      place: 'home',
      tasks: [],
      ranked: [],
      lastEffects: [],
      lastUtterance: null,
      pendingConfirms: [],
      isProcessing: false,
      isRecording: false,
      theme: 'system',

      setPlace: (p) => set({ place: p }),
      hydrate: ({ tasks, ranked, place }) => set((s) => ({ tasks, ranked, place: place ?? s.place })),
      setRecording: (v) => set({ isRecording: v }),
      setProcessing: (v) => set({ isProcessing: v }),
      setLastEffects: (effects, u) => set({ lastEffects: effects, lastUtterance: u ?? null }),
      pushPendingConfirms: (list) => set((s) => ({ pendingConfirms: [...s.pendingConfirms, ...list] })),
      shiftPendingConfirm: () => set((s) => ({ pendingConfirms: s.pendingConfirms.slice(1) })),
      clearPendingConfirms: () => set({ pendingConfirms: [] }),
      setTheme: (t) => set({ theme: t }),
    }),
    {
      name: 'mui-memo.app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ tasks: s.tasks, place: s.place, theme: s.theme }),
    },
  ),
);
