import type { RowDataPacket } from "mysql2";

import { execute, query } from "@/lib/db";
import type { PackStarsMap } from "@/lib/skill-progress-db";

export type RankingScope = "total" | "today";

export type RankingEntry = {
  rank: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  stars: number;
};

export type RankingBoard = {
  scope: RankingScope;
  entries: RankingEntry[];
  me: {
    rank: number | null;
    stars: number;
    userId: number;
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

export type RankingSummary = {
  total: { rank: number | null; stars: number };
  today: { rank: number | null; stars: number };
};

type UserPublicRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
};

type StarsRow = RowDataPacket & {
  user_id: number;
  stars: number;
};

let schemaEnsured = false;
let backfillDone = false;

function sumPackStars(map: PackStarsMap): number {
  let total = 0;
  for (const stars of Object.values(map)) {
    total += stars;
  }
  return total;
}

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

/** Ensure total_stars column + daily gains table exist. */
export async function ensureStarRankingSchema(): Promise<void> {
  if (schemaEnsured) return;

  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_skill_progress LIKE 'total_stars'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE user_skill_progress
       ADD COLUMN total_stars INT UNSIGNED NOT NULL DEFAULT 0 AFTER last_pack_id`,
    );
  }

  type IdxRow = RowDataPacket & { Key_name: string };
  const idxs = await query<IdxRow[]>(
    `SHOW INDEX FROM user_skill_progress WHERE Key_name = 'idx_usp_total_stars'`,
  );
  if (idxs.length === 0) {
    await execute(
      `ALTER TABLE user_skill_progress
       ADD KEY idx_usp_total_stars (total_stars, user_id)`,
    );
  }

  await execute(
    `CREATE TABLE IF NOT EXISTS user_daily_star_gains (
       user_id BIGINT NOT NULL,
       stat_date DATE NOT NULL,
       stars_gained INT UNSIGNED NOT NULL DEFAULT 0,
       updated_at DATETIME NOT NULL,
       PRIMARY KEY (user_id, stat_date),
       KEY idx_daily_stars_date_gained (stat_date, stars_gained, user_id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  schemaEnsured = true;
  await backfillTotalStarsOnce();
}

async function backfillTotalStarsOnce(): Promise<void> {
  if (backfillDone) return;
  backfillDone = true;

  type ProgressRow = RowDataPacket & {
    user_id: number;
    pack_stars: unknown;
    total_stars: number;
  };

  const rows = await query<ProgressRow[]>(
    `SELECT user_id, pack_stars, total_stars
     FROM user_skill_progress
     WHERE pack_stars IS NOT NULL`,
  );

  for (const row of rows) {
    let raw: unknown = row.pack_stars;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw) as unknown;
      } catch {
        continue;
      }
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;

    let total = 0;
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (value === 1 || value === 2 || value === 3) total += value;
    }
    if (total === Number(row.total_stars)) continue;

    await execute(
      `UPDATE user_skill_progress
       SET total_stars = :total
       WHERE user_id = :userId`,
      { userId: row.user_id, total },
    );
  }
}

/** Persist denormalized total; add positive star deltas to today's gains. */
export async function syncStarRankingAggregates(
  userId: number,
  previousStars: PackStarsMap,
  nextStars: PackStarsMap,
): Promise<void> {
  await ensureStarRankingSchema();

  const prevTotal = sumPackStars(previousStars);
  const nextTotal = sumPackStars(nextStars);
  const delta = nextTotal - prevTotal;

  await execute(
    `UPDATE user_skill_progress
     SET total_stars = :total
     WHERE user_id = :userId`,
    { userId, total: nextTotal },
  );

  if (delta <= 0) return;

  await execute(
    `INSERT INTO user_daily_star_gains
       (user_id, stat_date, stars_gained, updated_at)
     VALUES
       (:userId, CURDATE(), :delta, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       stars_gained = stars_gained + VALUES(stars_gained),
       updated_at = UTC_TIMESTAMP()`,
    { userId, delta },
  );
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

function rankAmong(rows: StarsRow[], userId: number, myStars: number): number {
  let better = 0;
  for (const row of rows) {
    const stars = Number(row.stars);
    const id = Number(row.user_id);
    if (stars > myStars || (stars === myStars && id < userId)) {
      better += 1;
    }
  }
  return better + 1;
}

async function listTotalStarRows(): Promise<StarsRow[]> {
  return query<StarsRow[]>(
    `SELECT user_id, total_stars AS stars
     FROM user_skill_progress
     WHERE total_stars > 0`,
  );
}

async function listTodayStarRows(): Promise<StarsRow[]> {
  return query<StarsRow[]>(
    `SELECT user_id, stars_gained AS stars
     FROM user_daily_star_gains
     WHERE stat_date = CURDATE() AND stars_gained > 0`,
  );
}

async function topEntriesFromRows(
  rows: StarsRow[],
  limit: number,
): Promise<RankingEntry[]> {
  const sorted = [...rows].sort((a, b) => {
    const sa = Number(a.stars);
    const sb = Number(b.stars);
    if (sb !== sa) return sb - sa;
    return Number(a.user_id) - Number(b.user_id);
  });
  const top = sorted.slice(0, limit);
  if (top.length === 0) return [];

  const ids = top.map((r) => Number(r.user_id));
  const users = await query<UserPublicRow[]>(
    `SELECT id, username, nickname, avatar_url
     FROM users
     WHERE id IN (${ids.map((_, i) => `:id${i}`).join(", ")})`,
    Object.fromEntries(ids.map((id, i) => [`id${i}`, id])),
  );
  const byId = new Map(users.map((u) => [Number(u.id), u]));

  return top.map((row, index) => {
    const user = byId.get(Number(row.user_id));
    return {
      rank: index + 1,
      userId: Number(row.user_id),
      displayName: user
        ? displayNameOf(user)
        : `用户#${row.user_id}`,
      avatarUrl: user ? avatarOf(user) : null,
      stars: Number(row.stars),
    };
  });
}

export async function getRankingBoard(
  scope: RankingScope,
  viewerId: number | null,
  limit = 100,
): Promise<RankingBoard> {
  await ensureStarRankingSchema();

  const rows =
    scope === "total" ? await listTotalStarRows() : await listTodayStarRows();
  const entries = await topEntriesFromRows(rows, limit);

  if (viewerId == null) {
    return { scope, entries, me: null };
  }

  const user = await loadUserPublic(viewerId);
  const mine = rows.find((r) => Number(r.user_id) === viewerId);
  const stars = mine ? Number(mine.stars) : 0;
  const rank = stars > 0 ? rankAmong(rows, viewerId, stars) : null;

  return {
    scope,
    entries,
    me: {
      userId: viewerId,
      rank,
      stars,
      displayName: user ? displayNameOf(user) : `用户#${viewerId}`,
      avatarUrl: user ? avatarOf(user) : null,
    },
  };
}

export async function getRankingSummary(
  userId: number,
): Promise<RankingSummary> {
  await ensureStarRankingSchema();

  const [totalRows, todayRows] = await Promise.all([
    listTotalStarRows(),
    listTodayStarRows(),
  ]);

  const totalMine = totalRows.find((r) => Number(r.user_id) === userId);
  const todayMine = todayRows.find((r) => Number(r.user_id) === userId);
  const totalStars = totalMine ? Number(totalMine.stars) : 0;
  const todayStars = todayMine ? Number(todayMine.stars) : 0;

  return {
    total: {
      stars: totalStars,
      rank:
        totalStars > 0 ? rankAmong(totalRows, userId, totalStars) : null,
    },
    today: {
      stars: todayStars,
      rank:
        todayStars > 0 ? rankAmong(todayRows, userId, todayStars) : null,
    },
  };
}

export { sumPackStars };
