import type { Bucket, IntentEffect, TaskView } from "@mui-memo/shared/logic";
import type { TaskPlace, Utterance } from "@mui-memo/shared/validators";
import { create } from "zustand";

type RankedTask = TaskView & { bucket: Bucket };

/**
 * 一个待用户确认的 effect。MODIFY 命中和 DONE 命中走这个队列；
 * 服务端没有立即落库，所以只要前端不显式确认就当没发生。
 */
export interface PendingConfirm {
	/** 在 utterance.actions[] 中的位置，定位对应 action 用 */
	index: number;
	effect: IntentEffect;
	utterance: Utterance;
}

interface AppState {
	place: TaskPlace;
	tasks: TaskView[];
	ranked: RankedTask[];
	/** 最近一次 utterance 产生的全部 effects，按顺序展示在 toast 里 */
	lastEffects: IntentEffect[];
	lastUtterance: Utterance | null;
	/** 待用户确认的 effect 队列。一条一条弹窗，确认完一条 shift 一条 */
	pendingConfirms: PendingConfirm[];
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
	setLastEffects: (effects: IntentEffect[], u?: Utterance | null) => void;
	pushPendingConfirms: (list: PendingConfirm[]) => void;
	shiftPendingConfirm: () => void;
	clearPendingConfirms: () => void;
}

export const useAppStore = create<AppState>((set) => ({
	place: "any",
	tasks: [],
	ranked: [],
	lastEffects: [],
	lastUtterance: null,
	pendingConfirms: [],
	isProcessing: false,
	isRecording: false,

	setPlace: (p) => set({ place: p }),
	hydrate: ({ tasks, ranked, place }) =>
		set((s) => ({ tasks, ranked, place: place ?? s.place })),
	setRecording: (v) => set({ isRecording: v }),
	setProcessing: (v) => set({ isProcessing: v }),
	setLastEffects: (effects, u) =>
		set({ lastEffects: effects, lastUtterance: u ?? null }),
	pushPendingConfirms: (list) =>
		set((s) => ({ pendingConfirms: [...s.pendingConfirms, ...list] })),
	shiftPendingConfirm: () =>
		set((s) => ({ pendingConfirms: s.pendingConfirms.slice(1) })),
	clearPendingConfirms: () => set({ pendingConfirms: [] }),
}));
