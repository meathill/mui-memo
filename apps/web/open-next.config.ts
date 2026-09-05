// OpenNext configuration for Cloudflare Workers deployment
// See: https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Issue #12：显式禁用 cache interception，防止 _rsc prefetch 回环打爆 Worker 请求数
  enableCacheInterception: false,
});
