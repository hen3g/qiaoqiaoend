import { createPublicKey, createSign, createVerify } from "node:crypto";

const DEFAULT_GATEWAY = "https://openapi.alipay.com/gateway.do";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`未配置 ${name}`);
  }
  return value;
}

/** Normalize PEM: accept raw base64 or full PEM block. */
function toPem(key: string, kind: "private" | "public"): string {
  const trimmed = key.trim().replace(/\\n/g, "\n");
  if (trimmed.includes("BEGIN")) {
    return trimmed;
  }
  // Guard against accidental double-paste (two keys concatenated).
  const body = trimmed.replace(/\s+/g, "");
  const endMarker = "IDAQAB";
  const firstEnd = body.indexOf(endMarker);
  const normalized =
    firstEnd >= 0 && body.indexOf(endMarker, firstEnd + endMarker.length) >= 0
      ? body.slice(0, firstEnd + endMarker.length)
      : body;
  const label = kind === "private" ? "PRIVATE KEY" : "PUBLIC KEY";
  const lines = normalized.match(/.{1,64}/g) ?? [normalized];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

function getAppId(): string {
  return requireEnv("ALIPAY_APP_ID");
}

function getPrivateKeyPem(): string {
  return toPem(requireEnv("ALIPAY_PRIVATE_KEY"), "private");
}

function getAlipayPublicKeyPem(): string {
  const pem = toPem(requireEnv("ALIPAY_PUBLIC_KEY"), "public");
  try {
    createPublicKey(pem);
  } catch {
    throw new Error(
      "ALIPAY_PUBLIC_KEY 无效：请粘贴开放平台「支付宝公钥」（非应用公钥），且不要重复粘贴",
    );
  }
  return pem;
}

function getNotifyUrl(): string {
  return requireEnv("ALIPAY_NOTIFY_URL");
}

/** 开放平台「应用网关」地址；收 From 蚂蚁消息（如退款冲退完成）。 */
function getAppGatewayUrl(): string {
  return requireEnv("ALIPAY_APP_GATEWAY_URL");
}

export function getAlipayAppId(): string {
  return getAppId();
}

/** APP 支付异步通知地址（接口 notify_url）。 */
export function getAlipayNotifyUrl(): string {
  return getNotifyUrl();
}

/**
 * 应用网关公网 URL（填入开放平台「应用网关」）。
 * 用于 alipay.trade.refund.depositback.completed 等 From 蚂蚁 HTTP 消息。
 */
export function getAlipayAppGatewayUrl(): string {
  return getAppGatewayUrl();
}

export function getAlipayGateway(): string {
  return (
    process.env.ALIPAY_GATEWAY?.trim() || DEFAULT_GATEWAY
  ).replace(/\/$/, "");
}

/** From 蚂蚁：收单退款冲退完成通知 */
export const ALIPAY_MSG_DEPOSITBACK_COMPLETED =
  "alipay.trade.refund.depositback.completed";

/**
 * Build Alipay sign content: key=value joined by & after ASCII sort.
 * - Request sign: exclude empty + `sign` (keep `sign_type`)
 * - Notify verify: exclude empty + `sign` + `sign_type`
 */
export function buildSignContent(
  params: Record<string, string | undefined | null>,
  opts?: { excludeSignType?: boolean },
): string {
  const excludeSignType = opts?.excludeSignType === true;
  return Object.keys(params)
    .filter((key) => {
      if (key === "sign") return false;
      if (excludeSignType && key === "sign_type") return false;
      const value = params[key];
      return value !== undefined && value !== null && value !== "";
    })
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function signRsa2(content: string, privateKeyPem = getPrivateKeyPem()): string {
  const signer = createSign("RSA-SHA256");
  signer.update(content, "utf8");
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

export function verifyRsa2(
  content: string,
  signature: string,
  publicKeyPem = getAlipayPublicKeyPem(),
): boolean {
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(content, "utf8");
    verifier.end();
    return verifier.verify(publicKeyPem, signature, "base64");
  } catch {
    return false;
  }
}

function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // Alipay expects Asia/Shanghai wall time
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export type AppPayOrderInput = {
  outTradeNo: string;
  subject: string;
  /** Amount in yuan, e.g. 8.00 */
  totalAmount: string;
  body?: string;
};

/**
 * Build the order string for Alipay App SDK (`alipay.trade.app.pay`).
 * Client passes this string to the native pay() API.
 */
export function createAppPayOrderString(input: AppPayOrderInput): string {
  const bizContent = JSON.stringify({
    out_trade_no: input.outTradeNo,
    total_amount: input.totalAmount,
    subject: input.subject,
    product_code: "QUICK_MSECURITY_PAY",
    ...(input.body ? { body: input.body } : {}),
  });

  const params: Record<string, string> = {
    app_id: getAppId(),
    method: "alipay.trade.app.pay",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(),
    version: "1.0",
    notify_url: getNotifyUrl(),
    biz_content: bizContent,
  };

  const content = buildSignContent(params);
  const sign = signRsa2(content);

  const encoded = Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${key}=${encodeURIComponent(params[key]).replace(/%20/g, "+")}`,
    )
    .concat([`sign=${encodeURIComponent(sign)}`])
    .join("&");

  return encoded;
}

/** Verify async notify / return params from Alipay. */
export function verifyAlipayNotify(
  params: Record<string, string>,
): boolean {
  const sign = params.sign;
  if (!sign) return false;
  const content = buildSignContent(params, { excludeSignType: true });
  return verifyRsa2(content, sign);
}

export function isAlipayTradeSuccess(tradeStatus: string | undefined): boolean {
  return tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED";
}

/** Format yuan number as Alipay total_amount (2 decimal places). */
export function formatAlipayAmount(yuan: number): string {
  return yuan.toFixed(2);
}

export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100);
}

export type AlipayTradeQueryResult = {
  code: string;
  msg: string;
  subCode?: string;
  subMsg?: string;
  tradeNo?: string;
  outTradeNo?: string;
  tradeStatus?: string;
  totalAmount?: string;
  appId?: string;
};

/**
 * Server-side trade query (`alipay.trade.query`).
 * Used as a fallback when async notify is delayed / missed.
 */
export async function queryAlipayTrade(input: {
  outTradeNo: string;
}): Promise<AlipayTradeQueryResult> {
  const bizContent = JSON.stringify({
    out_trade_no: input.outTradeNo,
  });

  const params: Record<string, string> = {
    app_id: getAppId(),
    method: "alipay.trade.query",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(),
    version: "1.0",
    biz_content: bizContent,
  };

  const content = buildSignContent(params);
  params.sign = signRsa2(content);

  const body = new URLSearchParams(params);
  const res = await fetch(getAlipayGateway(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`支付宝查单 HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    alipay_trade_query_response?: Record<string, unknown>;
    sign?: string;
  };
  const data = json.alipay_trade_query_response;
  if (!data) {
    throw new Error("支付宝查单响应异常");
  }

  return {
    code: String(data.code ?? ""),
    msg: String(data.msg ?? ""),
    subCode: data.sub_code != null ? String(data.sub_code) : undefined,
    subMsg: data.sub_msg != null ? String(data.sub_msg) : undefined,
    tradeNo: data.trade_no != null ? String(data.trade_no) : undefined,
    outTradeNo:
      data.out_trade_no != null ? String(data.out_trade_no) : undefined,
    tradeStatus:
      data.trade_status != null ? String(data.trade_status) : undefined,
    totalAmount:
      data.total_amount != null ? String(data.total_amount) : undefined,
    appId: data.app_id != null ? String(data.app_id) : getAppId(),
  };
}
