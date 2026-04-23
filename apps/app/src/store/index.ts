import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bucket, IntentEffect, TaskView } from '@mui-memo/shared/logic';
import type { TaskPlace, Utterance } from '@mui-memo/shared/validators';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type RankedTask = TaskView & { bucket: Bucket };

interface AppState {
  place: TaskPlace;
  tasks: TaskView[];
  ranked: RankedTask[];
  lastEffect: IntentEffect | null;
  lastUtterance: Utterance | null;
  isProcessing: boolean;
  isRecording: boolean;

  setPlace: (p: TaskPlace) => void;
  hydrate: (payload: { tasks: TaskView[]; ranked: RankedTask[]; place?: TaskPlace }) => void;
  setRecording: (v: boolean) => void;
  setProcessing: (v: boolean) => void;
  setLastEffect: (e: IntentEffect | null, u?: Utterance | null) => void;
}

/**
 * 全局应用状态。
 *
 * **持久化策略**：只把 `tasks` 和 `place` 存到 AsyncStorage，杀 app 再开能
 * 立刻看到上次列表（避免白屏等 API）。`lastEffect` / `ranked` / recording
 * 状态是当次会话瞬时信息，不存。
 *
 * 持久化用 AsyncStorage（不是 SecureStore），任务文本不敏感，量大，
 * SecureStore 写慢且有大小限制。
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      place: 'home',
      tasks: [],
      ranked: [],
      lastEffect: null,
      lastUtterance: null,
      isProcessing: false,
      isRecording: false,

      setPlace: (p) => set({ place: p }),
      hydrate: ({ tasks, ranked, place }) => set((s) => ({ tasks, ranked, place: place ?? s.place })),
      setRecording: (v) => set({ isRecording: v }),
      setProcessing: (v) => set({ isProcessing: v }),
      setLastEffect: (e, u) => set({ lastEffect: e, lastUtterance: u ?? null }),
    }),
    {
      name: 'mui-memo.app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ tasks: s.tasks, place: s.place }),
    },
  ),
);
