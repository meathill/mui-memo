import type { IntentEffect, TaskView } from '@mui-memo/shared/logic';
import type { TaskPlace, Utterance } from '@mui-memo/shared/validators';
import Constants from 'expo-constants';
import { type SessionUser, getToken, useSession } from './session';

/**
 * API base URL。dev 从 app.json 的 extra.apiBase 注入（通常是局域网里电脑的
 * IP + :3000，不能用 localhost —— 真机 / 模拟器访问不到宿主 loopback）。
 */
const API_BASE = (() => {
  const fromExtra = (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase;
  if (!fromExtra) {
    throw new Error('app.json extra.apiBase 没配');
  }
  return fromExtra.replace(/\/$/, '');
})();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type JsonInit = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: Record<string, string>;
};

/** 统一 fetch：自动带 Authorization header，JSON 序列化，错误走 ApiError */
async function request<T>(path: string, init: JsonInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...init.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const method = (init.method ?? 'GET').toUpperCase();
  let body: BodyInit | undefined;
  if (init.body instanceof FormData) {
    body = init.body;
    // 不要手动设 Content-Type，让 fetch 自己加 boundary
  } else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  } else if (method !== 'GET' && method !== 'HEAD') {
    // Better-Auth 的 /sign-out 等无 body POST 也强制要求 Content-Type:
    // application/json，否则 415 UNSUPPORTED_MEDIA_TYPE。空 body 用 '{}' 兜
    headers['Content-Type'] = 'application/json';
    body = '{}';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, body });
  if (res.status === 401) {
    await useSession.getState().clearSession();
    throw new ApiError('未登录', 401);
  }
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in data ? String((data as { error?: unknown }).error) : text) ||
      res.statusText;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ─── 端点封装 ──────────────────────────────────────────────

export const api = {
  auth: {
    /**
     * Better-Auth bearer plugin：邮箱密码登录成功后，token 在响应 header
     * `set-auth-token` 里（body 里也可能有 session 信息）。我们两边都兜一下。
     */
    async signInEmail(email: string, password: string) {
      const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new ApiError(err || '登录失败', res.status);
      }
      const token = res.headers.get('set-auth-token') ?? res.headers.get('Set-Auth-Token');
      const data = (await res.json()) as {
        token?: string;
        user?: SessionUser;
      };
      const finalToken = token ?? data.token;
      if (!finalToken || !data.user) {
        throw new ApiError('登录响应缺少 token 或 user', 500, data);
      }
      await useSession.getState().setSession(finalToken, data.user);
      return data.user;
    },
    async signUpEmail(email: string, password: string, name: string) {
      const res = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new ApiError(err || '注册失败', res.status);
      }
      const token = res.headers.get('set-auth-token') ?? res.headers.get('Set-Auth-Token');
      const data = (await res.json()) as {
        token?: string;
        user?: SessionUser;
      };
      const finalToken = token ?? data.token;
      if (!finalToken || !data.user) {
        throw new ApiError('注册响应缺少 token 或 user', 500, data);
      }
      await useSession.getState().setSession(finalToken, data.user);
      return data.user;
    },
    async signOut() {
      try {
        await request('/api/auth/sign-out', { method: 'POST' });
      } finally {
        await useSession.getState().clearSession();
      }
    },
    /**
     * Sign in with Apple（原生）：iOS 拿到 identityToken 后直接 POST。
     * Better-Auth 的 /sign-in/social 会验签并建/登 session，返回 token+user。
     * `fullName` 只在第一次授权时有值，要的话得赶紧存下来。
     */
    async signInWithApple(params: {
      identityToken: string;
      nonce?: string;
      fullName?: { givenName?: string | null; familyName?: string | null } | null;
    }) {
      const displayName = [params.fullName?.givenName, params.fullName?.familyName]
        .filter((x): x is string => Boolean(x))
        .join(' ')
        .trim();
      const res = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          provider: 'apple',
          idToken: {
            token: params.identityToken,
            nonce: params.nonce,
            user: displayName ? { name: displayName } : undefined,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new ApiError(err || 'Apple 登录失败', res.status);
      }
      const headerToken = res.headers.get('set-auth-token') ?? res.headers.get('Set-Auth-Token');
      const data = (await res.json()) as {
        token?: string;
        user?: SessionUser;
      };
      const finalToken = headerToken ?? data.token;
      if (!finalToken || !data.user) {
        throw new ApiError('Apple 登录响应缺少 token 或 user', 500, data);
      }
      await useSession.getState().setSession(finalToken, data.user);
      return data.user;
    },
    /** 启动时带 token 去刷一份用户信息。失败就当 token 过期，clear 掉 */
    async getSession(): Promise<SessionUser | null> {
      try {
        const data = await request<{ user?: SessionUser } | null>('/api/auth/get-session');
        return data?.user ?? null;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  },

  tasks: {
    list() {
      return request<{ tasks: TaskView[] }>('/api/tasks');
    },
    /** 分页；首屏不传 before，下一页传上一条 completedAt */
    completed(before?: string | null) {
      const qs = before ? `?before=${encodeURIComponent(before)}` : '';
      return request<{
        tasks: CompletedTask[];
        nextCursor: string | null;
        hasMore: boolean;
      }>(`/api/tasks/completed${qs}`);
    },
    detail(id: string) {
      return request<{ task: TaskView; attachments: Attachment[] }>(`/api/tasks/${id}`);
    },
    done(id: string) {
      return request<{ task?: TaskView }>(`/api/tasks/${id}/done`, {
        method: 'POST',
      });
    },
    batchDone(ids: string[]) {
      return request<{ tasks: TaskView[] }>('/api/tasks/batch-done', {
        method: 'POST',
        body: { taskIds: ids },
      });
    },
    delete(id: string) {
      return request<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' });
    },
    /** PATCH /api/tasks/[id] —— 手动编辑。body 只带要改的字段 */
    patch(id: string, body: Partial<TaskPatch>) {
      return request<{ ok: true }>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body,
      });
    },
  },

  intent: {
    /**
     * 提交录音走 multipart。RN 的 FormData 对 `{ uri, name, type }` 三元组
     * 有特殊处理（原生层直接把本地文件流上传），不需要先 readAsBlob。
     */
    async submit(opts: { audioUri: string; mimeType: string; place: TaskPlace; tz: string }) {
      const fd = new FormData();
      // RN FormData 的 file 字段类型比标准 DOM 多一层 uri，官方 TS 声明里没带，
      // 但运行时必须按这个形状传
      const ext = opts.mimeType.includes('wav') ? 'wav' : opts.mimeType.includes('webm') ? 'webm' : 'm4a';
      fd.append('audio', {
        uri: opts.audioUri,
        name: `utterance.${ext}`,
        type: opts.mimeType,
      } as unknown as Blob);
      fd.append('place', opts.place);
      fd.append('tz', opts.tz);
      return request<{
        utterance: Utterance;
        effect: IntentEffect;
        tasks: TaskView[];
      }>('/api/intent', { method: 'POST', body: fd });
    },
  },

  utterances: {
    list() {
      return request<{ utterances: Utterance[] }>('/api/utterances');
    },
  },

  profile: {
    stats() {
      return request<ProfileStats>('/api/profile/stats');
    },
  },
};

/**
 * 手动编辑可传的字段。对齐 apps/web PATCH 的 patchSchema（taskCoreSchema.partial + status）。
 * tag / deadline 允许传 null 代表清空。
 */
export interface TaskPatch {
  text: string;
  place: TaskPlace;
  window: 'now' | 'today' | 'later';
  energy: number;
  priority: number;
  tag: string | null;
  deadline: string | null;
  expectAt: string | null;
  dueAt: string | null;
  status: 'pending' | 'doing' | 'done';
}

export interface CompletedTask {
  id: string;
  text: string;
  tag: string | null;
  completedAt: string | null;
}

export interface Attachment {
  id: string;
  key: string;
  mime: string | null;
  size: number | null;
  originalName: string | null;
  createdAt: string;
}

export interface ProfileStats {
  user: { name: string; email: string };
  stats: {
    total: number;
    pending: number;
    doing: number;
    done: number;
    doneToday: number;
  };
}
