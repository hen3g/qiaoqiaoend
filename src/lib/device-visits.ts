import type { RowDataPacket } from "mysql2";
import {
  getSessionTokenFromRequest,
  readSessionUserId,
} from "@/lib/auth";
import type { ClientAppFilter, ClientAppId } from "@/lib/client-app";
import { execute, query } from "@/lib/db";
import { todayInShanghai } from "@/lib/notification-stats";
import { readAccessToken } from "@/lib/oauth";
import { ensureUserAppColumns, ensureUserRegisterPlatformColumn } from "@/lib/user-schema";

export type VisitPlatform = "ios" | "android";

export type DailyVisitStatDto = {
  date: string;
  anonymous: number;
  ios: number;
  android: number;
  registrations: number;
  registrationsIos: number;
  registrationsAndroid: number;
};

let ensured = false;

async function tableHasColumn(
  table: "device_visit_daily_anonymous" | "device_visit_daily_users",
  column: string,
): Promise<boolean> {
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM ${table} LIKE '${column}'`,
  );
  return cols.length > 0;
}

async function primaryIncludesAppId(
  table: "device_visit_daily_anonymous" | "device_visit_daily_users",
): Promise<boolean> {
  type IndexRow = RowDataPacket & { Column_name: string; Key_name: string };
  const indexes = await query<IndexRow[]>(`SHOW INDEX FROM ${table}`);
  return indexes.some(
    (row) => row.Key_name === "PRIMARY" && row.Column_name === "app_id",
  );
}

export async function ensureDeviceVisitTables(): Promise<void> {
  if (ensured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS device_visit_daily_anonymous (
      stat_date DATE NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      app_id VARCHAR(32) NOT NULL DEFAULT 'qiaoqiao',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (stat_date, device_id, app_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS device_visit_daily_users (
      stat_date DATE NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      app_id VARCHAR(32) NOT NULL DEFAULT 'qiaoqiao',
      platform VARCHAR(16) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (stat_date, user_id, app_id),
      KEY idx_device_visit_user (user_id),
      KEY idx_device_visit_platform (stat_date, platform)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (!(await tableHasColumn("device_visit_daily_anonymous", "app_id"))) {
    await execute(
      `ALTER TABLE device_visit_daily_anonymous
       ADD COLUMN app_id VARCHAR(32) NOT NULL DEFAULT 'qiaoqiao' AFTER device_id`,
    );
  }
  if (!(await primaryIncludesAppId("device_visit_daily_anonymous"))) {
    await execute(
      `ALTER TABLE device_visit_daily_anonymous
       DROP PRIMARY KEY,
       ADD PRIMARY KEY (stat_date, device_id, app_id)`,
    );
  }

  if (!(await tableHasColumn("device_visit_daily_users", "app_id"))) {
    await execute(
      `ALTER TABLE device_visit_daily_users
       ADD COLUMN app_id VARCHAR(32) NOT NULL DEFAULT 'qiaoqiao' AFTER user_id`,
    );
  }
  if (!(await primaryIncludesAppId("device_visit_daily_users"))) {
    await execute(
      `ALTER TABLE device_visit_daily_users
       DROP PRIMARY KEY,
       ADD PRIMARY KEY (stat_date, user_id, app_id)`,
    );
  }

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

export async function recordAnonymousVisit(
  deviceId: string,
  appId: ClientAppId,
): Promise<void> {
  await ensureDeviceVisitTables();
  const statDate = todayInShanghai();
  await execute(
    `INSERT IGNORE INTO device_visit_daily_anonymous (stat_date, device_id, app_id)
     VALUES (:statDate, :deviceId, :appId)`,
    { statDate, deviceId, appId },
  );
}

export async function recordLoggedInVisit(
  userId: number,
  platform: VisitPlatform,
  appId: ClientAppId,
): Promise<void> {
  await ensureDeviceVisitTables();
  const statDate = todayInShanghai();
  await execute(
    `INSERT INTO device_visit_daily_users (stat_date, user_id, app_id, platform)
     VALUES (:statDate, :userId, :appId, :platform)
     ON DUPLICATE KEY UPDATE platform = VALUES(platform)`,
    { statDate, userId, appId, platform },
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
  registrations_ios: number;
  registrations_android: number;
};

function appWhere(app: ClientAppFilter, column = "app_id"): string {
  if (app === "all") return "1=1";
  return `${column} = :appId`;
}

function appParams(app: ClientAppFilter): { appId?: ClientAppId } {
  return app === "all" ? {} : { appId: app };
}

export async function countRegistrationsOn(
  statDate: string,
  app: ClientAppFilter = "all",
): Promise<{
  total: number;
  ios: number;
  android: number;
}> {
  await ensureUserAppColumns();
  await ensureUserRegisterPlatformColumn();
  const rows = await query<
    (RowDataPacket & {
      total: number;
      ios: number;
      android: number;
    })[]
  >(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN register_platform = 'ios' THEN 1 ELSE 0 END) AS ios,
            SUM(CASE WHEN register_platform = 'android' THEN 1 ELSE 0 END) AS android
     FROM users
     WHERE created_at >= :statDate
       AND created_at < DATE_ADD(:statDate, INTERVAL 1 DAY)
       AND ${appWhere(app, "register_app_id")}`,
    { statDate, ...appParams(app) },
  );
  return {
    total: Number(rows[0]?.total) || 0,
    ios: Number(rows[0]?.ios) || 0,
    android: Number(rows[0]?.android) || 0,
  };
}

export async function getVisitStatsForDate(
  statDate: string,
  app: ClientAppFilter = "all",
): Promise<DailyVisitStatDto> {
  await ensureDeviceVisitTables();
  const extra = appParams(app);

  const anonRows = await query<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(DISTINCT device_id) AS cnt FROM device_visit_daily_anonymous
     WHERE stat_date = :statDate AND ${appWhere(app)}`,
    { statDate, ...extra },
  );
  const platformRows = await query<
    (RowDataPacket & { platform: string; cnt: number })[]
  >(
    `SELECT platform, COUNT(DISTINCT user_id) AS cnt FROM device_visit_daily_users
     WHERE stat_date = :statDate AND ${appWhere(app)}
     GROUP BY platform`,
    { statDate, ...extra },
  );

  let ios = 0;
  let android = 0;
  for (const row of platformRows) {
    if (row.platform === "ios") ios = Number(row.cnt) || 0;
    if (row.platform === "android") android = Number(row.cnt) || 0;
  }

  const regs = await countRegistrationsOn(statDate, app);
  return {
    date: statDate,
    anonymous: Number(anonRows[0]?.cnt) || 0,
    ios,
    android,
    registrations: regs.total,
    registrationsIos: regs.ios,
    registrationsAndroid: regs.android,
  };
}

export async function listDailyVisitStats(
  days = 30,
  app: ClientAppFilter = "all",
): Promise<DailyVisitStatDto[]> {
  await ensureDeviceVisitTables();
  await ensureUserAppColumns();
  await ensureUserRegisterPlatformColumn();
  const safeDays = Math.min(Math.max(Math.floor(days), 1), 365);
  const extra = appParams(app);

  const visitRows = await query<VisitAggRow[]>(
    `SELECT d.stat_date,
            COALESCE(a.anonymous_count, 0) AS anonymous_count,
            COALESCE(i.ios_count, 0) AS ios_count,
            COALESCE(n.android_count, 0) AS android_count
     FROM (
       SELECT stat_date FROM device_visit_daily_anonymous
       WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
         AND ${appWhere(app)}
       UNION
       SELECT stat_date FROM device_visit_daily_users
       WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
         AND ${appWhere(app)}
     ) d
     LEFT JOIN (
       SELECT stat_date, COUNT(DISTINCT device_id) AS anonymous_count
       FROM device_visit_daily_anonymous
       WHERE ${appWhere(app)}
       GROUP BY stat_date
     ) a ON a.stat_date = d.stat_date
     LEFT JOIN (
       SELECT stat_date, COUNT(DISTINCT user_id) AS ios_count
       FROM device_visit_daily_users
       WHERE platform = 'ios' AND ${appWhere(app)}
       GROUP BY stat_date
     ) i ON i.stat_date = d.stat_date
     LEFT JOIN (
       SELECT stat_date, COUNT(DISTINCT user_id) AS android_count
       FROM device_visit_daily_users
       WHERE platform = 'android' AND ${appWhere(app)}
       GROUP BY stat_date
     ) n ON n.stat_date = d.stat_date
     ORDER BY d.stat_date DESC`,
    { days: safeDays, ...extra },
  );

  const regRows = await query<RegRow[]>(
    `SELECT DATE(created_at) AS stat_date,
            COUNT(*) AS registrations,
            SUM(CASE WHEN register_platform = 'ios' THEN 1 ELSE 0 END) AS registrations_ios,
            SUM(CASE WHEN register_platform = 'android' THEN 1 ELSE 0 END) AS registrations_android
     FROM users
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
       AND ${appWhere(app, "register_app_id")}
     GROUP BY DATE(created_at)
     ORDER BY stat_date DESC`,
    { days: safeDays, ...extra },
  );

  type RegCounts = {
    total: number;
    ios: number;
    android: number;
  };
  const emptyRegs = (): RegCounts => ({ total: 0, ios: 0, android: 0 });
  const regMap = new Map<string, RegCounts>();
  for (const row of regRows) {
    regMap.set(formatDate(row.stat_date), {
      total: Number(row.registrations) || 0,
      ios: Number(row.registrations_ios) || 0,
      android: Number(row.registrations_android) || 0,
    });
  }

  const byDate = new Map<string, DailyVisitStatDto>();
  for (const row of visitRows) {
    const date = formatDate(row.stat_date);
    const regs = regMap.get(date) ?? emptyRegs();
    byDate.set(date, {
      date,
      anonymous: Number(row.anonymous_count) || 0,
      ios: Number(row.ios_count) || 0,
      android: Number(row.android_count) || 0,
      registrations: regs.total,
      registrationsIos: regs.ios,
      registrationsAndroid: regs.android,
    });
  }

  for (const [date, regs] of regMap) {
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        anonymous: 0,
        ios: 0,
        android: 0,
        registrations: regs.total,
        registrationsIos: regs.ios,
        registrationsAndroid: regs.android,
      });
    }
  }

  const today = todayInShanghai();
  if (!byDate.has(today)) {
    const regs = regMap.get(today) ?? emptyRegs();
    byDate.set(today, {
      date: today,
      anonymous: 0,
      ios: 0,
      android: 0,
      registrations: regs.total,
      registrationsIos: regs.ios,
      registrationsAndroid: regs.android,
    });
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}
