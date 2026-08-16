import { X509Certificate } from "node:crypto";
import { compactVerify, decodeProtectedHeader, importX509 } from "jose";

import { getAppleBundleId } from "@/lib/apple-products";

/**
 * Apple Root CA - G3 (ECC), official PEM.
 * https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 */
const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

export type AppleEnvironment = "Sandbox" | "Production";

export type AppleSignedTransaction = {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  type?: string;
  environment: AppleEnvironment;
  transactionReason?: string;
  revocationDate?: number;
  appAccountToken?: string;
  /** 1 = introductory, 2 = promotional, 3 = offer code, 4 = win-back */
  offerType?: number;
  offerDiscountType?: string;
  /** Price in milliunits of the currency (1000 = ¥1.00). */
  price?: number;
};

export type AppleNotificationPayload = {
  notificationType: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
};

function normalizeX5cB64(value: string): string {
  const raw = value
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return raw + "=".repeat((4 - (raw.length % 4)) % 4);
}

function x5cToPem(b64: string): string {
  const normalized = normalizeX5cB64(b64);
  const lines = normalized.match(/.{1,64}/g) ?? [normalized];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
}

function certFromX5c(entry: unknown): X509Certificate {
  if (entry instanceof Uint8Array) {
    return new X509Certificate(Buffer.from(entry));
  }
  if (typeof entry !== "string" || !entry.trim()) {
    throw new Error("Apple 凭证证书无效");
  }
  return new X509Certificate(x5cToPem(entry));
}

function assertAppleChain(x5c: unknown[]): X509Certificate {
  if (x5c.length < 1) {
    throw new Error("Apple 凭证缺少证书");
  }
  const certs = x5c.map(certFromX5c);
  const leaf = certs[0]!;
  const root = new X509Certificate(APPLE_ROOT_CA_G3_PEM);
  const now = new Date();
  if (now < new Date(leaf.validFrom) || now > new Date(leaf.validTo)) {
    throw new Error("Apple 凭证证书已过期");
  }

  for (let i = 0; i < certs.length - 1; i++) {
    if (!certs[i]!.verify(certs[i + 1]!.publicKey)) {
      throw new Error("Apple 凭证证书链无效");
    }
  }
  const last = certs[certs.length - 1]!;
  const lastIsRoot = last.fingerprint256 === root.fingerprint256;
  if (!lastIsRoot && !last.verify(root.publicKey)) {
    throw new Error("Apple 凭证未由 Apple 根证书签发");
  }

  const subject = `${leaf.subject} ${leaf.issuer}`;
  if (!/apple/i.test(subject)) {
    throw new Error("Apple 凭证证书主体无效");
  }
  return leaf;
}

async function verifyAppleJws(jws: string): Promise<Record<string, unknown>> {
  const trimmed = jws.trim();
  if (trimmed.split(".").length !== 3) {
    throw new Error("Apple 凭证格式无效");
  }
  const header = decodeProtectedHeader(trimmed);
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length < 1) {
    throw new Error("Apple 凭证缺少证书");
  }
  assertAppleChain(x5c);
  const alg = typeof header.alg === "string" && header.alg ? header.alg : "ES256";
  const key = await importX509(x5cToPem(String(x5c[0])), alg);
  const { payload } = await compactVerify(trimmed, key);
  return JSON.parse(new TextDecoder().decode(payload)) as Record<
    string,
    unknown
  >;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

export async function verifyAppleSignedTransaction(
  jws: string,
  opts?: { allowRevoked?: boolean },
): Promise<AppleSignedTransaction> {
  const claims = await verifyAppleJws(jws);
  const bundleId = asString(claims.bundleId);
  const expected = getAppleBundleId();
  if (bundleId !== expected) {
    throw new Error("Apple 凭证与当前 App 不匹配");
  }
  const transactionId = asString(claims.transactionId);
  const originalTransactionId =
    asString(claims.originalTransactionId) || transactionId;
  const productId = asString(claims.productId);
  const purchaseDate = asNumber(claims.purchaseDate);
  const environment = asString(claims.environment);
  if (!transactionId || !productId || !purchaseDate) {
    throw new Error("Apple 凭证缺少交易信息");
  }
  if (environment !== "Sandbox" && environment !== "Production") {
    throw new Error("Apple 凭证环境无效");
  }
  const revocationDate = asNumber(claims.revocationDate);
  if (revocationDate && !opts?.allowRevoked) {
    throw new Error("该笔 Apple 交易已退款");
  }
  return {
    transactionId,
    originalTransactionId,
    bundleId,
    productId,
    purchaseDate,
    expiresDate: asNumber(claims.expiresDate),
    type: asString(claims.type) || undefined,
    environment,
    transactionReason: asString(claims.transactionReason) || undefined,
    revocationDate,
    appAccountToken: asString(claims.appAccountToken) || undefined,
    offerType: asNumber(claims.offerType),
    offerDiscountType: asString(claims.offerDiscountType) || undefined,
    price: asNumber(claims.price),
  };
}

export async function verifyAppleNotification(
  signedPayload: string,
): Promise<{
  notification: AppleNotificationPayload;
  transaction: AppleSignedTransaction | null;
}> {
  const claims = await verifyAppleJws(signedPayload);
  const notification = claims as AppleNotificationPayload;
  const signedTx = notification.data?.signedTransactionInfo;
  const transaction = signedTx
    ? await verifyAppleSignedTransaction(signedTx, { allowRevoked: true })
    : null;
  return { notification, transaction };
}
