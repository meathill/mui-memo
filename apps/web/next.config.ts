import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// 让 `next dev` 能读到 wrangler.jsonc 顶层绑定 + `.dev.vars` 里的 secrets
initOpenNextCloudflareForDev({
  configPath: "./wrangler.jsonc",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
