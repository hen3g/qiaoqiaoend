import { randomBytes } from "crypto";

const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Default nickname for new accounts, e.g. Unnamed 2djjdfj3k */
export function createDefaultNickname(length = 10): string {
  const bytes = randomBytes(length);
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += SUFFIX_CHARS[bytes[i]! % SUFFIX_CHARS.length];
  }
  return `Unnamed ${suffix}`;
}

export function isDefaultNickname(nickname: string | null | undefined): boolean {
  if (!nickname) return false;
  return /^(未命名|Unnamed) ?[a-z0-9]{8,16}$/i.test(nickname);
}
