import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const TOKEN_KEY = 'mui-memo.session';
const USER_KEY = 'mui-memo.user';

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
  /** App 启动时调一次，把 SecureStore 里的 token + user 读回内存 */
  hydrate: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  user: null,
  hydrating: true,
  async setSession(token, user) {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    set({ token, user, hydrating: false });
  },
  async clearSession() {
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
    set({ token: null, user: null, hydrating: false });
  },
  async hydrate() {
    // token + user 一起缓存，断网启动也能显示用户名而不是退回「朋友」
    const [token, userJson] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    let user: SessionUser | null = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson) as SessionUser;
      } catch {
        // 坏数据，忽略
      }
    }
    set({ token, user, hydrating: false });
  },
}));

/** 非组件代码里直接拿 token（比如 api.ts 的 fetch 包装） */
export function getToken(): string | null {
  return useSession.getState().token;
}
