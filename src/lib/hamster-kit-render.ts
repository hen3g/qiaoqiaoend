import path from "path";
import sharp from "sharp";

import type { HamsterKitName } from "@/lib/hamster-kit";

const OUTPUT = 512;
const BASE_FIT = 0.92;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "").toUpperCase();
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

/** Crop the overlay to OUTPUT so zoom/rotation can clip like the client preview. */
async function clipToCanvas(buf: Buffer, size: number): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= size && height <= size) return buf;

  const cropW = Math.min(size, width);
  const cropH = Math.min(size, height);
  const left = Math.max(0, Math.min(Math.round((width - cropW) / 2), width - cropW));
  const top = Math.max(0, Math.min(Math.round((height - cropH) / 2), height - cropH));
  return sharp(buf)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

export async function renderHamsterKitPng(input: {
  kit: HamsterKitName;
  backgroundColor: string;
  scale?: number;
  rotation?: number;
}): Promise<Buffer> {
  const kitPath = path.join(
    process.cwd(),
    "assets/hamster-kit",
    `${input.kit}.png`,
  );
  const scale = clamp(input.scale ?? 1, 0.5, 1.8);
  const rotation = clamp(input.rotation ?? 0, -180, 180);
  const target = Math.round(OUTPUT * BASE_FIT * scale);
  const bg = parseHex(input.backgroundColor);

  let sprite = sharp(kitPath).resize(target, target, {
    fit: "inside",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (rotation !== 0) {
    sprite = sprite.rotate(rotation, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  const overlay = await clipToCanvas(await sprite.png().toBuffer(), OUTPUT);
  if (overlay.length < 100) {
    throw new Error("Hamster avatar render returned empty image");
  }

  return sharp({
    create: {
      width: OUTPUT,
      height: OUTPUT,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 },
    },
  })
    .composite([{ input: overlay, gravity: "centre" }])
    .png()
    .toBuffer();
}
