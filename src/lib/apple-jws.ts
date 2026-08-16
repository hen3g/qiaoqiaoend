import { createPublicKey, X509Certificate } from "node:crypto";
import { compactVerify, decodeProtectedHeader } from "jose";

import { getAppleBundleId } from "@/lib/apple-products";

/**
 * Apple Root CA - G3 (ECC), public.
 * https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 */
const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQKDB1BcHBsZSBJbmMuIC0gQ29weXJp
Z2h0IDI3IDIwMTUxGjAYBgNVBAsMEUFwcGxlIENlcnRpZmljYXRpb24wHhcNMTQw
NDMwMTgxMDA5WhcNMzUwNDMwMTgxMDA5WjBnMRswGQYDVQQDDBJBcHBsZSBSb290
IENBIC0gRzMxJjAkBgNVBAoMHUFwcGxlIEluYy4gLSBDb3B5cmlnaHQgMjcgMjAx
NTEaMBgGA1UECwwRQXBwbGUgQ2VydGlmaWNhdGlvbjB2MBAGByqGSM49AgEGBSuB
BAAiA2IABJjpLz1AcqYOHaYNB1LOFxKr9FiWA/ZPqbqD4iEO93D4HzJb44H9rs9G
8WAz9k9kQP3/Rl9JGJRQ1pVKTpRd+QkLvKFqqsYDk4WWLVu6PHswsUdwZVFBJd5G
xOkRjALzzaswOqeNVWkwEQYDVR0OBAYECERiz81EUb5RMA8GA1UdEwEB/wQFMAMB
Af8wCgYIKoZIzj0EAwMDaAAwZQIxANnbWlHY5a5fOA77RHKFP8VyYoqXHV4sqkbE
/whOS8G3XLoEovdrprTgkgK5VrukSgIwQ7jNkkJDf/Tmf3rSgG1KQtppcWObE4QY
SZT4USPdmPfsW4JpB0KUwhpx6CqLfCgx
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

function certFromX5c(b64: string): X509Certificate {
  const der = Buffer.from(b64.replace(/\s+/g, ""), "base64");
  return new X509Certificate(der);
}

function assertAppleChain(x5c: string[]): X509Certificate {
  if (x5c.length < 1) {
    throw new Error("Apple 凭证缺少证书");
  }
  const leaf = certFromX5c(x5c[0]!);
  const root = new X509Certificate(APPLE_ROOT_CA_G3_PEM);
  const now = new Date();
  if (now < new Date(leaf.validFrom) || now > new Date(leaf.validTo)) {
    throw new Error("Apple 凭证证书已过期");
  }

  if (x5c.length >= 2) {
    const intermediate = certFromX5c(x5c[1]!);
    if (!leaf.verify(intermediate.publicKey)) {
      throw new Error("Apple 凭证证书链无效");
    }
    if (!intermediate.verify(root.publicKey)) {
      throw new Error("Apple 凭证未由 Apple 根证书签发");
    }
  } else if (!leaf.verify(root.publicKey)) {
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
  if (!Array.isArray(x5c) || x5c.length < 1 || typeof x5c[0] !== "string") {
    throw new Error("Apple 凭证缺少证书");
  }
  const leaf = assertAppleChain(x5c.map(String));
  const key = createPublicKey(leaf.publicKey);
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
  if (asNumber(claims.revocationDate)) {
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
    revocationDate: asNumber(claims.revocationDate),
    appAccountToken: asString(claims.appAccountToken) || undefined,
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
    ? await verifyAppleSignedTransaction(signedTx)
    : null;
  return { notification, transaction };
}
