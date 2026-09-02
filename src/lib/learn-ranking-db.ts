import type { RowDataPacket } from "mysql2";

import type { ClientAppId } from "@/lib/client-app";
import { execute, query, withTransaction } from "@/lib/db";

export const LEARN_RANKING_LIMIT = 100;
/** One practice session is unlikely to exceed this. */
export const MAX_CORRECT_DELTA_PER_SYNC = 800;
/** Abuse ceiling for a single Shanghai calendar day. */
export const MAX_DAILY_CORRECT = 2500;
export const MAX_TOTAL_CORRECT = 100_000_000;

export type LearnRankingScope = "week" | "month";

export type LearnRankingEntry = {
  rank: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  correct: number;
};

export type LearnRankingMe = {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  totalCorrect: number;
  todayCorrect: number;
  weekCorrect: number;
  monthCorrect: number;
  weekRank: number | null;
  monthRank: number | null;
};

export type LearnRankingBoard = {
  scope: LearnRankingScope;
  entries: LearnRankingEntry[];
  me: {
    rank: number | null;
    correct: number;
  } | null;
};

export type LearnRankingOverview = {
  week: LearnRankingBoard;
  month: LearnRankingBoard;
  me: LearnRankingMe | null;
};

type UserPublicRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
};

type CountRow = RowDataPacket & {
  user_id: number;
  correct: number | string;
};

type ScalarRow = RowDataPacket & {
  value: number | string | null;
};

let schemaEnsured = false;

function displayNameOf(row: {
  username: string;
  nickname: string | null;
}): string {
  const nick = row.nickname?.trim();
  if (nick) return nick;
  return row.username;
}

function avatarOf(row: { avatar_url: string | null }): string | null {
  const url = row.avatar_url?.trim();
  return url ? url : null;
}

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

const WEEK_FROM_SQL = `DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`;
const MONTH_FROM_SQL = `DATE_FORMAT(CURDATE(), '%Y-%m-01')`;

function periodFromSql(scope: LearnRankingScope): string {
  return scope === "week" ? WEEK_FROM_SQL : MONTH_FROM_SQL;
}

export async function ensureLearnRankingSchema(): Promise<void> {
  if (schemaEnsured) return;

  await execute(
    `CREATE TABLE IF NOT EXISTS user_learn_correct (
       user_id BIGINT UNSIGNED NOT NULL,
       app_id VARCHAR(32) NOT NULL,
       total_correct INT UNSIGNED NOT NULL DEFAULT 0,
       updated_at DATETIME NOT NULL,
       PRIMARY KEY (user_id, app_id),
       KEY idx_learn_correct_app_total (app_id, total_correct, user_id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS user_daily_correct (
       user_id BIGINT UNSIGNED NOT NULL,
       app_id VARCHAR(32) NOT NULL,
       stat_date DATE NOT NULL,
       correct_gained INT UNSIGNED NOT NULL DEFAULT 0,
       updated_at DATETIME NOT NULL,
       PRIMARY KEY (user_id, app_id, stat_date),
       KEY idx_daily_correct_app_date (app_id, stat_date, correct_gained, user_id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  schemaEnsured = true;
}

async function loadUserPublic(
  userId: number,
): Promise<UserPublicRow | null> {
  const rows = await query<UserPublicRow[]>(
    `SELECT id, username, nickname, avatar_url
     FROM users
     WHERE id = :userId
     LIMIT 1`,
    { userId },
  );
  return rows[0] ?? null;
}

async function loadUsersByIds(
  ids: number[],
): Promise<Map<number, UserPublicRow>> {
  if (ids.length === 0) return new Map();
  const users = await query<UserPublicRow[]>(
    `SELECT id, username, nickname, avatar_url
     FROM users
     WHERE id IN (${ids.map((_, i) => `:id${i}`).join(", ")})`,
    Object.fromEntries(ids.map((id, i) => [`id${i}`, id])),
  );
  return new Map(users.map((u) => [Number(u.id), u]));
}

async function listPeriodRows(
  appId: ClientAppId,
  scope: LearnRankingScope,
): Promise<CountRow[]> {
  return query<CountRow[]>(
    `SELECT user_id, SUM(correct_gained) AS correct
     FROM user_daily_correct
     WHERE app_id = :appId
       AND stat_date >= ${periodFromSql(scope)}
       AND stat_date <= CURDATE()
     GROUP BY user_id
     HAVING SUM(correct_gained) > 0
     ORDER BY correct DESC, user_id ASC
     LIMIT ${LEARN_RANKING_LIMIT}`,
    { appId },
  );
}

async function todayCorrectForUser(
  userId: number,
  appId: ClientAppId,
): Promise<number> {
  const rows = await query<ScalarRow[]>(
    `SELECT COALESCE(correct_gained, 0) AS value
     FROM user_daily_correct
     WHERE user_id = :userId
       AND app_id = :appId
       AND stat_date = CURDATE()
     LIMIT 1`,
    { userId, appId },
  );
  return asInt(rows[0]?.value);
}

async function periodTotalForUser(
  userId: number,
  appId: ClientAppId,
  scope: LearnRankingScope,
): Promise<number> {
  const rows = await query<ScalarRow[]>(
    `SELECT COALESCE(SUM(correct_gained), 0) AS value
     FROM user_daily_correct
     WHERE user_id = :userId
       AND app_id = :appId
       AND stat_date >= ${periodFromSql(scope)}
       AND stat_date <= CURDATE()`,
    { userId, appId },
  );
  return asInt(rows[0]?.value);
}

async function rankForUser(
  userId: number,
  appId: ClientAppId,
  scope: LearnRankingScope,
  myCorrect: number,
): Promise<number | null> {
  if (myCorrect <= 0) return null;
  const rows = await query<ScalarRow[]>(
    `SELECT COUNT(*) + 1 AS value FROM (
       SELECT user_id
       FROM user_daily_correct
       WHERE app_id = :appId
         AND stat_date >= ${periodFromSql(scope)}
         AND stat_date <= CURDATE()
       GROUP BY user_id
       HAVING SUM(correct_gained) > :myCorrect
           OR (SUM(correct_gained) = :sameCorrect AND user_id < :userId)
     ) ranked`,
    { appId, myCorrect, sameCorrect: myCorrect, userId },
  );
  const rank = asInt(rows[0]?.value);
  return rank > 0 ? rank : null;
}

async function entriesFromRows(rows: CountRow[]): Promise<LearnRankingEntry[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => Number(row.user_id));
  const byId = await loadUsersByIds(ids);
  return rows.map((row, index) => {
    const user = byId.get(Number(row.user_id));
    return {
      rank: index + 1,
      userId: Number(row.user_id),
      displayName: user ? displayNameOf(user) : `用户#${row.user_id}`,
      avatarUrl: user ? avatarOf(user) : null,
      correct: asInt(row.correct),
    };
  });
}

async function totalCorrectForUser(
  userId: number,
  appId: ClientAppId,
): Promise<number> {
  const rows = await query<ScalarRow[]>(
    `SELECT total_correct AS value
     FROM user_learn_correct
     WHERE user_id = :userId AND app_id = :appId
     LIMIT 1`,
    { userId, appId },
  );
  return asInt(rows[0]?.value);
}

export async function getLearnRankingMe(
  userId: number,
  appId: ClientAppId,
): Promise<LearnRankingMe> {
  await ensureLearnRankingSchema();

  const [user, totalCorrect, todayCorrect, weekCorrect, monthCorrect] =
    await Promise.all([
      loadUserPublic(userId),
      totalCorrectForUser(userId, appId),
      todayCorrectForUser(userId, appId),
      periodTotalForUser(userId, appId, "week"),
      periodTotalForUser(userId, appId, "month"),
    ]);

  const [weekRank, monthRank] = await Promise.all([
    rankForUser(userId, appId, "week", weekCorrect),
    rankForUser(userId, appId, "month", monthCorrect),
  ]);

  return {
    userId,
    displayName: user ? displayNameOf(user) : `用户#${userId}`,
    avatarUrl: user ? avatarOf(user) : null,
    totalCorrect,
    todayCorrect,
    weekCorrect,
    monthCorrect,
    weekRank,
    monthRank,
  };
}

async function buildBoard(
  appId: ClientAppId,
  scope: LearnRankingScope,
  viewerId: number | null,
): Promise<LearnRankingBoard> {
  const rows = await listPeriodRows(appId, scope);
  const entries = await entriesFromRows(rows);

  if (viewerId == null) {
    return { scope, entries, me: null };
  }

  const inBoard = entries.find((entry) => entry.userId === viewerId);
  if (inBoard) {
    return {
      scope,
      entries,
      me: { rank: inBoard.rank, correct: inBoard.correct },
    };
  }

  const correct = await periodTotalForUser(viewerId, appId, scope);
  const rank = await rankForUser(viewerId, appId, scope, correct);
  return {
    scope,
    entries,
    me: { rank, correct },
  };
}

export async function getLearnRankingOverview(
  appId: ClientAppId,
  viewerId: number | null,
): Promise<LearnRankingOverview> {
  await ensureLearnRankingSchema();

  const [week, month, me] = await Promise.all([
    buildBoard(appId, "week", viewerId),
    buildBoard(appId, "month", viewerId),
    viewerId != null ? getLearnRankingMe(viewerId, appId) : Promise.resolve(null),
  ]);

  return { week, month, me };
}

export async function getLearnRankingBoard(
  appId: ClientAppId,
  scope: LearnRankingScope,
  viewerId: number | null,
): Promise<LearnRankingBoard> {
  await ensureLearnRankingSchema();
  return buildBoard(appId, scope, viewerId);
}

/**
 * Client reports its local cumulative total. Server only increases, and
 * attributes the delta to today (Asia/Shanghai via session timezone).
 */
export async function syncLearnCorrectTotal(
  userId: number,
  appId: ClientAppId,
  clientTotal: number,
): Promise<LearnRankingMe> {
  await ensureLearnRankingSchema();

  const requested = Math.min(
    MAX_TOTAL_CORRECT,
    Math.max(0, Math.floor(clientTotal)),
  );

  await withTransaction(async () => {
    await execute(
      `INSERT INTO user_learn_correct
         (user_id, app_id, total_correct, updated_at)
       VALUES
         (:userId, :appId, 0, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      { userId, appId },
    );

    const totalRows = await query<(RowDataPacket & { total_correct: number })[]>(
      `SELECT total_correct
       FROM user_learn_correct
       WHERE user_id = :userId AND app_id = :appId
       LIMIT 1
       FOR UPDATE`,
      { userId, appId },
    );
    const current = asInt(totalRows[0]?.total_correct);
    let delta = Math.max(0, requested - current);
    delta = Math.min(delta, MAX_CORRECT_DELTA_PER_SYNC);
    if (delta <= 0) return;

    const todayRows = await query<(RowDataPacket & { correct_gained: number })[]>(
      `SELECT correct_gained
       FROM user_daily_correct
       WHERE user_id = :userId AND app_id = :appId AND stat_date = CURDATE()
       LIMIT 1
       FOR UPDATE`,
      { userId, appId },
    );
    const today = asInt(todayRows[0]?.correct_gained);
    const remaining = Math.max(0, MAX_DAILY_CORRECT - today);
    delta = Math.min(delta, remaining);
    if (delta <= 0) return;

    const next = current + delta;
    await execute(
      `UPDATE user_learn_correct
       SET total_correct = :next, updated_at = UTC_TIMESTAMP()
       WHERE user_id = :userId AND app_id = :appId`,
      { next, userId, appId },
    );

    await execute(
      `INSERT INTO user_daily_correct
         (user_id, app_id, stat_date, correct_gained, updated_at)
       VALUES
         (:userId, :appId, CURDATE(), :delta, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         correct_gained = correct_gained + VALUES(correct_gained),
         updated_at = UTC_TIMESTAMP()`,
      { userId, appId, delta },
    );
  });

  return getLearnRankingMe(userId, appId);
}
