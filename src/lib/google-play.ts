import { createVerify } from "node:crypto";

import {
  getGooglePackageName,
  userIdFromGoogleAccountId,
} from "@/lib/google-products";

/** Locally verified Play Billing receipt. Server never calls Google. */
export type GoogleSignedPurchase = {
  orderId: string;
  packageName: string;
  productId: string;
  purchaseToken: string;
  purchaseState: number;
  purchaseTime: number;
  purchaseType?: number;
  obfuscatedAccountId?: string;
};

function readLicenseKeyPem(): string {
  const raw = process.env.GOOGLE_PLAY_LICENSE_KEY?.trim();
  if (!raw) {
    throw new Error("未配置 Google Play 许可公钥");
  }
  const b64 = raw
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  if (b64.length < 80) {
    throw new Error("Google Play 许可公钥无效");
  }
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

function verifyRsaSha1(signedData: string, signature: string): boolean {
  try {
    const verifier = createVerify("RSA-SHA1");
    verifier.update(signedData, "utf8");
    return verifier.verify(readLicenseKeyPem(), signature, "base64");
  } catch {
    return false;
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Verify a Play Billing `originalJson` + `signature` with the app's
 * licensing public key. Works on a China-hosted server (no Google API).
 *
 * Play Console → Monetization setup → Licensing → Base64 public key
 * → env `GOOGLE_PLAY_LICENSE_KEY`.
 */
export function verifyGoogleSignedPurchase(input: {
  signedData: string;
  signature: string;
  productId: string;
  purchaseToken: string;
}): GoogleSignedPurchase {
  const signedData = input.signedData.trim();
  const signature = input.signature.trim();
  if (!signedData || !signature) {
    throw new Error("缺少 Google Play 签名凭证");
  }
  if (!verifyRsaSha1(signedData, signature)) {
    throw new Error("Google Play 凭证签名无效");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(signedData) as unknown;
  } catch {
    throw new Error("Google Play 凭证格式无效");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Google Play 凭证格式无效");
  }
  const item = parsed as Record<string, unknown>;
  const productId = asTrimmedString(item.productId);
  const purchaseToken = asTrimmedString(item.purchaseToken);
  const packageName = asTrimmedString(item.packageName);
  const orderId = asTrimmedString(item.orderId);
  const purchaseState = asNumber(item.purchaseState);
  const purchaseTime = asNumber(item.purchaseTime) ?? 0;
  const purchaseType = asNumber(item.purchaseType);
  const obfuscatedAccountId =
    asTrimmedString(item.obfuscatedAccountId) ||
    asTrimmedString(item.obfuscatedExternalAccountId) ||
    undefined;

  if (!productId || !purchaseToken) {
    throw new Error("Google Play 凭证缺少商品信息");
  }
  if (productId !== input.productId) {
    throw new Error("商品与凭证不一致");
  }
  if (purchaseToken !== input.purchaseToken) {
    throw new Error("购买凭证不一致");
  }
  if (packageName && packageName !== getGooglePackageName()) {
    throw new Error("应用包名与凭证不一致");
  }
  if (purchaseState !== 0) {
    throw new Error("Google Play 购买尚未完成");
  }

  return {
    orderId: orderId || purchaseToken.slice(0, 64),
    packageName: packageName || getGooglePackageName(),
    productId,
    purchaseToken,
    purchaseState: 0,
    purchaseTime,
    purchaseType,
    obfuscatedAccountId: obfuscatedAccountId || undefined,
  };
}

export function googlePurchaseEnvironment(
  purchase: GoogleSignedPurchase,
): "Test" | "Production" {
  return purchase.purchaseType === 0 ? "Test" : "Production";
}

export function googleAccountIdOf(
  purchase: GoogleSignedPurchase,
): number | null {
  return userIdFromGoogleAccountId(purchase.obfuscatedAccountId);
}
