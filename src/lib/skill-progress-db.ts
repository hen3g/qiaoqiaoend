import type { RowDataPacket } from "mysql2";

import { execute, query } from "@/lib/db";
import { syncStarRankingAggregates } from "@/lib/ranking-db";

export type ClearStars = 1 | 2 | 3;
export type PackStarsMap = Record<string, ClearStars>;

export type SkillProgressState = {
  /** 每关最高星（1–3）；app1 闯关主数据 */
  packStars: PackStarsMap;
  /** 上次打开的关卡（继续学习） */
  lastPackId: string | null;
  /** 由 packStars 推导；兼容 web / 旧字段 */
  completedPackIds: string[];
  unlockedDifficulty: 1 | 2 | 3 | 4 | 5;
  jumpUnlockedSeriesIds: string[];
};

type ProgressRow = RowDataPacket & {
  unlocked_difficulty: number;
  completed_pack_ids: unknown;
  jump_unlocked_series_ids: unknown;
  pack_stars: unknown;
  last_pack_id: string | null;
};

let columnsEnsured = false;

/** Ensure pack_stars / last_pack_id exist (safe to call repeatedly). */
export async function ensureSkillProgressColumns(): Promise<void> {
  if (columnsEnsured) return;
  type ColRow = RowDataPacket & { Field: string };

  const starsCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_skill_progress LIKE 'pack_stars'`,
  );
  if (starsCols.length === 0) {
    await execute(
      `ALTER TABLE user_skill_progress
       ADD COLUMN pack_stars JSON NULL AFTER jump_unlocked_series_ids`,
    );
  }

  const lastCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_skill_progress LIKE 'last_pack_id'`,
  );
  if (lastCols.length === 0) {
    await execute(
      `ALTER TABLE user_skill_progress
       ADD COLUMN last_pack_id VARCHAR(128) NULL AFTER pack_stars`,
    );
  }

  columnsEnsured = true;
}

function normalizeUnlockedDifficulty(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const difficulty = Number(value);
  if (!Number.isInteger(difficulty)) return 1;
  return Math.min(5, Math.max(1, difficulty)) as 1 | 2 | 3 | 4 | 5;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  if (typeof value === "string") {
    try {
      return parseStringArray(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

function isClearStars(value: unknown): value is ClearStars {
  return value === 1 || value === 2 || value === 3;
}

function parsePackStars(value: unknown): PackStarsMap {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: PackStarsMap = {};
  for (const [id, stars] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id === "string" && id.length > 0 && isClearStars(stars)) {
      out[id] = stars;
    }
  }
  return out;
}

function completedFromStars(map: PackStarsMap): string[] {
  return Object.keys(map).filter((id) => (map[id] ?? 0) >= 1);
}

/** Legacy web rows only had completed_pack_ids → synthesize 1★ each. */
function starsFromCompleted(ids: string[]): PackStarsMap {
  const out: PackStarsMap = {};
  for (const id of ids) {
    if (id) out[id] = 1;
  }
  return out;
}

function mergeStarsMax(a: PackStarsMap, b: PackStarsMap): PackStarsMap {
  const out: PackStarsMap = { ...a };
  for (const [id, stars] of Object.entries(b)) {
    const prev = out[id] ?? 0;
    if (stars > prev) out[id] = stars;
  }
  return out;
}

function normalizeLastPackId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 ? id : null;
}

function rowToState(row: ProgressRow | undefined): SkillProgressState {
  if (!row) {
    return {
      packStars: {},
      lastPackId: null,
      completedPackIds: [],
      unlockedDifficulty: 1,
      jumpUnlockedSeriesIds: [],
    };
  }

  const completedPackIds = parseStringArray(row.completed_pack_ids);
  let packStars = parsePackStars(row.pack_stars);
  if (Object.keys(packStars).length === 0 && completedPackIds.length > 0) {
    packStars = starsFromCompleted(completedPackIds);
  }

  return {
    packStars,
    lastPackId: normalizeLastPackId(row.last_pack_id),
    completedPackIds: completedFromStars(packStars),
    unlockedDifficulty: normalizeUnlockedDifficulty(row.unlocked_difficulty),
    jumpUnlockedSeriesIds: parseStringArray(row.jump_unlocked_series_ids),
  };
}

export async function getSkillProgress(
  userId: number,
): Promise<SkillProgressState> {
  await ensureSkillProgressColumns();
  const rows = await query<ProgressRow[]>(
    `SELECT unlocked_difficulty, completed_pack_ids, jump_unlocked_series_ids,
            pack_stars, last_pack_id
     FROM user_skill_progress
     WHERE user_id = :userId
     LIMIT 1`,
    { userId },
  );
  return rowToState(rows[0]);
}

export async function saveSkillProgress(
  userId: number,
  input: {
    packStars?: PackStarsMap;
    lastPackId?: string | null;
    completedPackIds?: string[];
    jumpUnlockedSeriesIds?: string[];
    /** true = replace packStars; false = merge max (default replace when packStars provided) */
    mergeStars?: boolean;
  },
): Promise<SkillProgressState> {
  await ensureSkillProgressColumns();
  const current = await getSkillProgress(userId);

  let packStars = current.packStars;
  if (input.packStars) {
    packStars = input.mergeStars
      ? mergeStarsMax(current.packStars, input.packStars)
      : parsePackStars(input.packStars);
  } else if (input.completedPackIds) {
    // Web-compat PUT without packStars
    const fromCompleted = starsFromCompleted(
      [...new Set(input.completedPackIds.filter((id) => typeof id === "string"))],
    );
    packStars = mergeStarsMax(current.packStars, fromCompleted);
  }

  const lastPackId =
    input.lastPackId !== undefined
      ? normalizeLastPackId(input.lastPackId)
      : current.lastPackId;

  const jumpUnlockedSeriesIds = input.jumpUnlockedSeriesIds
    ? [
        ...new Set(
          input.jumpUnlockedSeriesIds.filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
        ),
      ]
    : current.jumpUnlockedSeriesIds;

  const completedPackIds = completedFromStars(packStars);
  const previousStars = current.packStars;

  await execute(
    `INSERT INTO user_skill_progress
       (user_id, unlocked_difficulty, completed_pack_ids, jump_unlocked_series_ids,
        pack_stars, last_pack_id, updated_at)
     VALUES
       (:userId, :unlockedDifficulty, CAST(:completed AS JSON), CAST(:jump AS JSON),
        CAST(:packStars AS JSON), :lastPackId, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       completed_pack_ids = VALUES(completed_pack_ids),
       jump_unlocked_series_ids = VALUES(jump_unlocked_series_ids),
       pack_stars = VALUES(pack_stars),
       last_pack_id = VALUES(last_pack_id),
       updated_at = UTC_TIMESTAMP()`,
    {
      userId,
      unlockedDifficulty: current.unlockedDifficulty,
      completed: JSON.stringify(completedPackIds),
      jump: JSON.stringify(jumpUnlockedSeriesIds),
      packStars: JSON.stringify(packStars),
      lastPackId,
    },
  );

  try {
    await syncStarRankingAggregates(userId, previousStars, packStars);
  } catch (err) {
    console.error("syncStarRankingAggregates failed", err);
  }

  return getSkillProgress(userId);
}

/** 只升不降：写入本关最高星；可选更新 lastPackId */
export async function markPackStars(
  userId: number,
  packId: string,
  stars: ClearStars,
  lastPackId?: string | null,
): Promise<SkillProgressState> {
  const id = packId.trim();
  if (!id) throw new Error("packId 无效");
  if (!isClearStars(stars)) throw new Error("星级必须是 1–3");

  return saveSkillProgress(userId, {
    packStars: { [id]: stars },
    mergeStars: true,
    ...(lastPackId !== undefined ? { lastPackId } : { lastPackId: id }),
  });
}

export async function unlockUserDifficulty(
  userId: number,
  targetDifficulty: number,
): Promise<SkillProgressState> {
  await ensureSkillProgressColumns();
  const unlockedDifficulty = normalizeUnlockedDifficulty(targetDifficulty);
  await execute(
    `INSERT INTO user_skill_progress
       (user_id, unlocked_difficulty, completed_pack_ids,
        jump_unlocked_series_ids, pack_stars, last_pack_id, updated_at)
     VALUES
       (:userId, :unlockedDifficulty, CAST(:emptyArr AS JSON), CAST(:emptyArr AS JSON),
        CAST(:emptyObj AS JSON), NULL, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       unlocked_difficulty = GREATEST(unlocked_difficulty, VALUES(unlocked_difficulty)),
       updated_at = UTC_TIMESTAMP()`,
    {
      userId,
      unlockedDifficulty,
      emptyArr: "[]",
      emptyObj: "{}",
    },
  );
  return getSkillProgress(userId);
}
