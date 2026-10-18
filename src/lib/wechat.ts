import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";
import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import { createDefaultNickname } from "@/lib/nickname";

const WECHAT_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token";
const PENDING_TTL = "10m";

export type WechatTokenResult = {
  openid: string;
  unionid: string | null;
  accessToken: string;
};

export type WechatPendingPayload = {
  openid: string;
  unionid: string | null;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

export function getWechatAppCredentials(): { appId: string; appSecret: string } {
  const appId = (process.env.WECHAT_APP_ID || "").trim();
  const appSecret = (process.env.WECHAT_APP_SECRET || "").trim();
  if (!appId || !appSecret) {
    throw new Error("WECHAT_NOT_CONFIGURED");
  }
  return { appId, appSecret };
}

/** Exchange mobile OAuth code for openid (and optional unionid). */
export async function exchangeWechatCode(code: string): Promise<WechatTokenResult> {
  const { appId, appSecret } = getWechatAppCredentials();
  const url = new URL(WECHAT_TOKEN_URL);
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);
  url.searchParams.set("code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const data = (await res.json()) as {
    access_token?: string;
    openid?: string;
    unionid?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (!data.access_token || !data.openid) {
    const err = data.errmsg || `wechat_token_failed_${data.errcode ?? "unknown"}`;
    console.error("wechat code exchange failed", data.errcode, data.errmsg ? "[redacted errmsg]" : "");
    throw new Error(err);
  }

  return {
    openid: data.openid,
    unionid: typeof data.unionid === "string" && data.unionid ? data.unionid : null,
    accessToken: data.access_token,
  };
}

/** Short-lived ticket so client can confirm auto-create after one-time code is consumed. */
export async function createWechatPendingTicket(
  payload: WechatPendingPayload,
): Promise<string> {
  return new SignJWT({
    typ: "wechat_pending",
    openid: payload.openid,
    unionid: payload.unionid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(PENDING_TTL)
    .sign(getAuthSecret());
}

export async function readWechatPendingTicket(
  ticket: string,
): Promise<WechatPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(ticket, getAuthSecret());
    if (payload.typ !== "wechat_pending") return null;
    const openid = typeof payload.openid === "string" ? payload.openid : null;
    if (!openid) return null;
    const unionid =
      typeof payload.unionid === "string" && payload.unionid
        ? payload.unionid
        : null;
    return { openid, unionid };
  } catch {
    return null;
  }
}

export async function findUserIdByWechatOpenid(
  openid: string,
): Promise<number | null> {
  const rows = await query<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM users WHERE wechat_openid = :openid LIMIT 1`,
    { openid },
  );
  return rows[0]?.id ?? null;
}

const USERNAME_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export async function allocateWechatUsername(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const bytes = randomBytes(8);
    let suffix = "";
    for (let i = 0; i < 8; i += 1) {
      suffix += USERNAME_CHARS[bytes[i]! % USERNAME_CHARS.length];
    }
    const username = `wx_${suffix}`;
    const existing = await query<RowDataPacket[]>(
      `SELECT id FROM users WHERE username = :username LIMIT 1`,
      { username },
    );
    if (!existing[0]) return username;
  }
  return `wx_${randomBytes(12).toString("hex").slice(0, 16)}`;
}

export async function allocateDefaultNicknameUnique(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nickname = createDefaultNickname();
    const existing = await query<RowDataPacket[]>(
      `SELECT id FROM users WHERE nickname = :nickname LIMIT 1`,
      { nickname },
    );
    if (!existing[0]) return nickname;
  }
  return createDefaultNickname(14);
}

export async function bindWechatToUser(
  userId: number,
  openid: string,
  unionid: string | null,
): Promise<void> {
  await execute(
    `UPDATE users
     SET wechat_openid = :openid,
         wechat_unionid = :unionid
     WHERE id = :id`,
    { openid, unionid, id: userId },
  );
}

export function isPasswordSet(passwordHash: string | null | undefined): boolean {
  return typeof passwordHash === "string" && passwordHash.length > 0;
}
