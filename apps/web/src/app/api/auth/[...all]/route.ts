import { toNextJsHandler } from 'better-auth/next-js';
import { getServerAuth } from '@/lib/auth';

export const { GET, POST } = toNextJsHandler(async (req) => {
  const auth = await getServerAuth();
  return auth.handler(req);
});
