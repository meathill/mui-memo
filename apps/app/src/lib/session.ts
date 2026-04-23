import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const TOKEN_KEY = 'mui-memo.session';

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  /** 首次从 SecureStore 读回 token 之前为 true，防止 UI 在未知状态下误跳登录 */
  hydrating: boolean;
  setSession: (token: string, user: SessionUser) => Promise<void>;
  clearSession: () => Promise<void>;
  /** App 启动时调一次，把 SecureStore 里的 token 读回内存 */
  hydrate: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  user: null,
  hydrating: true,
  async setSession(token, user) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, user, hydrating: false });
  },
  async clearSession() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null, hydrating: false });
  },
  async hydrate() {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    // user 不持久化；启动时带 token 去 /api/auth/get-session 刷一份
    set({ token, hydrating: false });
  },
}));

/** 非组件代码里直接拿 token（比如 api.ts 的 fetch 包装） */
export function getToken(): string | null {
  return useSession.getState().token;
}
