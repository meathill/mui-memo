import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import pkg from "./package.json" with { type: "json" };

// 让 `next dev` 能读到 wrangler.jsonc 顶层绑定 + `.dev.vars` 里的 secrets
initOpenNextCloudflareForDev({
  configPath: "./wrangler.jsonc",
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
