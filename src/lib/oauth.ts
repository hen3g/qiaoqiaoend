import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";
import {
  getUserTokenVersion,
  mapUser,
  type SessionUser,
} from "@/lib/auth";

const AUTH_CODE_TTL = "5m";
const ACCESS_TOKEN_DAYS = 14;

export type OAuthClient = {
  clientId: string;
  redirectUris: string[];
  displayName: string;
};

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  vip_expires_at: Date | string | null;
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

export function getOAuthClient(): OAuthClient {
  const clientId = process.env.OAUTH_CLIENT_ID?.trim();
  const redirectUris = (process.env.OAUTH_REDIRECT_URIS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  if (!clientId || redirectUris.length === 0) {
    throw new Error("OAUTH_CLIENT_ID / OAUTH_REDIRECT_URIS is not configured");
  }

  return {
    clientId,
    redirectUris,
    displayName: process.env.OAUTH_CLIENT_DISPLAY_NAME?.trim() || "宝贝英语",
  };
}

export function getAllowedCorsOrigins(): string[] {
  try {
    const { redirectUris } = getOAuthClient();
    const origins = new Set<string>();
    for (const uri of redirectUris) {
      try {
        origins.add(new URL(uri).origin);
      } catch {
        // skip invalid
      }
    }
    return [...origins];
  } catch {
    return [];
  }
}

export function findClient(clientId: string): OAuthClient | null {
  try {
    const client = getOAuthClient();
    if (client.clientId !== clientId) return null;
    return client;
  } catch {
    return null;
  }
}

export function isAllowedRedirectUri(
  client: OAuthClient,
  redirectUri: string,
): boolean {
  return client.redirectUris.includes(redirectUri);
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string) {
  const hash = createHash("sha256").update(codeVerifier).digest();
  const computed = hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return computed === codeChallenge;
}

export async function createAuthorizationCode(input: {
  userId: number;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}): Promise<string> {
  return new SignJWT({
    typ: "oauth_code",
    uid: input.userId,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(AUTH_CODE_TTL)
    .setJti(randomBytes(16).toString("hex"))
    .sign(getSecret());
}

export type AuthCodePayload = {
  uid: number;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
};

export async function verifyAuthorizationCode(
  code: string,
): Promise<AuthCodePayload | null> {
  try {
    const { payload } = await jwtVerify(code, getSecret());
    if (payload.typ !== "oauth_code") return null;
    const uid = payload.uid;
    const clientId = payload.client_id;
    const redirectUri = payload.redirect_uri;
    const codeChallenge = payload.code_challenge;
    const method = payload.code_challenge_method;
    if (
      typeof uid !== "number" ||
      typeof clientId !== "string" ||
      typeof redirectUri !== "string" ||
      typeof codeChallenge !== "string" ||
      method !== "S256"
    ) {
      return null;
    }
    return {
      uid,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: "S256",
    };
  } catch {
    return null;
  }
}

export async function createAccessToken(input: {
  userId: number;
  clientId: string;
  tokenVersion?: number;
}): Promise<string> {
  const tv =
    typeof input.tokenVersion === "number"
      ? input.tokenVersion
      : await getUserTokenVersion(input.userId);
  return new SignJWT({
    typ: "oauth_access",
    uid: input.userId,
    client_id: input.clientId,
    tv,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_DAYS}d`)
    .sign(getSecret());
}

export type AccessTokenPayload = {
  userId: number;
  clientId: string;
  tokenVersion: number;
};

export async function readAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "oauth_access") return null;
    const userId = payload.uid;
    const clientId = payload.client_id;
    if (typeof userId !== "number" || typeof clientId !== "string") {
      return null;
    }
    return {
      userId,
      clientId,
      tokenVersion: typeof payload.tv === "number" ? payload.tv : 0,
    };
  } catch {
    return null;
  }
}

/** @deprecated Prefer readAccessToken + token_version check */
export async function readAccessTokenUserId(
  token: string,
): Promise<number | null> {
  const access = await readAccessToken(token);
  return access?.userId ?? null;
}

export async function getUserById(userId: number): Promise<SessionUser | null> {
  const rows = await query<UserRow[]>(
    `SELECT id, username, nickname, vip_expires_at, created_at, token_version
     FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  if (!rows[0]) return null;
  return mapUser(rows[0]);
}

export async function getUserByIdIfTokenVersion(
  userId: number,
  tokenVersion: number,
): Promise<SessionUser | null> {
  const rows = await query<UserRow[]>(
    `SELECT id, username, nickname, vip_expires_at, created_at, token_version
     FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  const row = rows[0];
  if (!row) return null;
  if ((row.token_version ?? 0) !== tokenVersion) return null;
  return mapUser(row);
}

export function describeScope(scope: string): string[] {
  const parts = scope
    .split(/[\s+]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const labels: Record<string, string> = {
    profile: "读取你的用户名与昵称",
    vip: "读取你的会员状态",
  };
  if (parts.length === 0) {
    return ["读取基本账号信息"];
  }
  return parts.map((p) => labels[p] || p);
}

/** Only allow same-origin relative paths for post-login redirects. */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  // Reject absolute URLs in the path segment only — query values may
  // legitimately include redirect_uri=http://... for OAuth resume.
  const pathOnly = next.split("?")[0] ?? next;
  if (pathOnly.includes("://")) return null;
  return next;
}
