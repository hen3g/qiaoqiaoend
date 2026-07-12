import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";

export const SESSION_COOKIE = "be_session";
const SESSION_DAYS = 14;

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
  vipExpiresAt: string | null;
  isVip: boolean;
  isPermanentVip: boolean;
  createdAt: string | null;
};

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  vip_expires_at: Date | string | null;
  created_at: Date | string | null;
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
    vipExpiresAt,
    isVip,
    isPermanentVip,
    createdAt: toIso(row.created_at),
  };
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
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
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await readSessionUserId(token);
  if (!userId) return null;

  const rows = await query<UserRow[]>(
    `SELECT id, username, nickname, vip_expires_at, created_at
     FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  if (!rows[0]) return null;
  return mapUser(rows[0]);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
