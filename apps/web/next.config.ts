import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Initialize OpenNext for local dev with Cloudflare bindings
// This makes wrangler.jsonc vars and .dev.vars available in dev mode
initOpenNextCloudflareForDev({
  environment: "dev",
  configPath: "./wrangler.jsonc",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
