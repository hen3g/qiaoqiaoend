import type { RowDataPacket } from "mysql2";
import {
  getSessionTokenFromRequest,
  readSessionUserId,
} from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { todayInShanghai } from "@/lib/notification-stats";
import { readAccessToken } from "@/lib/oauth";

export type VisitPlatform = "ios" | "android";

export type DailyVisitStatDto = {
  date: string;
  anonymous: number;
  ios: number;
  android: number;
  registrations: number;
};

let ensured = false;

export async function ensureDeviceVisitTables(): Promise<void> {
  if (ensured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS device_visit_daily_anonymous (
      stat_date DATE NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (stat_date, device_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS device_visit_daily_users (
      stat_date DATE NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      platform VARCHAR(16) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (stat_date, user_id),
      KEY idx_device_visit_user (user_id),
      KEY idx_device_visit_platform (stat_date, platform)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ensured = true;
}

/** Session JWT Bearer (app) or OAuth access token; cookie fallback. */
export async function resolveVisitUserId(req: Request): Promise<number | null> {
  const token = await getSessionTokenFromRequest(req);
  if (token) {
    const sessionUid = await readSessionUserId(token);
    if (sessionUid != null) return sessionUid;
    const access = await readAccessToken(token);
    if (access) return access.userId;
  }
  return null;
}

export async function recordAnonymousVisit(deviceId: string): Promise<void> {
  await ensureDeviceVisitTables();
  const statDate = todayInShanghai();
  await execute(
    `INSERT IGNORE INTO device_visit_daily_anonymous (stat_date, device_id)
     VALUES (:statDate, :deviceId)`,
    { statDate, deviceId },
  );
}

export async function recordLoggedInVisit(
  userId: number,
  platform: VisitPlatform,
): Promise<void> {
  await ensureDeviceVisitTables();
  const statDate = todayInShanghai();
  await execute(
    `INSERT INTO device_visit_daily_users (stat_date, user_id, platform)
     VALUES (:statDate, :userId, :platform)
     ON DUPLICATE KEY UPDATE platform = VALUES(platform)`,
    { statDate, userId, platform },
  );
}

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

type VisitAggRow = RowDataPacket & {
  stat_date: Date | string;
  anonymous_count: number;
  ios_count: number;
  android_count: number;
};

type RegRow = RowDataPacket & {
  stat_date: Date | string;
  registrations: number;
};

export async function countRegistrationsOn(statDate: string): Promise<number> {
  const rows = await query<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt FROM users
     WHERE created_at >= :statDate
       AND created_at < DATE_ADD(:statDate, INTERVAL 1 DAY)`,
    { statDate },
  );
  return Number(rows[0]?.cnt) || 0;
}

export async function getVisitStatsForDate(
  statDate: string,
): Promise<DailyVisitStatDto> {
  await ensureDeviceVisitTables();

  const anonRows = await query<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt FROM device_visit_daily_anonymous
     WHERE stat_date = :statDate`,
    { statDate },
  );
  const platformRows = await query<
    (RowDataPacket & { platform: string; cnt: number })[]
  >(
    `SELECT platform, COUNT(*) AS cnt FROM device_visit_daily_users
     WHERE stat_date = :statDate
     GROUP BY platform`,
    { statDate },
  );

  let ios = 0;
  let android = 0;
  for (const row of platformRows) {
    if (row.platform === "ios") ios = Number(row.cnt) || 0;
    if (row.platform === "android") android = Number(row.cnt) || 0;
  }

  return {
    date: statDate,
    anonymous: Number(anonRows[0]?.cnt) || 0,
    ios,
    android,
    registrations: await countRegistrationsOn(statDate),
  };
}

export async function listDailyVisitStats(
  days = 30,
): Promise<DailyVisitStatDto[]> {
  await ensureDeviceVisitTables();
  const safeDays = Math.min(Math.max(Math.floor(days), 1), 365);

  const visitRows = await query<VisitAggRow[]>(
    `SELECT d.stat_date,
            COALESCE(a.anonymous_count, 0) AS anonymous_count,
            COALESCE(i.ios_count, 0) AS ios_count,
            COALESCE(n.android_count, 0) AS android_count
     FROM (
       SELECT stat_date FROM device_visit_daily_anonymous
       WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
       UNION
       SELECT stat_date FROM device_visit_daily_users
       WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
     ) d
     LEFT JOIN (
       SELECT stat_date, COUNT(*) AS anonymous_count
       FROM device_visit_daily_anonymous
       GROUP BY stat_date
     ) a ON a.stat_date = d.stat_date
     LEFT JOIN (
       SELECT stat_date, COUNT(*) AS ios_count
       FROM device_visit_daily_users
       WHERE platform = 'ios'
       GROUP BY stat_date
     ) i ON i.stat_date = d.stat_date
     LEFT JOIN (
       SELECT stat_date, COUNT(*) AS android_count
       FROM device_visit_daily_users
       WHERE platform = 'android'
       GROUP BY stat_date
     ) n ON n.stat_date = d.stat_date
     ORDER BY d.stat_date DESC`,
    { days: safeDays },
  );

  const regRows = await query<RegRow[]>(
    `SELECT DATE(created_at) AS stat_date, COUNT(*) AS registrations
     FROM users
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
     GROUP BY DATE(created_at)
     ORDER BY stat_date DESC`,
    { days: safeDays },
  );

  const regMap = new Map<string, number>();
  for (const row of regRows) {
    regMap.set(formatDate(row.stat_date), Number(row.registrations) || 0);
  }

  const byDate = new Map<string, DailyVisitStatDto>();
  for (const row of visitRows) {
    const date = formatDate(row.stat_date);
    byDate.set(date, {
      date,
      anonymous: Number(row.anonymous_count) || 0,
      ios: Number(row.ios_count) || 0,
      android: Number(row.android_count) || 0,
      registrations: regMap.get(date) ?? 0,
    });
  }

  // Include days that only have registrations
  for (const [date, registrations] of regMap) {
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        anonymous: 0,
        ios: 0,
        android: 0,
        registrations,
      });
    }
  }

  // Always include today
  const today = todayInShanghai();
  if (!byDate.has(today)) {
    byDate.set(today, {
      date: today,
      anonymous: 0,
      ios: 0,
      android: 0,
      registrations: regMap.get(today) ?? 0,
    });
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}
