import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import type { RowDataPacket } from "mysql2";

import type { ClientAppId } from "@/lib/client-app";
import { execute, query, withTransaction } from "@/lib/db";
import { ErrorCode } from "@/lib/error-codes";
import {
  INSUFFICIENT_DIAMONDS_CODE,
  INSUFFICIENT_DIAMONDS_MESSAGE,
  tryDeductDiamonds,
} from "@/lib/vip";
import { ensureUserManorSyncTable } from "@/lib/user-schema";

/** 仓鼠庄园 cloud sync + daily wish quota. Login required; no VIP gate. */

export const MANOR_SYNC_SCHEMA_VERSION = 1;
export const MANOR_WISH_FREE_DAILY = 5;
export const MANOR_WISH_DIAMOND_COST = 5;
export const MANOR_WISH_NEED_CORRECT = 10;

export const MANOR_SYNC_LIMITS = {
  maxRawBytes: 2 * 1024 * 1024,
  maxGzBytes: 768 * 1024,
} as const;

export const MANOR_SYNC_MESSAGES = {
  tooLarge: "庄园存档太大，暂时无法同步",
  needCorrect: "今天先答对 10 题才能许愿",
} as const;

export class ManorSyncTooLargeError extends Error {
  constructor() {
    super(MANOR_SYNC_MESSAGES.tooLarge);
    this.name = "ManorSyncTooLargeError";
  }
}

export class ManorWishNeedCorrectError extends Error {
  todayCorrect: number;
  constructor(todayCorrect: number) {
    super(MANOR_SYNC_MESSAGES.needCorrect);
    this.name = "ManorWishNeedCorrectError";
    this.todayCorrect = todayCorrect;
  }
}

export class ManorWishInsufficientDiamondsError extends Error {
  balance: number;
  constructor(balance: number) {
    super(INSUFFICIENT_DIAMONDS_MESSAGE);
    this.name = "ManorWishInsufficientDiamondsError";
    this.balance = balance;
  }
}

const RATE_MIN_GAP_MS = 3_000;
const RATE_HOUR_MS = 60 * 60 * 1000;
const RATE_HOUR_MAX = 120;
const rateHits = new Map<string, number[]>();

/** Returns seconds to wait, or 0 when allowed. */
export function manorSyncRateLimit(
  userId: number,
  appId: ClientAppId,
  action: "pull" | "push" | "wish" | "wishStatus",
  now = Date.now(),
): number {
  const key = `${action}:${appId}:${userId}`;
  const hits = (rateHits.get(key) ?? []).filter((at) => now - at < RATE_HOUR_MS);
  const last = hits[hits.length - 1];
  const minGap = action === "wish" ? 800 : RATE_MIN_GAP_MS;
  if (last !== undefined && now - last < minGap) {
    rateHits.set(key, hits);
    return Math.ceil((minGap - (now - last)) / 1000);
  }
  if (hits.length >= RATE_HOUR_MAX) {
    rateHits.set(key, hits);
    return Math.ceil((RATE_HOUR_MS - (now - hits[0]!)) / 1000);
  }
  hits.push(now);
  rateHits.set(key, hits);
  if (rateHits.size > 50_000) {
    for (const [k, list] of rateHits) {
      if (!list.length || now - list[list.length - 1]! > RATE_HOUR_MS) rateHits.delete(k);
    }
  }
  return 0;
}

/** Shanghai calendar day YYYY-MM-DD (pool timezone is +08:00). */
export function manorShanghaiDay(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function gunzipCapped(gz: Buffer): string {
  try {
    return gunzipSync(gz, { maxOutputLength: MANOR_SYNC_LIMITS.maxRawBytes }).toString("utf8");
  } catch (err) {
    if (err instanceof RangeError || (err as { code?: string })?.code === "ERR_BUFFER_TOO_LARGE") {
      throw new ManorSyncTooLargeError();
    }
    throw err;
  }
}

function encodeManorGz(json: string): Buffer {
  const raw = Buffer.from(json, "utf8");
  if (raw.length > MANOR_SYNC_LIMITS.maxRawBytes) throw new ManorSyncTooLargeError();
  const gz = gzipSync(raw, { level: 9 });
  if (gz.length > MANOR_SYNC_LIMITS.maxGzBytes) throw new ManorSyncTooLargeError();
  return gz;
}

type SyncRow = RowDataPacket & {
  rev: number;
  blob_gz: Buffer | null;
  updated_at: Date | string | null;
  raw_bytes?: number;
  gz_bytes?: number;
};

type WishRow = RowDataPacket & {
  wish_day: Date | string;
  wish_count: number;
};

function asWishDay(value: Date | string): string {
  if (value instanceof Date) return manorShanghaiDay(value.getTime());
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? manorShanghaiDay() : manorShanghaiDay(d.getTime());
}

async function todayCorrectForUser(userId: number, appId: ClientAppId): Promise<number> {
  const day = manorShanghaiDay();
  const rows = await query<(RowDataPacket & { value: number })[]>(
    `SELECT COALESCE(correct_gained, 0) AS value
     FROM user_daily_correct
     WHERE user_id = :userId
       AND app_id = :appId
       AND stat_date = :day
     LIMIT 1`,
    { userId, appId, day },
  );
  return Math.max(0, Number(rows[0]?.value ?? 0) || 0);
}

async function upsertEmptySyncRow(userId: number, appId: ClientAppId) {
  await execute(
    `INSERT INTO user_manor_sync
       (user_id, app_id, schema_ver, rev, blob_gz, raw_bytes, gz_bytes,
        last_device_id, updated_at, created_at)
     VALUES (:userId, :appId, :ver, 0, NULL, 0, 0, NULL, NOW(), NOW())
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    { userId, appId, ver: MANOR_SYNC_SCHEMA_VERSION },
  );
}

export type ManorSyncPull = {
  rev: number;
  unchanged: boolean;
  gz: Buffer | null;
  updatedAt: string | null;
};

export async function pullManorSync(
  userId: number,
  appId: ClientAppId,
  knownRev: number | null,
): Promise<ManorSyncPull> {
  await ensureUserManorSyncTable();
  const meta = await query<SyncRow[]>(
    `SELECT rev, updated_at FROM user_manor_sync
     WHERE user_id = :userId AND app_id = :appId LIMIT 1`,
    { userId, appId },
  );
  const row = meta[0];
  const rev = row ? Number(row.rev) || 0 : 0;
  const updatedAt = row ? toIso(row.updated_at) : null;
  if (knownRev !== null && knownRev === rev) {
    return { rev, unchanged: true, gz: null, updatedAt };
  }
  if (!row) return { rev: 0, unchanged: false, gz: null, updatedAt: null };
  const blob = await query<SyncRow[]>(
    `SELECT rev, blob_gz, updated_at FROM user_manor_sync
     WHERE user_id = :userId AND app_id = :appId LIMIT 1`,
    { userId, appId },
  );
  const full = blob[0];
  return {
    rev: full ? Number(full.rev) || 0 : rev,
    unchanged: false,
    gz: full?.blob_gz && full.blob_gz.length > 0 ? Buffer.from(full.blob_gz) : null,
    updatedAt: full ? toIso(full.updated_at) : updatedAt,
  };
}

export type ManorSyncPush = {
  rev: number;
  unchanged: boolean;
  gz: Buffer | null;
  updatedAt: string | null;
};

/**
 * Full-snapshot push (last-write-wins when baseRev matches).
 * On baseRev mismatch, returns the current cloud snapshot for the client to adopt.
 */
export async function pushManorSync(input: {
  userId: number;
  appId: ClientAppId;
  baseRev: number;
  deviceId: string | null;
  snapshotGz: Buffer;
}): Promise<ManorSyncPush> {
  const json = gunzipCapped(input.snapshotGz);
  // Basic JSON sanity — do not deeply validate item catalog on server.
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SyntaxError("bad manor json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("bad manor json");
  }
  const gz = encodeManorGz(json);
  const rawBytes = Buffer.byteLength(json, "utf8");

  await ensureUserManorSyncTable();
  await upsertEmptySyncRow(input.userId, input.appId);

  return withTransaction(async () => {
    const rows = await query<SyncRow[]>(
      `SELECT rev, blob_gz, updated_at FROM user_manor_sync
       WHERE user_id = :userId AND app_id = :appId
       FOR UPDATE`,
      { userId: input.userId, appId: input.appId },
    );
    const row = rows[0];
    const prevRev = row ? Number(row.rev) || 0 : 0;
    const prevGz = row?.blob_gz && row.blob_gz.length > 0 ? Buffer.from(row.blob_gz) : null;
    const prevUpdated = row ? toIso(row.updated_at) : null;

    if (input.baseRev !== prevRev) {
      return {
        rev: prevRev,
        unchanged: false,
        gz: prevGz,
        updatedAt: prevUpdated,
      };
    }

    // Identical payload: keep rev.
    if (prevGz && prevGz.equals(gz)) {
      return { rev: prevRev, unchanged: true, gz: null, updatedAt: prevUpdated };
    }

    const rev = prevRev + 1;
    await execute(
      `UPDATE user_manor_sync
       SET schema_ver = :ver, rev = :rev, blob_gz = :blob,
           raw_bytes = :rawBytes, gz_bytes = :gzBytes,
           last_device_id = :deviceId, updated_at = NOW()
       WHERE user_id = :userId AND app_id = :appId`,
      {
        ver: MANOR_SYNC_SCHEMA_VERSION,
        rev,
        blob: gz as unknown as string,
        rawBytes,
        gzBytes: gz.length,
        deviceId: input.deviceId,
        userId: input.userId,
        appId: input.appId,
      },
    );
    return {
      rev,
      unchanged: true,
      gz: null,
      updatedAt: new Date().toISOString(),
    };
  });
}

export type ManorWishStatus = {
  todayCorrect: number;
  needCorrect: number;
  wishDay: string;
  wishCount: number;
  freeRemaining: number;
  freeUnlocked: boolean;
  diamondCost: number;
  dailyFreeMax: number;
};

function statusFromWish(
  todayCorrect: number,
  wishDay: string,
  wishCount: number,
): ManorWishStatus {
  const freeUnlocked = todayCorrect >= MANOR_WISH_NEED_CORRECT;
  const freeRemaining = freeUnlocked
    ? Math.max(0, MANOR_WISH_FREE_DAILY - wishCount)
    : 0;
  return {
    todayCorrect,
    needCorrect: MANOR_WISH_NEED_CORRECT,
    wishDay,
    wishCount,
    freeRemaining,
    freeUnlocked,
    diamondCost: MANOR_WISH_DIAMOND_COST,
    dailyFreeMax: MANOR_WISH_FREE_DAILY,
  };
}

export async function getManorWishStatus(
  userId: number,
  appId: ClientAppId,
): Promise<ManorWishStatus> {
  await ensureUserManorSyncTable();
  const today = manorShanghaiDay();
  const todayCorrect = await todayCorrectForUser(userId, appId);
  const rows = await query<WishRow[]>(
    `SELECT wish_day, wish_count FROM user_manor_wish
     WHERE user_id = :userId AND app_id = :appId LIMIT 1`,
    { userId, appId },
  );
  const row = rows[0];
  if (!row) return statusFromWish(todayCorrect, today, 0);
  const day = asWishDay(row.wish_day);
  const count = day === today ? Math.max(0, Number(row.wish_count) || 0) : 0;
  return statusFromWish(todayCorrect, today, count);
}

export type ManorWishResult = ManorWishStatus & {
  free: boolean;
  diamondsSpent: number;
  diamonds: number;
  starsGranted: number;
};

/**
 * Authoritative wish: requires ≥10 correct answers today.
 * First 5 wishes/day free; then 5 diamonds each (atomic deduct).
 */
export async function performManorWish(
  userId: number,
  appId: ClientAppId,
): Promise<ManorWishResult> {
  await ensureUserManorSyncTable();
  const today = manorShanghaiDay();

  return withTransaction(async () => {
    const todayCorrect = await todayCorrectForUser(userId, appId);
    if (todayCorrect < MANOR_WISH_NEED_CORRECT) {
      throw new ManorWishNeedCorrectError(todayCorrect);
    }

    await execute(
      `INSERT INTO user_manor_wish
         (user_id, app_id, wish_day, wish_count, updated_at)
       VALUES (:userId, :appId, :day, 0, NOW())
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      { userId, appId, day: today },
    );

    const rows = await query<WishRow[]>(
      `SELECT wish_day, wish_count FROM user_manor_wish
       WHERE user_id = :userId AND app_id = :appId
       FOR UPDATE`,
      { userId, appId },
    );
    const row = rows[0]!;
    let wishCount = Math.max(0, Number(row.wish_count) || 0);
    const day = asWishDay(row.wish_day);
    if (day !== today) wishCount = 0;

    const free = wishCount < MANOR_WISH_FREE_DAILY;
    let diamondsSpent = 0;
    let diamonds = 0;

    if (free) {
      const bal = await query<(RowDataPacket & { diamonds: number })[]>(
        `SELECT diamonds FROM users WHERE id = :userId LIMIT 1`,
        { userId },
      );
      diamonds = Math.max(0, Number(bal[0]?.diamonds ?? 0) || 0);
    } else {
      const deducted = await tryDeductDiamonds(userId, MANOR_WISH_DIAMOND_COST, {
        type: "manor_wish",
        meta: { wishDay: today, wishCount: wishCount + 1 },
      });
      if (!deducted.ok) {
        throw new ManorWishInsufficientDiamondsError(deducted.balance);
      }
      diamondsSpent = MANOR_WISH_DIAMOND_COST;
      diamonds = deducted.balance;
    }

    wishCount += 1;
    await execute(
      `UPDATE user_manor_wish
       SET wish_day = :day, wish_count = :count, updated_at = NOW()
       WHERE user_id = :userId AND app_id = :appId`,
      { day: today, count: wishCount, userId, appId },
    );

    return {
      ...statusFromWish(todayCorrect, today, wishCount),
      free,
      diamondsSpent,
      diamonds,
      starsGranted: 1,
    };
  });
}

export { INSUFFICIENT_DIAMONDS_CODE, ErrorCode };
