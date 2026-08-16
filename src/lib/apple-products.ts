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
};

export function getAppleProduct(productId: string): AppleProduct | null {
  return APPLE_PRODUCTS[productId] ?? null;
}

export function getAppleBundleId(): string {
  return process.env.APPLE_BUNDLE_ID?.trim() || APPLE_BUNDLE_ID;
}
