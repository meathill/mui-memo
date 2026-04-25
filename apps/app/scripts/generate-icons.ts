/**
 * 把 brand SVG 渲染成 Expo 需要的 PNG。
 *
 * 输入：apps/app/assets/brand/*.svg
 * 输出：
 *   - apps/app/assets/icon.png         (1024×1024)
 *   - apps/app/assets/icon-maskable.png (1024×1024，Android 自适应预留)
 *   - apps/app/assets/splash.png       (1024×1024 中心 logo + 透明，bg 由 app.config.ts 提供)
 *
 * 用法：
 *   pnpm --filter @mui-memo/app icons:generate
 *
 * sharp 已经在 monorepo 里（web 用），不用单独装。
 */
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, '..');
const BRAND_DIR = path.join(APP_DIR, 'assets', 'brand');
const OUT_DIR = path.join(APP_DIR, 'assets');

interface Target {
  source: string;
  output: string;
  size: number;
  /** splash 不需要背景填色（Expo splash.backgroundColor 负责） */
  background?: { r: number; g: number; b: number; alpha?: number };
}

const targets: Target[] = [
  {
    source: path.join(BRAND_DIR, 'icon.svg'),
    output: path.join(OUT_DIR, 'icon.png'),
    size: 1024,
    // iOS app icon 不能透明，给个 paper 兜底（SVG 自己也涂了，这是双保险）
    background: { r: 231, g: 215, b: 193, alpha: 1 },
  },
  {
    source: path.join(BRAND_DIR, 'icon-maskable.svg'),
    output: path.join(OUT_DIR, 'icon-maskable.png'),
    size: 1024,
    background: { r: 231, g: 215, b: 193, alpha: 1 },
  },
  {
    source: path.join(BRAND_DIR, 'splash-logo.svg'),
    output: path.join(OUT_DIR, 'splash.png'),
    size: 1024,
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const t of targets) {
    const svg = await readFile(t.source);
    let pipeline = sharp(svg, { density: 384 }).resize(t.size, t.size, { fit: 'contain' });
    if (t.background) pipeline = pipeline.flatten({ background: t.background });
    await pipeline.png().toFile(t.output);
    console.log(`✓ ${path.relative(APP_DIR, t.output)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
