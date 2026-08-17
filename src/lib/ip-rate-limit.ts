import "server-only";
import type { RowDataPacket } from "mysql2";
import { jsonError } from "@/lib/api";
import { execute, query } from "@/lib/db";

/** Default window: 1 minute. */
export const IP_RATE_WINDOW_MS = 60_000;
export const IP_RATE_HOUR_MS = 60 * 60 * 1000;
export const IP_RATE_DAY_MS = 24 * 60 * 60 * 1000;

export type IpRateCheck = {
  action: string;
  max?: number;
  windowMs?: number;
};

let ensured = false;

async function ensureIpRateLimitTable(): Promise<void> {
  if (ensured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS ip_rate_limits (
      action VARCHAR(64) NOT NULL,
      ip VARCHAR(64) NOT NULL,
      last_called_at BIGINT NOT NULL,
      hit_count INT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (action, ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM ip_rate_limits LIKE 'hit_count'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE ip_rate_limits
       ADD COLUMN hit_count INT UNSIGNED NOT NULL DEFAULT 1`,
    );
  }

  ensured = true;
}

function lastForwardedIp(value: string | null): string | null {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  // nginx `proxy_add_x_forwarded_for` appends $remote_addr last.
  return parts[parts.length - 1] ?? null;
}

function normalizeIp(raw: string): string {
  let ip = raw.trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  ip = ip.slice(0, 64);
  return ip || "unknown";
}

export function getClientIp(req: Request): string {
  const headers = req.headers;
  const raw =
    headers.get("cf-connecting-ip") ||
    headers.get("true-client-ip") ||
    headers.get("x-real-ip") ||
    lastForwardedIp(headers.get("x-forwarded-for")) ||
    ("ip" in req && typeof (req as { ip?: unknown }).ip === "string"
      ? (req as { ip: string }).ip
      : null) ||
    "unknown";
  return normalizeIp(raw);
}

export async function consumeIpRateLimit(
  req: Request,
  action: string,
  options?: { windowMs?: number; max?: number },
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  await ensureIpRateLimitTable();
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = options?.windowMs ?? IP_RATE_WINDOW_MS;
  const maxHits = Math.max(1, options?.max ?? 1);
  const cutoff = now - windowMs;

  const result = await execute(
    `INSERT INTO ip_rate_limits (action, ip, last_called_at, hit_count)
     VALUES (:action, :ip, :now, 1)
     ON DUPLICATE KEY UPDATE
       hit_count = IF(
         last_called_at <= :cutoff,
         1,
         IF(hit_count < :maxHits, hit_count + 1, hit_count)
       ),
       last_called_at = IF(last_called_at <= :cutoff, :now, last_called_at)`,
    { action, ip, now, cutoff, maxHits },
  );

  if (result.affectedRows > 0) return { ok: true };

  const rows = await query<
    (RowDataPacket & { last_called_at: number | string })[]
  >(
    `SELECT last_called_at FROM ip_rate_limits
     WHERE action = :action AND ip = :ip
     LIMIT 1`,
    { action, ip },
  );
  const last = Number(rows[0]?.last_called_at ?? now);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((last + windowMs - Date.now()) / 1000),
  );
  return { ok: false, retryAfterSeconds };
}

/** Check without incrementing — use with consumeIpRateLimit on failures only. */
export async function peekIpRateLimit(
  req: Request,
  action: string,
  options?: { windowMs?: number; max?: number },
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  await ensureIpRateLimitTable();
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = options?.windowMs ?? IP_RATE_WINDOW_MS;
  const maxHits = Math.max(1, options?.max ?? 1);
  const cutoff = now - windowMs;

  const rows = await query<
    (RowDataPacket & {
      last_called_at: number | string;
      hit_count: number | string;
    })[]
  >(
    `SELECT last_called_at, hit_count FROM ip_rate_limits
     WHERE action = :action AND ip = :ip
     LIMIT 1`,
    { action, ip },
  );
  const row = rows[0];
  if (!row) return { ok: true };

  const last = Number(row.last_called_at);
  const hits = Number(row.hit_count);
  if (!Number.isFinite(last) || last <= cutoff) return { ok: true };
  if (!Number.isFinite(hits) || hits < maxHits) return { ok: true };

  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((last + windowMs - now) / 1000)),
  };
}

function rateLimitResponse(retryAfterSeconds: number) {
  const res = jsonError(
    `请求过于频繁，请 ${retryAfterSeconds} 秒后再试`,
    429,
    { retryAfterSeconds },
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}

/** Returns a 429 response if this IP exceeded `max` calls for `action` in the window. */
export async function ipRateLimited(
  req: Request,
  action: string,
  options?: { windowMs?: number; max?: number },
) {
  const result = await consumeIpRateLimit(req, action, options);
  if (result.ok) return null;
  return rateLimitResponse(result.retryAfterSeconds);
}

/** 429 if already over the limit, without consuming a slot. */
export async function ipRateLimitedPeek(
  req: Request,
  action: string,
  options?: { windowMs?: number; max?: number },
) {
  const result = await peekIpRateLimit(req, action, options);
  if (result.ok) return null;
  return rateLimitResponse(result.retryAfterSeconds);
}

/** Apply several IP limits; stop at the first 429. */
export async function ipRateLimitedAll(req: Request, checks: IpRateCheck[]) {
  for (const { action, ...options } of checks) {
    const res = await ipRateLimited(req, action, options);
    if (res) return res;
  }
  return null;
}

/** Peek several limits without consuming. */
export async function ipRateLimitedPeekAll(
  req: Request,
  checks: IpRateCheck[],
) {
  for (const { action, ...options } of checks) {
    const res = await ipRateLimitedPeek(req, action, options);
    if (res) return res;
  }
  return null;
}

/** Consume several limits; 429 if any window is already full. */
export async function consumeIpRateLimitAll(
  req: Request,
  checks: IpRateCheck[],
) {
  for (const { action, ...options } of checks) {
    const result = await consumeIpRateLimit(req, action, options);
    if (!result.ok) return rateLimitResponse(result.retryAfterSeconds);
  }
  return null;
}
