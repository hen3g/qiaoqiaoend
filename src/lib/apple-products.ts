/** App Store Connect product IDs. Must match the iOS client. */

export const APPLE_BUNDLE_ID = "com.yancitech.qiaoqiaoenglish";

export type AppleProductKind = "vip" | "diamonds";

export type AppleProduct = {
  sku: string;
  kind: AppleProductKind;
  /** Backend plan/pack granted for this Apple SKU. */
  grantId: string;
};

export const APPLE_PRODUCTS: Record<string, AppleProduct> = {
  "com.yancitech.qiaoqiaoenglish.vip.month": {
    sku: "com.yancitech.qiaoqiaoenglish.vip.month",
    kind: "vip",
    grantId: "month",
  },
  "com.yancitech.qiaoqiaoenglish.vip.quarter": {
    sku: "com.yancitech.qiaoqiaoenglish.vip.quarter",
    kind: "vip",
    grantId: "quarter18",
  },
  "com.yancitech.qiaoqiaoenglish.vip.year": {
    sku: "com.yancitech.qiaoqiaoenglish.vip.year",
    kind: "vip",
    grantId: "year38",
  },
  "com.yancitech.qiaoqiaoenglish.diamonds.pack6": {
    sku: "com.yancitech.qiaoqiaoenglish.diamonds.pack6",
    kind: "diamonds",
    grantId: "pack6",
  },
  "com.yancitech.qiaoqiaoenglish.diamonds.pack25": {
    sku: "com.yancitech.qiaoqiaoenglish.diamonds.pack25",
    kind: "diamonds",
    grantId: "pack28",
  },
  "com.yancitech.qiaoqiaoenglish.diamonds.pack28": {
    sku: "com.yancitech.qiaoqiaoenglish.diamonds.pack28",
    kind: "diamonds",
    grantId: "pack28",
  },
};

/** Deterministic UUID so StoreKit notifications can attribute a first purchase. */
const APPLE_AAT_PREFIX = "a11e0000-0000-4000-8000-";

export function appleAppAccountTokenForUserId(userId: number): string {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("invalid user id");
  }
  return `${APPLE_AAT_PREFIX}${userId.toString(16).padStart(12, "0")}`;
}

export function userIdFromAppleAppAccountToken(
  token: string | undefined | null,
): number | null {
  if (!token) return null;
  const normalized = token.trim().toLowerCase();
  if (!normalized.startsWith(APPLE_AAT_PREFIX)) return null;
  const hex = normalized.slice(APPLE_AAT_PREFIX.length);
  if (!/^[0-9a-f]{12}$/.test(hex)) return null;
  const id = Number.parseInt(hex, 16);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export function getAppleProduct(productId: string): AppleProduct | null {
  return APPLE_PRODUCTS[productId] ?? null;
}

export function getAppleBundleId(): string {
  return process.env.APPLE_BUNDLE_ID?.trim() || APPLE_BUNDLE_ID;
}
