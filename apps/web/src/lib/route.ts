import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { getServerSession } from './auth';
import { createDb, type Database } from './db';

type Session = NonNullable<Awaited<ReturnType<typeof getServerSession>>>;
type CfEnv = Awaited<ReturnType<typeof getCloudflareContext>>['env'];

/** Cloudflare ExecutionContext 的最小投影。@cloudflare/workers-types 没装，手写一份。 */
interface ExecCtx {
  waitUntil(promise: Promise<unknown>): void;
}

export interface AuthedCtx {
  session: Session;
  db: Database;
  env: CfEnv;
  /** Cloudflare 执行上下文，用 waitUntil 挂后台任务。Next dev 下可能为 undefined。 */
  execCtx: ExecCtx | undefined;
}

/**
 * Route handler 前置：校验 session + 构造 db。
 *
 * 用法：
 * ```ts
 * const [resp, ctx] = await requireAuthDb();
 * if (resp) return resp;
 * const { session, db, env } = ctx;
 * ```
 *
 * 14 个路由全部复制过这四行；抽出来避免 401 的 JSON shape 漂移，
 * 也让新路由少写 3 行样板。
 */
export async function requireAuthDb(): Promise<[NextResponse, null] | [null, AuthedCtx]> {
  const session = await getServerSession();
  if (!session) {
    return [NextResponse.json({ error: 'unauthorized' }, { status: 401 }), null];
  }
  const { env, ctx: execCtx } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);
  return [null, { session, db, env, execCtx: execCtx as ExecCtx | undefined }];
}

/**
 * 只要 session（不建 db）。audio 回放等纯 R2 路由用。
 */
export async function requireAuth(): Promise<[NextResponse, null] | [null, { session: Session; env: CfEnv }]> {
  const session = await getServerSession();
  if (!session) {
    return [NextResponse.json({ error: 'unauthorized' }, { status: 401 }), null];
  }
  const { env } = await getCloudflareContext({ async: true });
  return [null, { session, env }];
}
