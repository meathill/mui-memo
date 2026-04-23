const { mkdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const APP_DIR = path.resolve(__dirname, '..');
const BRAND_DIR = path.join(APP_DIR, 'public', 'brand');
const PUBLIC_ICON_DIR = path.join(APP_DIR, 'public', 'app-icons');
const APP_META_DIR = path.join(APP_DIR, 'src', 'app');

const rasterTargets = [
  {
    outputPath: path.join(APP_META_DIR, 'apple-icon.png'),
    size: 180,
    sourcePath: path.join(BRAND_DIR, 'app-icon.svg'),
  },
  {
    outputPath: path.join(PUBLIC_ICON_DIR, 'icon-192.png'),
    size: 192,
    sourcePath: path.join(BRAND_DIR, 'app-icon.svg'),
  },
  {
    outputPath: path.join(PUBLIC_ICON_DIR, 'icon-512.png'),
    size: 512,
    sourcePath: path.join(BRAND_DIR, 'app-icon.svg'),
  },
  {
    outputPath: path.join(PUBLIC_ICON_DIR, 'icon-maskable-192.png'),
    size: 192,
    sourcePath: path.join(BRAND_DIR, 'app-icon-maskable.svg'),
  },
  {
    outputPath: path.join(PUBLIC_ICON_DIR, 'icon-maskable-512.png'),
    size: 512,
    sourcePath: path.join(BRAND_DIR, 'app-icon-maskable.svg'),
  },
];

async function main() {
  await mkdir(PUBLIC_ICON_DIR, { recursive: true });

  for (const target of rasterTargets) {
    const svg = await readFile(target.sourcePath);

    await sharp(svg, { density: 384 }).resize(target.size, target.size).png().toFile(target.outputPath);

    console.log(`generated ${path.relative(APP_DIR, target.outputPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
