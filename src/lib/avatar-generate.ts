import { randomBytes } from "crypto";

export const AVATAR_STYLES = [
  "lorelei",
  "adventurer-neutral",
  "avataaars",
  "big-ears-neutral",
  "croodles",
  "fun-emoji",
  "micah",
  "notionists",
  "open-peeps",
  "personas",
] as const;

export const AVATAR_BACKGROUNDS = [
  "FFE8D2",
  "FFF4EA",
  "E8F5F0",
  "EAF2FF",
  "F5E6C8",
  "FFE4EC",
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export type AvatarOption = {
  style: AvatarStyle;
  seed: string;
  backgroundColor: string;
};

export type AvatarCandidate = AvatarOption & {
  id: string;
  previewUrl: string;
};

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

export function isAvatarStyle(value: unknown): value is AvatarStyle {
  return (
    typeof value === "string" &&
    (AVATAR_STYLES as readonly string[]).includes(value)
  );
}

export function buildAvatarPreviewUrl(
  option: AvatarOption,
  size = 256,
): string {
  const params = new URLSearchParams({
    seed: option.seed,
    size: String(size),
    backgroundColor: option.backgroundColor.replace(/^#/, ""),
  });
  return `https://api.dicebear.com/10.x/${option.style}/png?${params.toString()}`;
}

export function createAvatarOption(): AvatarOption {
  return {
    style: pick(AVATAR_STYLES),
    seed: randomBytes(8).toString("hex"),
    backgroundColor: pick(AVATAR_BACKGROUNDS),
  };
}

export function createAvatarCandidates(count = 9): AvatarCandidate[] {
  const n = Math.max(1, Math.min(24, Math.floor(count)));
  return Array.from({ length: n }, () => {
    const option = createAvatarOption();
    return {
      ...option,
      id: `${option.style}:${option.seed}:${option.backgroundColor}`,
      previewUrl: buildAvatarPreviewUrl(option, 128),
    };
  });
}

export async function fetchAvatarPng(option: AvatarOption): Promise<Buffer> {
  const url = buildAvatarPreviewUrl(option, 256);
  const res = await fetch(url, {
    headers: { Accept: "image/png" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Avatar generator failed (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) {
    throw new Error("Avatar generator returned empty image");
  }
  return buf;
}
