import "server-only";
import { gunzipSync } from "node:zlib";
import type { RowDataPacket } from "mysql2";

import { query } from "@/lib/db";
import { MANOR_SYNC_LIMITS } from "@/lib/manor-sync-db";

/** Known internal test account (山姆叔叔). */
export const MANOR_TEST_USER_ID = 8;

const APP_ID = "hamster" as const;

export type ManorOverview = {
  syncedUsers: number;
  wishedUsers: number;
  stockUsers: number;
  placedUsers: number;
  paidWishCount: number;
  paidUsers: number;
  diamondsSpent: number;
};

export type ManorPaidUser = {
  userId: number;
  username: string | null;
  nickname: string | null;
  wishCount: number;
  diamondsSpent: number;
  isTest: boolean;
};

export type ManorTopItem = {
  itemId: string;
  held: number;
  stock: number;
  placed: number;
};

export type ManorActivity = {
  firstSyncAt: string | null;
  lastSyncAt: string | null;
  firstWishAt: string | null;
  lastWishAt: string | null;
  firstPaidWishAt: string | null;
  lastPaidWishAt: string | null;
};

export type ManorStatsPayload = {
  appId: typeof APP_ID;
  testUserId: number;
  all: ManorOverview;
  excludingTest: ManorOverview;
  activity: ManorActivity;
  paidBreakdown: ManorPaidUser[];
  topItems: ManorTopItem[];
  footnotes: string[];
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function emptyOverview(): ManorOverview {
  return {
    syncedUsers: 0,
    wishedUsers: 0,
    stockUsers: 0,
    placedUsers: 0,
    paidWishCount: 0,
    paidUsers: 0,
    diamondsSpent: 0,
  };
}

type SyncBlobRow = RowDataPacket & {
  user_id: number;
  blob_gz: Buffer;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type WishAggRow = RowDataPacket & {
  wished_users: number;
  wished_users_ex: number;
  first_wish_at: Date | string | null;
  last_wish_at: Date | string | null;
};

type PaidAggRow = RowDataPacket & {
  paid_wish_count: number;
  paid_wish_count_ex: number;
  paid_users: number;
  paid_users_ex: number;
  diamonds_spent: number | string;
  diamonds_spent_ex: number | string;
  first_paid_at: Date | string | null;
  last_paid_at: Date | string | null;
};

type PaidUserRow = RowDataPacket & {
  user_id: number;
  username: string | null;
  nickname: string | null;
  wish_count: number | string;
  diamonds_spent: number | string;
};

function gunzipJson(gz: Buffer): unknown | null {
  try {
    const raw = gunzipSync(gz, {
      maxOutputLength: MANOR_SYNC_LIMITS.maxRawBytes,
    }).toString("utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function stockHasItems(stock: unknown): boolean {
  if (!stock || typeof stock !== "object" || Array.isArray(stock)) return false;
  for (const v of Object.values(stock as Record<string, unknown>)) {
    if (Number(v) > 0) return true;
  }
  return false;
}

function placedList(placed: unknown): Array<{ itemId?: unknown }> {
  return Array.isArray(placed) ? (placed as Array<{ itemId?: unknown }>) : [];
}

/**
 * Live 仓鼠庄园 engagement stats (read-only).
 * Free-wish history is incomplete: user_manor_wish keeps only the latest day.
 */
export async function getManorStats(): Promise<ManorStatsPayload> {
  const [wishAgg] = await query<WishAggRow[]>(
    `SELECT
       COUNT(*) AS wished_users,
       SUM(CASE WHEN user_id <> :testId THEN 1 ELSE 0 END) AS wished_users_ex,
       MIN(updated_at) AS first_wish_at,
       MAX(updated_at) AS last_wish_at
     FROM user_manor_wish
     WHERE app_id = :appId
       AND wish_count > 0`,
    { appId: APP_ID, testId: MANOR_TEST_USER_ID },
  );

  const [paidAgg] = await query<PaidAggRow[]>(
    `SELECT
       COUNT(*) AS paid_wish_count,
       SUM(CASE WHEN user_id <> :testId THEN 1 ELSE 0 END) AS paid_wish_count_ex,
       COUNT(DISTINCT user_id) AS paid_users,
       COUNT(DISTINCT CASE WHEN user_id <> :testId THEN user_id END) AS paid_users_ex,
       COALESCE(SUM(-amount), 0) AS diamonds_spent,
       COALESCE(SUM(CASE WHEN user_id <> :testId THEN -amount ELSE 0 END), 0) AS diamonds_spent_ex,
       MIN(created_at) AS first_paid_at,
       MAX(created_at) AS last_paid_at
     FROM diamond_transactions
     WHERE type = 'manor_wish'
       AND amount < 0`,
    { testId: MANOR_TEST_USER_ID },
  );

  const paidBreakdownRows = await query<PaidUserRow[]>(
    `SELECT
       t.user_id,
       u.username,
       u.nickname,
       COUNT(*) AS wish_count,
       COALESCE(SUM(-t.amount), 0) AS diamonds_spent
     FROM diamond_transactions t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.type = 'manor_wish'
       AND t.amount < 0
     GROUP BY t.user_id, u.username, u.nickname
     ORDER BY diamonds_spent DESC, wish_count DESC, t.user_id ASC`,
    {},
  );

  const syncRows = await query<SyncBlobRow[]>(
    `SELECT user_id, blob_gz, created_at, updated_at
     FROM user_manor_sync
     WHERE app_id = :appId
       AND blob_gz IS NOT NULL
       AND gz_bytes > 0`,
    { appId: APP_ID },
  );

  const all = emptyOverview();
  const excludingTest = emptyOverview();
  const itemTotals = new Map<string, { stock: number; placed: number }>();

  let firstSyncAt: string | null = null;
  let lastSyncAt: string | null = null;

  for (const row of syncRows) {
    const uid = Number(row.user_id) || 0;
    const isTest = uid === MANOR_TEST_USER_ID;
    const created = toIso(row.created_at);
    const updated = toIso(row.updated_at);
    if (created && (!firstSyncAt || created < firstSyncAt)) firstSyncAt = created;
    if (updated && (!lastSyncAt || updated > lastSyncAt)) lastSyncAt = updated;

    all.syncedUsers += 1;
    if (!isTest) excludingTest.syncedUsers += 1;

    const parsed = gunzipJson(Buffer.from(row.blob_gz));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const state = parsed as { stock?: unknown; placed?: unknown };

    const hasStock = stockHasItems(state.stock);
    const placed = placedList(state.placed);
    const hasPlaced = placed.length > 0;

    if (hasStock) {
      all.stockUsers += 1;
      if (!isTest) excludingTest.stockUsers += 1;
    }
    if (hasPlaced) {
      all.placedUsers += 1;
      if (!isTest) excludingTest.placedUsers += 1;
    }

    if (state.stock && typeof state.stock === "object" && !Array.isArray(state.stock)) {
      for (const [itemId, raw] of Object.entries(
        state.stock as Record<string, unknown>,
      )) {
        const n = Math.max(0, Number(raw) || 0);
        if (!itemId || n <= 0) continue;
        const cur = itemTotals.get(itemId) ?? { stock: 0, placed: 0 };
        cur.stock += n;
        itemTotals.set(itemId, cur);
      }
    }
    for (const p of placed) {
      const itemId = typeof p.itemId === "string" ? p.itemId : "";
      if (!itemId) continue;
      const cur = itemTotals.get(itemId) ?? { stock: 0, placed: 0 };
      cur.placed += 1;
      itemTotals.set(itemId, cur);
    }
  }

  all.wishedUsers = Number(wishAgg?.wished_users ?? 0) || 0;
  excludingTest.wishedUsers = Number(wishAgg?.wished_users_ex ?? 0) || 0;

  all.paidWishCount = Number(paidAgg?.paid_wish_count ?? 0) || 0;
  excludingTest.paidWishCount = Number(paidAgg?.paid_wish_count_ex ?? 0) || 0;
  all.paidUsers = Number(paidAgg?.paid_users ?? 0) || 0;
  excludingTest.paidUsers = Number(paidAgg?.paid_users_ex ?? 0) || 0;
  all.diamondsSpent = Number(paidAgg?.diamonds_spent ?? 0) || 0;
  excludingTest.diamondsSpent = Number(paidAgg?.diamonds_spent_ex ?? 0) || 0;

  const paidBreakdown: ManorPaidUser[] = paidBreakdownRows.map((r) => ({
    userId: Number(r.user_id) || 0,
    username: r.username ?? null,
    nickname: r.nickname ?? null,
    wishCount: Number(r.wish_count) || 0,
    diamondsSpent: Number(r.diamonds_spent) || 0,
    isTest: Number(r.user_id) === MANOR_TEST_USER_ID,
  }));

  const topItems: ManorTopItem[] = [...itemTotals.entries()]
    .map(([itemId, v]) => ({
      itemId,
      stock: v.stock,
      placed: v.placed,
      held: v.stock + v.placed,
    }))
    .filter((x) => x.held > 0)
    .sort((a, b) => b.held - a.held || a.itemId.localeCompare(b.itemId))
    .slice(0, 30);

  return {
    appId: APP_ID,
    testUserId: MANOR_TEST_USER_ID,
    all,
    excludingTest,
    activity: {
      firstSyncAt,
      lastSyncAt,
      firstWishAt: toIso(wishAgg?.first_wish_at),
      lastWishAt: toIso(wishAgg?.last_wish_at),
      firstPaidWishAt: toIso(paidAgg?.first_paid_at),
      lastPaidWishAt: toIso(paidAgg?.last_paid_at),
    },
    paidBreakdown,
    topItems,
    footnotes: [
      "免费许愿没有完整流水：user_manor_wish 只保留每位用户最近一天的 wish_count。",
      "抽中物品不落库，仅能从当前云同步快照的 stock / placed 反推持有量。",
      "「至少许愿人数」= 当前 wish_count > 0 的用户（含历史许愿日仍留在表里的记录）。",
      `测试号 id=${MANOR_TEST_USER_ID}（山姆叔叔）可在「去测试」视图中排除。`,
    ],
  };
}
