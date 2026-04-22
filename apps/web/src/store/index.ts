import { create } from "zustand";
import type { TaskView, Bucket, IntentEffect } from "@mui-memo/shared/logic";
import type { TaskPlace, Utterance } from "@mui-memo/shared/validators";

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
  hydrate: (payload: {
    tasks: TaskView[];
    ranked: RankedTask[];
    place?: TaskPlace;
  }) => void;
  setRecording: (v: boolean) => void;
  setProcessing: (v: boolean) => void;
  setLastEffect: (e: IntentEffect | null, u?: Utterance | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  place: "home",
  tasks: [],
  ranked: [],
  lastEffect: null,
  lastUtterance: null,
  isProcessing: false,
  isRecording: false,

  setPlace: (p) => set({ place: p }),
  hydrate: ({ tasks, ranked, place }) =>
    set((s) => ({ tasks, ranked, place: place ?? s.place })),
  setRecording: (v) => set({ isRecording: v }),
  setProcessing: (v) => set({ isProcessing: v }),
  setLastEffect: (e, u) => set({ lastEffect: e, lastUtterance: u ?? null }),
}));
