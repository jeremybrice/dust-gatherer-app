import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "public/icons/source.png");
const out = path.join(root, "public/icons");

await mkdir(out, { recursive: true });
await sharp(src).resize(192, 192).png().toFile(path.join(out, "icon-192.png"));
await sharp(src).resize(512, 512).png().toFile(path.join(out, "icon-512.png"));
await sharp(src).resize(180, 180).png().toFile(path.join(out, "apple-touch-icon.png"));

const size = 512;
const pad = Math.round(size * 0.2);
const inner = size - pad * 2;
const logo = await sharp(src).resize(inner, inner).png().toBuffer();
await sharp({
  create: {
    width: size,
    height: size,
    channels: 4,
    background: { r: 250, g: 247, b: 242, alpha: 255 },
  },
})
  .composite([{ input: logo, left: pad, top: pad }])
  .png()
  .toFile(path.join(out, "icon-512-maskable.png"));
