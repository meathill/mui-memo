import createMDX from '@next/mdx';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';
import pkg from './package.json' with { type: 'json' };

// 让 `next dev` 能读到 wrangler.jsonc 顶层绑定 + `.dev.vars` 里的 secrets
initOpenNextCloudflareForDev({
  configPath: './wrangler.jsonc',
});

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
};

export default withMDX(nextConfig);
