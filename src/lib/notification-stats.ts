import type { RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionUserId } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { readAccessToken } from "@/lib/oauth";

/** client = 桌面/原生客户端；web = 在线版。缺省按 client（兼容旧客户端）。 */
export type NotificationClientSource = "client" | "web";

export type DailyStatDto = {
  date: string;
  totalHits: number;
  loggedInHits: number;
  uniqueUsers: number;
};

export type DailyUserHitDto = {
  userId: number;
  username: string | null;
  nickname: string | null;
  hitCount: number;
  sources: NotificationClientSource[];
};

let ensured = false;

export function parseNotificationClientSource(
  value: string | null,
): NotificationClientSource {
  if (value === "web") return "web";
  return "client";
}

export async function ensureNotificationStatsTables(): Promise<void> {
  if (ensured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS notification_api_daily_stats (
      stat_date DATE NOT NULL,
      total_hits BIGINT UNSIGNED NOT NULL DEFAULT 0,
      logged_in_hits BIGINT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (stat_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS notification_api_daily_users (
      stat_date DATE NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      source VARCHAR(16) NOT NULL DEFAULT 'client',
      hit_count INT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (stat_date, user_id, source),
      KEY idx_notif_api_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await migrateNotificationUsersSourceColumn();
  ensured = true;
}

/** 旧表只有 (stat_date, user_id) 主键时，补 source 列并升级主键。 */
async function migrateNotificationUsersSourceColumn(): Promise<void> {
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM notification_api_daily_users LIKE 'source'`,
  );
  if (cols.length > 0) return;

  await execute(
    `ALTER TABLE notification_api_daily_users
     ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'client' AFTER user_id`,
  );
  await execute(
    `ALTER TABLE notification_api_daily_users
     DROP PRIMARY KEY,
     ADD PRIMARY KEY (stat_date, user_id, source)`,
  );
}

/** YYYY-MM-DD in Asia/Shanghai (matches DB timezone +08:00). */
export function todayInShanghai(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Resolve caller user id for stats: OAuth Bearer first, then session cookie.
 * Does not hit the users table (JWT only).
 */
export async function resolveStatsUserId(req: Request): Promise<number | null> {
  const header = req.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) {
    const access = await readAccessToken(match[1]!.trim());
    if (access) return access.userId;
  }

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionUserId(token);
}

/** Record one notification API hit. Safe to call fire-and-forget. */
export async function recordNotificationApiHit(
  userId: number | null,
  source: NotificationClientSource = "client",
): Promise<void> {
  await ensureNotificationStatsTables();
  const statDate = todayInShanghai();
  const loggedIn = userId != null ? 1 : 0;

  await execute(
    `INSERT INTO notification_api_daily_stats (stat_date, total_hits, logged_in_hits)
     VALUES (:statDate, 1, :loggedIn)
     ON DUPLICATE KEY UPDATE
       total_hits = total_hits + 1,
       logged_in_hits = logged_in_hits + :loggedIn`,
    { statDate, loggedIn },
  );

  if (userId != null) {
    await execute(
      `INSERT INTO notification_api_daily_users (stat_date, user_id, source, hit_count)
       VALUES (:statDate, :userId, :source, 1)
       ON DUPLICATE KEY UPDATE hit_count = hit_count + 1`,
      { statDate, userId, source },
    );
  }
}

type DailyRow = RowDataPacket & {
  stat_date: Date | string;
  total_hits: number;
  logged_in_hits: number;
  unique_users: number;
};

function formatDate(value: Date | string): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  }
  return String(value).slice(0, 10);
}

export async function listDailyNotificationStats(
  days = 30,
): Promise<DailyStatDto[]> {
  await ensureNotificationStatsTables();
  const safeDays = Math.min(Math.max(Math.floor(days), 1), 365);

  const rows = await query<DailyRow[]>(
    `SELECT s.stat_date,
            s.total_hits,
            s.logged_in_hits,
            COALESCE(u.unique_users, 0) AS unique_users
     FROM notification_api_daily_stats s
     LEFT JOIN (
       SELECT stat_date, COUNT(DISTINCT user_id) AS unique_users
       FROM notification_api_daily_users
       GROUP BY stat_date
     ) u ON u.stat_date = s.stat_date
     WHERE s.stat_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
     ORDER BY s.stat_date DESC`,
    { days: safeDays },
  );

  return rows.map((row) => ({
    date: formatDate(row.stat_date),
    totalHits: Number(row.total_hits) || 0,
    loggedInHits: Number(row.logged_in_hits) || 0,
    uniqueUsers: Number(row.unique_users) || 0,
  }));
}

type UserHitRow = RowDataPacket & {
  user_id: number;
  hit_count: number;
  sources: string | null;
  username: string | null;
  nickname: string | null;
};

function parseSources(value: string | null): NotificationClientSource[] {
  if (!value) return [];
  const set = new Set<NotificationClientSource>();
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (trimmed === "web" || trimmed === "client") set.add(trimmed);
  }
  return [...set];
}

export async function listDailyNotificationUsers(
  statDate: string,
  limit = 100,
): Promise<DailyUserHitDto[]> {
  await ensureNotificationStatsTables();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);

  const rows = await query<UserHitRow[]>(
    `SELECT d.user_id,
            SUM(d.hit_count) AS hit_count,
            GROUP_CONCAT(DISTINCT d.source ORDER BY d.source) AS sources,
            u.username,
            u.nickname
     FROM notification_api_daily_users d
     LEFT JOIN users u ON u.id = d.user_id
     WHERE d.stat_date = :statDate
     GROUP BY d.user_id, u.username, u.nickname
     ORDER BY hit_count DESC, d.user_id ASC
     LIMIT ${safeLimit}`,
    { statDate },
  );

  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username ?? null,
    nickname: row.nickname ?? null,
    hitCount: Number(row.hit_count) || 0,
    sources: parseSources(row.sources),
  }));
}
