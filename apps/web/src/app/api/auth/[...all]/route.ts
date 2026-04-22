import { getServerAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(async (req) => {
  const auth = await getServerAuth();
  return auth.handler(req);
});
