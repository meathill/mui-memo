import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { ShareImage } from "../src/components/marketing/share-image";

const APP_DIR = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(APP_DIR, "public");
const SIZE = { width: 1200, height: 630 };

async function main() {
	for (const name of ["opengraph-image", "twitter-image"]) {
		const response = new ImageResponse(<ShareImage />, SIZE);
		const buffer = Buffer.from(await response.arrayBuffer());
		const outputPath = path.join(PUBLIC_DIR, `${name}.png`);
		await writeFile(outputPath, buffer);
		console.log(`generated ${path.relative(APP_DIR, outputPath)}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
