import { create } from 'zustand';

/**
 * 录音状态
 */
interface RecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  startRecording: () => void;
  stopRecording: (blob: Blob) => void;
  clearRecording: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  audioBlob: null,
  startRecording: () => set({ isRecording: true, audioBlob: null }),
  stopRecording: (blob: Blob) => set({ isRecording: false, audioBlob: blob }),
  clearRecording: () => set({ isRecording: false, audioBlob: null }),
}));

/**
 * 任务列表状态
 */
interface Task {
  id: string;
  rawText: string;
  actionType?: string;
  status: 'frozen' | 'active' | 'completed';
}

interface TaskState {
  tasks: Task[];
  activeTasks: Task[];
  setTasks: (tasks: Task[]) => void;
  setActiveTasks: (tasks: Task[]) => void;
  completeTask: (id: string) => void;
  completeBatch: (ids: string[]) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  activeTasks: [],
  setTasks: (tasks) => set({ tasks }),
  setActiveTasks: (activeTasks) => set({ activeTasks }),
  completeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, status: 'completed' as const } : t)),
      activeTasks: state.activeTasks.filter((t) => t.id !== id),
    })),
  completeBatch: (ids) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        ids.includes(t.id) ? { ...t, status: 'completed' as const } : t,
      ),
      activeTasks: state.activeTasks.filter((t) => !ids.includes(t.id)),
    })),
}));
