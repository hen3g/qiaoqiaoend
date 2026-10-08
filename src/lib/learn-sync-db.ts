import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import type { RowDataPacket } from "mysql2";

import type { SessionUser } from "@/lib/auth";
import type { ClientAppId } from "@/lib/client-app";
import { execute, query, withTransaction } from "@/lib/db";
import { ErrorCode } from "@/lib/error-codes";
import {
  decodeSyncDocJson,
  emptySyncDoc,
  encodeSyncDocJson,
  mergeSyncDoc,
  SYNC_LIMITS,
  SYNC_SCHEMA_VERSION,
  syncDocWordCount,
  syncSetItems,
  type SyncDoc,
} from "@/lib/learn-sync-codec";
import { ensureUserLearnSyncTable } from "@/lib/user-schema";

/**
 * 仓鼠单词 cloud sync storage: one gzip snapshot per (user_id, app_id) in
 * `user_learn_sync`. Clients push compact deltas; the server merges them
 * under SELECT … FOR UPDATE and bumps `rev`.
 */

export const LEARN_SYNC_MESSAGES = {
  vipRequired: "云端同步仅限充值会员使用，请先开通会员。",
  activityVip: "云端同步仅限充值会员使用，您当前是活动会员，暂无法开启。",
  tooLarge: "学习记录太大，暂时无法同步",
} as const;

export type LearnSyncGateFailure = {
  status: number;
  message: string;
  code: string;
};

/**
 * Logged in + real paid membership that has not expired.
 * Expired paid members who still hold gift / activity VIP get the 活动会员
 * copy; everyone else gets 请先开通会员.
 */
export function learnSyncGate(user: SessionUser | null): LearnSyncGateFailure | null {
  if (!user) {
    return { status: 401, message: "请先登录", code: ErrorCode.LOGIN_REQUIRED };
  }
  if (user.isPaidVipActive) return null;
  if (user.isVip) {
    return {
      status: 403,
      message: LEARN_SYNC_MESSAGES.activityVip,
      code: ErrorCode.CLOUD_SYNC_ACTIVITY_VIP,
    };
  }
  return {
    status: 403,
    message: LEARN_SYNC_MESSAGES.vipRequired,
    code: ErrorCode.CLOUD_SYNC_VIP_REQUIRED,
  };
}

export class LearnSyncTooLargeError extends Error {
  constructor() {
    super(LEARN_SYNC_MESSAGES.tooLarge);
    this.name = "LearnSyncTooLargeError";
  }
}

// ---------------------------------------------------------------------------
// Per-user rate limit (memory): 1 call / 10 s and 60 / hour per action.

const RATE_MIN_GAP_MS = 10_000;
const RATE_HOUR_MS = 60 * 60 * 1000;
const RATE_HOUR_MAX = 60;
const rateHits = new Map<string, number[]>();

/** Returns seconds to wait, or 0 when the call is allowed (and records it). */
export function learnSyncRateLimit(
  userId: number,
  appId: ClientAppId,
  action: "pull" | "push" | "status" | "mark",
  now = Date.now(),
): number {
  const key = `${action}:${appId}:${userId}`;
  const hits = (rateHits.get(key) ?? []).filter((at) => now - at < RATE_HOUR_MS);
  const last = hits[hits.length - 1];
  if (last !== undefined && now - last < RATE_MIN_GAP_MS) {
    rateHits.set(key, hits);
    return Math.ceil((RATE_MIN_GAP_MS - (now - last)) / 1000);
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

// ---------------------------------------------------------------------------
// gzip helpers

/** gunzip with a hard output cap; throws LearnSyncTooLargeError past 8 MB. */
export function gunzipCapped(gz: Buffer): string {
  try {
    return gunzipSync(gz, { maxOutputLength: SYNC_LIMITS.maxRawBytes }).toString("utf8");
  } catch (err) {
    if (err instanceof RangeError || (err as { code?: string })?.code === "ERR_BUFFER_TOO_LARGE") {
      throw new LearnSyncTooLargeError();
    }
    throw err;
  }
}

export function decodeGzDoc(gz: Buffer): { doc: SyncDoc; json: string } {
  const json = gunzipCapped(gz);
  return { doc: decodeSyncDocJson(json), json };
}

// ---------------------------------------------------------------------------
// DB

type SyncRow = RowDataPacket & {
  rev: number;
  blob_gz: Buffer | null;
  updated_at: Date | string | null;
};

export type LearnSyncPull = {
  rev: number;
  /** Client's rev matches the server: nothing to download. */
  unchanged: boolean;
  /** gzip snapshot, or null when the cloud is empty / unchanged. */
  gz: Buffer | null;
  updatedAt: string | null;
};

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function pullLearnSync(
  userId: number,
  appId: ClientAppId,
  knownRev: number | null,
): Promise<LearnSyncPull> {
  await ensureUserLearnSyncTable();
  const meta = await query<SyncRow[]>(
    `SELECT rev, updated_at FROM user_learn_sync
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
    `SELECT rev, blob_gz, updated_at FROM user_learn_sync
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

/**
 * Create the row if needed and set `sync_enabled_at` once (never cleared).
 * A no-op write when the flag is already set.
 */
async function upsertEnabledRow(userId: number, appId: ClientAppId) {
  await execute(
    `INSERT INTO user_learn_sync
       (user_id, app_id, schema_ver, rev, blob_gz, raw_bytes, gz_bytes,
        word_count, last_device_id, sync_enabled_at, updated_at, created_at)
     VALUES (:userId, :appId, :ver, 0, NULL, 0, 0, 0, NULL, NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE sync_enabled_at = COALESCE(sync_enabled_at, VALUES(sync_enabled_at))`,
    { userId, appId, ver: SYNC_SCHEMA_VERSION },
  );
}

/** The account switched sync on (e.g. 使用云端, which never pushes). */
export async function markLearnSyncEnabled(userId: number, appId: ClientAppId): Promise<void> {
  await ensureUserLearnSyncTable();
  await upsertEnabledRow(userId, appId);
}

/** No learning records at all (same rule as the app's isSyncDocEmpty). */
export function learnSyncDocIsEmpty(doc: SyncDoc): boolean {
  for (const course of Object.values(doc.courses)) {
    if (Object.keys(course.words).length > 0 || course.placement || course.bestStreak > 0) {
      return false;
    }
  }
  return syncSetItems(doc.wordBook).length === 0 && syncSetItems(doc.blacklist).length === 0;
}

export type LearnSyncStatus = {
  /** The account has switched cloud sync on at least once (any device). */
  everEnabled: boolean;
  rev: number;
  /** The cloud holds no learning records. */
  empty: boolean;
  updatedAt: string | null;
};

type StatusRow = RowDataPacket & {
  rev: number;
  sync_enabled_at: Date | string | null;
  has_blob: number;
  word_count: number;
  updated_at: Date | string | null;
};

/**
 * Cheap account-level status for the "sync on this device?" prompt after login.
 * Reads one small row; only decompresses the snapshot in the rare case it has
 * no course words (word book / removed words only).
 */
export async function getLearnSyncStatus(
  userId: number,
  appId: ClientAppId,
): Promise<LearnSyncStatus> {
  await ensureUserLearnSyncTable();
  const rows = await query<StatusRow[]>(
    `SELECT rev, sync_enabled_at, (blob_gz IS NOT NULL AND gz_bytes > 0) AS has_blob,
            word_count, updated_at
     FROM user_learn_sync
     WHERE user_id = :userId AND app_id = :appId LIMIT 1`,
    { userId, appId },
  );
  const row = rows[0];
  if (!row) return { everEnabled: false, rev: 0, empty: true, updatedAt: null };
  let empty = !Number(row.has_blob);
  if (!empty && Number(row.word_count) === 0) {
    const blob = await query<SyncRow[]>(
      `SELECT rev, blob_gz, updated_at FROM user_learn_sync
       WHERE user_id = :userId AND app_id = :appId LIMIT 1`,
      { userId, appId },
    );
    const gz = blob[0]?.blob_gz;
    try {
      empty = !gz || gz.length === 0 || learnSyncDocIsEmpty(decodeGzDoc(Buffer.from(gz)).doc);
    } catch {
      empty = false; // unreadable snapshot: never claim the cloud is empty
    }
  }
  return {
    everEnabled: row.sync_enabled_at != null,
    rev: Number(row.rev) || 0,
    empty,
    updatedAt: toIso(row.updated_at),
  };
}

export type LearnSyncPush = {
  rev: number;
  /** Server had exactly the client's base rev: the client already holds the merged state. */
  unchanged: boolean;
  /** Merged snapshot when the client must catch up (another device wrote). */
  gz: Buffer | null;
  updatedAt: string | null;
};

export async function pushLearnSync(input: {
  userId: number;
  appId: ClientAppId;
  baseRev: number;
  deviceId: string | null;
  deltaGz: Buffer;
}): Promise<LearnSyncPush> {
  const { userId, appId } = input;
  // Validate before touching the DB (throws SyncCodecError / LearnSyncTooLargeError).
  const delta = decodeGzDoc(input.deltaGz).doc;

  // DDL must run outside the transaction. Pushes only come from devices with
  // sync switched on, so this also records "ever enabled" for the account.
  await ensureUserLearnSyncTable();
  await upsertEnabledRow(userId, appId);

  return withTransaction(async () => {
    const rows = await query<SyncRow[]>(
      `SELECT rev, blob_gz, updated_at FROM user_learn_sync
       WHERE user_id = :userId AND app_id = :appId
       FOR UPDATE`,
      { userId, appId },
    );
    const row = rows[0];
    const prevRev = row ? Number(row.rev) || 0 : 0;
    let base = emptySyncDoc();
    let prevJson: string | null = null;
    if (row?.blob_gz && row.blob_gz.length > 0) {
      const decoded = decodeGzDoc(Buffer.from(row.blob_gz));
      base = decoded.doc;
      prevJson = decoded.json;
    }

    const merged = mergeSyncDoc(base, delta, Date.now());
    const json = encodeSyncDocJson(merged);
    const raw = Buffer.from(json, "utf8");
    if (raw.length > SYNC_LIMITS.maxRawBytes) throw new LearnSyncTooLargeError();

    let rev = prevRev;
    let gz: Buffer | null = row?.blob_gz ? Buffer.from(row.blob_gz) : null;
    let updatedAt = row ? toIso(row.updated_at) : null;
    if (json !== prevJson) {
      gz = gzipSync(raw, { level: 9 });
      if (gz.length > SYNC_LIMITS.maxGzBytes) throw new LearnSyncTooLargeError();
      rev = prevRev + 1;
      await execute(
        `UPDATE user_learn_sync
         SET schema_ver = :ver, rev = :rev, blob_gz = :blob,
             raw_bytes = :rawBytes, gz_bytes = :gzBytes, word_count = :wordCount,
             last_device_id = :deviceId, updated_at = NOW()
         WHERE user_id = :userId AND app_id = :appId`,
        {
          ver: SYNC_SCHEMA_VERSION,
          rev,
          blob: gz as unknown as string,
          rawBytes: raw.length,
          gzBytes: gz.length,
          wordCount: syncDocWordCount(merged),
          deviceId: input.deviceId,
          userId,
          appId,
        },
      );
      updatedAt = new Date().toISOString();
    }

    const unchanged = input.baseRev === prevRev;
    return { rev, unchanged, gz: unchanged ? null : gz, updatedAt };
  });
}
