import { createAuth } from '@/lib/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { toNextJsHandler } from 'better-auth/next-js';

async function getAuth() {
  const { env } = await getCloudflareContext();
  return createAuth(env.TIDB_DATABASE_URL, env.BETTER_AUTH_SECRET);
}

export const { GET, POST } = toNextJsHandler(async (req) => {
  const auth = await getAuth();
  return auth.handler(req);
});
