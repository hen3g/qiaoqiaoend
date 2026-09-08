/** Google Play one-time product IDs. Must match the Android Play build. */

export const GOOGLE_PACKAGE_NAME = "com.yancitech.cangshuword";

export type GoogleProductKind = "vip" | "diamonds";

export type GoogleProduct = {
  sku: string;
  kind: GoogleProductKind;
  grantId: string;
};

export const GOOGLE_PRODUCTS: Record<string, GoogleProduct> = {
  "com.yancitech.cangshuword.vip.month": {
    sku: "com.yancitech.cangshuword.vip.month",
    kind: "vip",
    grantId: "month",
  },
  "com.yancitech.cangshuword.vip.quarter": {
    sku: "com.yancitech.cangshuword.vip.quarter",
    kind: "vip",
    grantId: "quarter18",
  },
  "com.yancitech.cangshuword.vip.year": {
    sku: "com.yancitech.cangshuword.vip.year",
    kind: "vip",
    grantId: "year38",
  },
};

export function getGoogleProduct(productId: string): GoogleProduct | null {
  return GOOGLE_PRODUCTS[productId] ?? null;
}

export function getGooglePackageName(): string {
  return process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || GOOGLE_PACKAGE_NAME;
}

export function googleAccountIdForUserId(userId: number): string {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("invalid user id");
  }
  return `h${userId.toString(16).padStart(12, "0")}`;
}

export function userIdFromGoogleAccountId(
  token: string | undefined | null,
): number | null {
  if (!token) return null;
  const normalized = token.trim().toLowerCase();
  if (!/^h[0-9a-f]{12}$/.test(normalized)) return null;
  const id = Number.parseInt(normalized.slice(1), 16);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}
