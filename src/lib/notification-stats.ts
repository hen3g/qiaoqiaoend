import type { RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionUserId } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { readAccessToken } from "@/lib/oauth";

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
};

let ensured = false;

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
      hit_count INT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (stat_date, user_id),
      KEY idx_notif_api_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ensured = true;
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
      `INSERT INTO notification_api_daily_users (stat_date, user_id, hit_count)
       VALUES (:statDate, :userId, 1)
       ON DUPLICATE KEY UPDATE hit_count = hit_count + 1`,
      { statDate, userId },
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
       SELECT stat_date, COUNT(*) AS unique_users
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
  username: string | null;
  nickname: string | null;
};

export async function listDailyNotificationUsers(
  statDate: string,
  limit = 100,
): Promise<DailyUserHitDto[]> {
  await ensureNotificationStatsTables();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);

  const rows = await query<UserHitRow[]>(
    `SELECT d.user_id, d.hit_count, u.username, u.nickname
     FROM notification_api_daily_users d
     LEFT JOIN users u ON u.id = d.user_id
     WHERE d.stat_date = :statDate
     ORDER BY d.hit_count DESC, d.user_id ASC
     LIMIT ${safeLimit}`,
    { statDate },
  );

  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username ?? null,
    nickname: row.nickname ?? null,
    hitCount: Number(row.hit_count) || 0,
  }));
}
