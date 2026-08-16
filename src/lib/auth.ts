import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserEmailColumn,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";

export const SESSION_COOKIE = "be_session";
const SESSION_DAYS = 365;

/** Far-future sentinel used for permanent VIP. */
export const PERMANENT_VIP_SQL = "9999-12-31 23:59:59";

export function isPermanentVipExpiry(vipExpiresAt: string | null): boolean {
  if (!vipExpiresAt) return false;
  return new Date(vipExpiresAt).getFullYear() >= 9999;
}

export type SessionUser = {
  id: number;
  username: string;
  nickname: string | null;
  email: string | null;
  avatarUrl: string | null;
  vipExpiresAt: string | null;
  isVip: boolean;
  isPermanentVip: boolean;
  /** Diamonds for custom-course usage; stackable via membership purchases. */
  diamonds: number;
  /** Whether the user's ready custom courses appear in 课程广场. Default true. */
  shareCustomCourses: boolean;
  /** Admin-granted promoter; can create 推广卡片 redeem codes. */
  isPromoter: boolean;
  /** Bound promoter user id (set when redeeming a promoter code). */
  promoterId: number | null;
  createdAt: string | null;
};

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  email?: string | null;
  avatar_url?: string | null;
  vip_expires_at: Date | string | null;
  diamonds?: number | null;
  share_custom_courses?: number | boolean | null;
  is_promoter?: number | boolean | null;
  promoter_id?: number | null;
  created_at: Date | string | null;
  token_version?: number;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapUser(row: UserRow): SessionUser {
  const vipExpiresAt = toIso(row.vip_expires_at);
  const isPermanentVip = isPermanentVipExpiry(vipExpiresAt);
  const isVip = Boolean(
    isPermanentVip ||
      (vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now()),
  );
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    email:
      typeof row.email === "string" && row.email.trim()
        ? row.email.trim()
        : null,
    avatarUrl:
      typeof row.avatar_url === "string" && row.avatar_url.trim()
        ? row.avatar_url.trim()
        : null,
    vipExpiresAt,
    isVip,
    isPermanentVip,
    diamonds: Math.max(0, Number(row.diamonds ?? 0) || 0),
    shareCustomCourses:
      row.share_custom_courses === undefined ||
      row.share_custom_courses === null
        ? true
        : Boolean(row.share_custom_courses),
    isPromoter: Boolean(row.is_promoter),
    promoterId:
      row.promoter_id == null || Number(row.promoter_id) < 1
        ? null
        : Number(row.promoter_id),
    createdAt: toIso(row.created_at),
  };
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function getUserTokenVersion(userId: number): Promise<number> {
  const rows = await query<(RowDataPacket & { token_version: number })[]>(
    `SELECT token_version FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  return rows[0]?.token_version ?? 0;
}

export async function bumpUserTokenVersion(userId: number): Promise<void> {
  await execute(
    `UPDATE users SET token_version = token_version + 1 WHERE id = :id`,
    { id: userId },
  );
}

export async function createSessionToken(
  userId: number,
  tokenVersion?: number,
): Promise<string> {
  const tv =
    typeof tokenVersion === "number"
      ? tokenVersion
      : await getUserTokenVersion(userId);
  return new SignJWT({ uid: userId, tv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function readSessionUserId(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const uid = payload.uid;
    return typeof uid === "number" ? uid : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = cookies();
  jar.set(SESSION_COOKIE, token, {
    ...cookieBase(),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = cookies();
  jar.set(SESSION_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
}

/** Session JWT from Authorization Bearer, or website cookie. */
export async function getSessionTokenFromRequest(
  req?: Request,
): Promise<string | null> {
  if (req) {
    const header = req.headers.get("Authorization") || "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (match?.[1]) return match[1].trim();
  }
  const jar = cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(
  req?: Request,
): Promise<SessionUser | null> {
  const token = await getSessionTokenFromRequest(req);
  if (!token) return null;

  let userId: number | null = null;
  let tokenVersion = 0;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Reject OAuth access tokens — they belong to /api/oauth/userinfo
    if (payload.typ === "oauth_access" || payload.typ === "oauth_code") {
      return null;
    }
    userId = typeof payload.uid === "number" ? payload.uid : null;
    tokenVersion = typeof payload.tv === "number" ? payload.tv : 0;
  } catch {
    return null;
  }
  if (!userId) return null;

  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();
  await ensureUserEmailColumn();

  const rows = await query<UserRow[]>(
    `SELECT id, username, nickname, email, avatar_url, vip_expires_at, diamonds,
            share_custom_courses, is_promoter, promoter_id, created_at,
            token_version
     FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  const row = rows[0];
  if (!row) return null;
  if ((row.token_version ?? 0) !== tokenVersion) return null;
  return mapUser(row);
}

export async function getSessionUserById(
  userId: number,
): Promise<SessionUser | null> {
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();
  await ensureUserEmailColumn();
  const rows = await query<UserRow[]>(
    `SELECT id, username, nickname, email, avatar_url, vip_expires_at, diamonds,
            share_custom_courses, is_promoter, promoter_id, created_at
     FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  const row = rows[0];
  return row ? mapUser(row) : null;
}

export async function requireUser(req?: Request): Promise<SessionUser> {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
