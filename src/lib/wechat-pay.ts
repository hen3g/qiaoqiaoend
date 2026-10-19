import { createDecipheriv, createSign, createVerify, randomBytes, X509Certificate } from "node:crypto";

const WECHAT_API_HOST = "https://api.mch.weixin.qq.com";
const PLATFORM_CERT_TTL_MS = 12 * 60 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`未配置 ${name}`);
  }
  return value;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Normalize PEM: accept escaped \\n or raw PEM block. */
export function toPem(key: string, kind: "private" | "certificate" = "private"): string {
  const trimmed = key.trim().replace(/\\n/g, "\n");
  if (trimmed.includes("BEGIN")) {
    return trimmed;
  }
  const body = trimmed.replace(/\s+/g, "");
  const label = kind === "private" ? "PRIVATE KEY" : "CERTIFICATE";
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

export type WechatPayConfig = {
  appId: string;
  mchId: string;
  apiV3Key: string;
  certSerialNo: string;
  privateKeyPem: string;
  notifyUrl: string;
};

export function isWechatPayConfigured(): boolean {
  return Boolean(
    readEnv("WECHAT_PAY_MCH_ID") &&
      readEnv("WECHAT_PAY_API_V3_KEY") &&
      readEnv("WECHAT_PAY_CERT_SERIAL_NO") &&
      readEnv("WECHAT_PAY_PRIVATE_KEY") &&
      (readEnv("WECHAT_PAY_APP_ID") || readEnv("WECHAT_APP_ID")) &&
      readEnv("WECHAT_PAY_NOTIFY_URL"),
  );
}

export function getWechatPayConfig(): WechatPayConfig {
  const appId =
    readEnv("WECHAT_PAY_APP_ID") || readEnv("WECHAT_APP_ID") || "";
  if (!appId) {
    throw new Error("未配置 WECHAT_PAY_APP_ID");
  }
  return {
    appId,
    mchId: requireEnv("WECHAT_PAY_MCH_ID"),
    apiV3Key: requireEnv("WECHAT_PAY_API_V3_KEY"),
    certSerialNo: requireEnv("WECHAT_PAY_CERT_SERIAL_NO"),
    privateKeyPem: toPem(requireEnv("WECHAT_PAY_PRIVATE_KEY"), "private"),
    notifyUrl: requireEnv("WECHAT_PAY_NOTIFY_URL"),
  };
}

export function getWechatPayAppId(): string {
  return getWechatPayConfig().appId;
}

function randomNonce(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

function signAuthorizationMessage(
  message: string,
  privateKeyPem: string,
): string {
  const signer = createSign("RSA-SHA256");
  signer.update(message, "utf8");
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

function buildAuthorization(input: {
  method: string;
  /** Path + query, e.g. /v3/pay/transactions/app */
  urlPath: string;
  body: string;
  config: WechatPayConfig;
}): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = randomNonce();
  const message = `${input.method}\n${input.urlPath}\n${timestamp}\n${nonceStr}\n${input.body}\n`;
  const signature = signAuthorizationMessage(message, input.config.privateKeyPem);
  return (
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${input.config.mchId}",` +
    `nonce_str="${nonceStr}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${input.config.certSerialNo}"`
  );
}

async function wechatApiFetch<T>(input: {
  method: "GET" | "POST";
  urlPath: string;
  body?: unknown;
  config?: WechatPayConfig;
}): Promise<T> {
  const config = input.config ?? getWechatPayConfig();
  const bodyStr =
    input.method === "POST" ? JSON.stringify(input.body ?? {}) : "";
  const authorization = buildAuthorization({
    method: input.method,
    urlPath: input.urlPath,
    body: bodyStr,
    config,
  });

  const res = await fetch(`${WECHAT_API_HOST}${input.urlPath}`, {
    method: input.method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "qiaoqiaoend-wechat-pay/1.0",
    },
    body: input.method === "POST" ? bodyStr : undefined,
  });

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`微信支付响应异常 HTTP ${res.status}`);
    }
  }

  if (!res.ok) {
    const err = json as { code?: string; message?: string } | null;
    const msg = err?.message || err?.code || `微信支付 HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json as T;
}

export type WechatAppPrepayInput = {
  outTradeNo: string;
  description: string;
  /** Amount in fen */
  amountFen: number;
  attach?: string;
};

export type WechatAppPayParams = {
  appId: string;
  partnerId: string;
  prepayId: string;
  nonceStr: string;
  timeStamp: string;
  sign: string;
};

/**
 * Create APP prepay via `/v3/pay/transactions/app` and sign client pay params.
 * @see https://pay.weixin.qq.com/doc/v3/merchant/4012791855
 */
export async function createWechatAppPrepay(
  input: WechatAppPrepayInput,
): Promise<WechatAppPayParams> {
  if (!isWechatPayConfigured()) {
    throw new Error("未配置微信支付");
  }
  const config = getWechatPayConfig();
  if (!Number.isFinite(input.amountFen) || input.amountFen <= 0) {
    throw new Error("支付金额无效");
  }

  const body = {
    appid: config.appId,
    mchid: config.mchId,
    description: input.description.slice(0, 127),
    out_trade_no: input.outTradeNo,
    notify_url: config.notifyUrl,
    amount: {
      total: Math.round(input.amountFen),
      currency: "CNY",
    },
    ...(input.attach ? { attach: input.attach.slice(0, 127) } : {}),
  };

  const result = await wechatApiFetch<{ prepay_id?: string }>({
    method: "POST",
    urlPath: "/v3/pay/transactions/app",
    body,
    config,
  });

  const prepayId = result.prepay_id?.trim();
  if (!prepayId) {
    throw new Error("微信支付下单失败：缺少 prepay_id");
  }

  return signWechatAppPayParams(prepayId, config);
}

/** RSA sign for APP SDK (APIv3). */
export function signWechatAppPayParams(
  prepayId: string,
  config: WechatPayConfig = getWechatPayConfig(),
): WechatAppPayParams {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = randomNonce();
  const packageValue = `prepay_id=${prepayId}`;
  const message = `${config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const sign = signAuthorizationMessage(message, config.privateKeyPem);
  return {
    appId: config.appId,
    partnerId: config.mchId,
    prepayId,
    nonceStr,
    timeStamp,
    sign,
  };
}

/** fen → yuan string with 2 decimals (same as Alipay total_amount). */
export function fenToYuanString(fen: number): string {
  return (Math.round(fen) / 100).toFixed(2);
}

// ----- Platform certificates (verify notify / response) -----

type CachedPlatformCert = {
  serialNo: string;
  publicKeyPem: string;
  expireAt: number;
};

let platformCertCache: { fetchedAt: number; certs: CachedPlatformCert[] } | null =
  null;

function decryptAes256Gcm(input: {
  apiV3Key: string;
  associatedData: string;
  nonce: string;
  ciphertext: string;
}): string {
  const key = Buffer.from(input.apiV3Key, "utf8");
  if (key.length !== 32) {
    throw new Error("APIv3 密钥长度无效");
  }
  const buf = Buffer.from(input.ciphertext, "base64");
  if (buf.length <= 16) {
    throw new Error("密文无效");
  }
  const data = buf.subarray(0, buf.length - 16);
  const authTag = buf.subarray(buf.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(input.nonce, "utf8"),
  );
  decipher.setAuthTag(authTag);
  if (input.associatedData) {
    decipher.setAAD(Buffer.from(input.associatedData, "utf8"));
  }
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function decryptWechatResource(resource: {
  algorithm?: string;
  ciphertext: string;
  associated_data?: string;
  nonce: string;
}): string {
  const config = getWechatPayConfig();
  const algorithm = resource.algorithm || "AEAD_AES_256_GCM";
  if (algorithm !== "AEAD_AES_256_GCM") {
    throw new Error(`不支持的加密算法: ${algorithm}`);
  }
  return decryptAes256Gcm({
    apiV3Key: config.apiV3Key,
    associatedData: resource.associated_data || "",
    nonce: resource.nonce,
    ciphertext: resource.ciphertext,
  });
}

async function refreshPlatformCertificates(): Promise<CachedPlatformCert[]> {
  const config = getWechatPayConfig();
  const data = await wechatApiFetch<{
    data?: Array<{
      serial_no?: string;
      effective_time?: string;
      expire_time?: string;
      encrypt_certificate?: {
        algorithm?: string;
        nonce?: string;
        associated_data?: string;
        ciphertext?: string;
      };
    }>;
  }>({
    method: "GET",
    urlPath: "/v3/certificates",
    config,
  });

  const now = Date.now();
  const certs: CachedPlatformCert[] = [];
  for (const item of data.data || []) {
    const enc = item.encrypt_certificate;
    if (!item.serial_no || !enc?.ciphertext || !enc.nonce) continue;
    const pem = decryptAes256Gcm({
      apiV3Key: config.apiV3Key,
      associatedData: enc.associated_data || "",
      nonce: enc.nonce,
      ciphertext: enc.ciphertext,
    });
    try {
      const x509 = new X509Certificate(pem);
      certs.push({
        serialNo: item.serial_no.toUpperCase(),
        publicKeyPem: x509.publicKey.export({ type: "spki", format: "pem" }).toString(),
        expireAt: item.expire_time
          ? new Date(item.expire_time).getTime()
          : now + PLATFORM_CERT_TTL_MS,
      });
    } catch (err) {
      console.error("[wechat-pay] bad platform cert", item.serial_no, err);
    }
  }

  if (certs.length === 0) {
    throw new Error("无法加载微信支付平台证书");
  }

  platformCertCache = { fetchedAt: now, certs };
  return certs;
}

async function getPlatformCertPublicKey(
  serialNo: string,
): Promise<string | null> {
  const want = serialNo.trim().toUpperCase();
  const now = Date.now();
  const stale =
    !platformCertCache ||
    now - platformCertCache.fetchedAt > PLATFORM_CERT_TTL_MS;

  const find = (certs: CachedPlatformCert[]) =>
    certs.find((c) => c.serialNo === want && c.expireAt > now)?.publicKeyPem ??
    null;

  if (!stale && platformCertCache) {
    const hit = find(platformCertCache.certs);
    if (hit) return hit;
  }

  try {
    const certs = await refreshPlatformCertificates();
    return find(certs);
  } catch (err) {
    console.error("[wechat-pay] refresh platform certs failed", err);
    if (platformCertCache) return find(platformCertCache.certs);
    return null;
  }
}

/**
 * Verify WeChat Pay HTTP notification / response signature.
 * Headers: Wechatpay-Timestamp, Wechatpay-Nonce, Wechatpay-Signature, Wechatpay-Serial
 */
export async function verifyWechatPaySignature(input: {
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
  serial: string;
}): Promise<boolean> {
  if (
    !input.timestamp ||
    !input.nonce ||
    !input.signature ||
    !input.serial
  ) {
    return false;
  }
  // Reject stale timestamps (>5 min)
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  const publicKey = await getPlatformCertPublicKey(input.serial);
  if (!publicKey) return false;

  const message = `${input.timestamp}\n${input.nonce}\n${input.body}\n`;
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(message, "utf8");
    verifier.end();
    return verifier.verify(publicKey, input.signature, "base64");
  } catch {
    return false;
  }
}

export type WechatNotifyResource = {
  mchid?: string;
  appid?: string;
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  trade_state_desc?: string;
  success_time?: string;
  amount?: {
    total?: number;
    payer_total?: number;
    currency?: string;
  };
};

export function isWechatTradeSuccess(tradeState: string | undefined): boolean {
  return tradeState === "SUCCESS";
}

export type WechatTradeQueryResult = {
  outTradeNo?: string;
  transactionId?: string;
  tradeState?: string;
  appId?: string;
  mchId?: string;
  amountTotalFen?: number;
};

/** Query by merchant out_trade_no. */
export async function queryWechatTradeByOutTradeNo(
  outTradeNo: string,
): Promise<WechatTradeQueryResult> {
  const config = getWechatPayConfig();
  const urlPath =
    `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}` +
    `?mchid=${encodeURIComponent(config.mchId)}`;
  const data = await wechatApiFetch<{
    out_trade_no?: string;
    transaction_id?: string;
    trade_state?: string;
    appid?: string;
    mchid?: string;
    amount?: { total?: number };
  }>({
    method: "GET",
    urlPath,
    config,
  });

  return {
    outTradeNo: data.out_trade_no,
    transactionId: data.transaction_id,
    tradeState: data.trade_state,
    appId: data.appid,
    mchId: data.mchid,
    amountTotalFen:
      data.amount?.total != null ? Number(data.amount.total) : undefined,
  };
}
