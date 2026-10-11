import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import type { RowDataPacket } from "mysql2";

import type { ClientAppId } from "@/lib/client-app";
import { execute, query, withTransaction } from "@/lib/db";
import { ensureUserCustomCoursesSyncTable } from "@/lib/user-schema";

/**
 * 自制词库 cloud sync. Login required; no VIP gate.
 * Snapshot is gzip JSON: { v:1, courses: Record<id, Course>, deleted: Record<id, deletedAt> }
 * Push merges per-course by updatedAt / deletedAt (LWW), then stores the result.
 */

export const CUSTOM_COURSES_SYNC_SCHEMA_VERSION = 1;
export const CUSTOM_COURSES_SYNC_MAX_LIVE = 10;
export const CUSTOM_COURSES_SYNC_MAX_WORDS = 8000;
export const CUSTOM_COURSES_SYNC_MAX_TITLE = 80;
export const CUSTOM_COURSE_ID_RE = /^custom-[a-z0-9]+$/i;

export const CUSTOM_COURSES_SYNC_LIMITS = {
  maxRawBytes: 1 * 1024 * 1024,
  maxGzBytes: 384 * 1024,
} as const;

export const CUSTOM_COURSES_SYNC_MESSAGES = {
  tooLarge: "自制词库太大，暂时无法同步",
} as const;

export class CustomCoursesSyncTooLargeError extends Error {
  constructor() {
    super(CUSTOM_COURSES_SYNC_MESSAGES.tooLarge);
    this.name = "CustomCoursesSyncTooLargeError";
  }
}

const RATE_MIN_GAP_MS = 2_000;
const RATE_HOUR_MS = 60 * 60 * 1000;
const RATE_HOUR_MAX = 180;
const rateHits = new Map<string, number[]>();

/** Returns seconds to wait, or 0 when allowed. */
export function customCoursesSyncRateLimit(
  userId: number,
  appId: ClientAppId,
  action: "pull" | "push",
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

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function gunzipCapped(gz: Buffer): string {
  try {
    return gunzipSync(gz, {
      maxOutputLength: CUSTOM_COURSES_SYNC_LIMITS.maxRawBytes,
    }).toString("utf8");
  } catch (err) {
    if (
      err instanceof RangeError ||
      (err as { code?: string })?.code === "ERR_BUFFER_TOO_LARGE"
    ) {
      throw new CustomCoursesSyncTooLargeError();
    }
    throw err;
  }
}

function encodeGz(json: string): Buffer {
  const raw = Buffer.from(json, "utf8");
  if (raw.length > CUSTOM_COURSES_SYNC_LIMITS.maxRawBytes) {
    throw new CustomCoursesSyncTooLargeError();
  }
  const gz = gzipSync(raw, { level: 9 });
  if (gz.length > CUSTOM_COURSES_SYNC_LIMITS.maxGzBytes) {
    throw new CustomCoursesSyncTooLargeError();
  }
  return gz;
}

export type SyncCourse = {
  id: string;
  title: string;
  words: string[];
  createdAt: number;
  updatedAt: number;
};

export type CustomCoursesSyncDoc = {
  v: 1;
  courses: Record<string, SyncCourse>;
  deleted: Record<string, number>;
};

function emptyDoc(): CustomCoursesSyncDoc {
  return { v: 1, courses: {}, deleted: {} };
}

function clampTs(raw: unknown, fallback = 0): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, Date.now() + 60_000);
}

function normalizeWord(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const word = raw.trim();
  if (!word || word.length > 64) return null;
  return word;
}

function normalizeCourse(raw: unknown): SyncCourse | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  if (!CUSTOM_COURSE_ID_RE.test(id)) return null;
  const titleRaw = typeof item.title === "string" ? item.title.trim() : "";
  const title = (titleRaw || "自制词库").slice(0, CUSTOM_COURSES_SYNC_MAX_TITLE);
  const createdAt = clampTs(item.createdAt, Date.now());
  const updatedAt = Math.max(createdAt, clampTs(item.updatedAt, createdAt));
  const wordsIn = Array.isArray(item.words) ? item.words : [];
  const words: string[] = [];
  const seen = new Set<string>();
  for (const w of wordsIn) {
    if (words.length >= CUSTOM_COURSES_SYNC_MAX_WORDS) break;
    const word = normalizeWord(w);
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return { id, title, words, createdAt, updatedAt };
}

/** Parse + sanitize client/server snapshot. */
export function parseCustomCoursesSyncDoc(raw: unknown): CustomCoursesSyncDoc {
  const out = emptyDoc();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const root = raw as Record<string, unknown>;
  const coursesRaw = root.courses;
  if (coursesRaw && typeof coursesRaw === "object" && !Array.isArray(coursesRaw)) {
    for (const value of Object.values(coursesRaw as Record<string, unknown>)) {
      const course = normalizeCourse(value);
      if (!course) continue;
      out.courses[course.id] = course;
    }
  } else if (Array.isArray(coursesRaw)) {
    for (const value of coursesRaw) {
      const course = normalizeCourse(value);
      if (!course) continue;
      out.courses[course.id] = course;
    }
  }
  const deletedRaw = root.deleted;
  if (deletedRaw && typeof deletedRaw === "object" && !Array.isArray(deletedRaw)) {
    for (const [id, ts] of Object.entries(deletedRaw as Record<string, unknown>)) {
      if (!CUSTOM_COURSE_ID_RE.test(id)) continue;
      const at = clampTs(ts, 0);
      if (at > 0) out.deleted[id] = at;
    }
  }
  return trimToMaxLive(out);
}

function trimToMaxLive(doc: CustomCoursesSyncDoc): CustomCoursesSyncDoc {
  const live = Object.values(doc.courses).filter((c) => {
    const del = doc.deleted[c.id] ?? 0;
    return del <= c.updatedAt;
  });
  if (live.length <= CUSTOM_COURSES_SYNC_MAX_LIVE) {
    // Drop courses that are fully tombstoned from the live map.
    const next: Record<string, SyncCourse> = {};
    for (const c of live) next[c.id] = c;
    return { v: 1, courses: next, deleted: { ...doc.deleted } };
  }
  live.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);
  const keep = new Set(live.slice(0, CUSTOM_COURSES_SYNC_MAX_LIVE).map((c) => c.id));
  const nextCourses: Record<string, SyncCourse> = {};
  const nextDeleted = { ...doc.deleted };
  const now = Date.now();
  for (const c of live) {
    if (keep.has(c.id)) {
      nextCourses[c.id] = c;
    } else {
      nextDeleted[c.id] = Math.max(nextDeleted[c.id] ?? 0, c.updatedAt + 1, now);
    }
  }
  return { v: 1, courses: nextCourses, deleted: nextDeleted };
}

/**
 * Per-item LWW merge. Tombstone wins when deletedAt > course.updatedAt.
 */
export function mergeCustomCoursesSyncDocs(
  base: CustomCoursesSyncDoc,
  incoming: CustomCoursesSyncDoc,
): CustomCoursesSyncDoc {
  const ids = new Set([
    ...Object.keys(base.courses),
    ...Object.keys(incoming.courses),
    ...Object.keys(base.deleted),
    ...Object.keys(incoming.deleted),
  ]);
  const courses: Record<string, SyncCourse> = {};
  const deleted: Record<string, number> = {};

  for (const id of ids) {
    const a = base.courses[id];
    const b = incoming.courses[id];
    const delA = base.deleted[id] ?? 0;
    const delB = incoming.deleted[id] ?? 0;
    const delAt = Math.max(delA, delB);

    let winner: SyncCourse | null = null;
    if (a && b) {
      winner =
        b.updatedAt > a.updatedAt
          ? b
          : a.updatedAt > b.updatedAt
            ? a
            : b.createdAt >= a.createdAt
              ? b
              : a;
    } else {
      winner = b ?? a ?? null;
    }

    if (winner && delAt > winner.updatedAt) {
      deleted[id] = delAt;
      continue;
    }
    if (winner) {
      courses[id] = winner;
      if (delAt > 0 && delAt <= winner.updatedAt) {
        // course resurrected — drop stale tombstone
      } else if (delAt > 0) {
        deleted[id] = delAt;
      }
    } else if (delAt > 0) {
      deleted[id] = delAt;
    }
  }

  return trimToMaxLive({ v: 1, courses, deleted });
}

function docsEqual(a: CustomCoursesSyncDoc, b: CustomCoursesSyncDoc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type SyncRow = RowDataPacket & {
  rev: number;
  blob_gz: Buffer | null;
  updated_at: Date | string | null;
};

async function upsertEmptySyncRow(userId: number, appId: ClientAppId) {
  await execute(
    `INSERT INTO user_custom_courses_sync
       (user_id, app_id, schema_ver, rev, blob_gz, raw_bytes, gz_bytes,
        last_device_id, updated_at, created_at)
     VALUES (:userId, :appId, :ver, 0, NULL, 0, 0, NULL, NOW(), NOW())
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    { userId, appId, ver: CUSTOM_COURSES_SYNC_SCHEMA_VERSION },
  );
}

function decodeRowDoc(gz: Buffer | null): CustomCoursesSyncDoc {
  if (!gz || gz.length === 0) return emptyDoc();
  const json = gunzipCapped(gz);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return emptyDoc();
  }
  return parseCustomCoursesSyncDoc(parsed);
}

export type CustomCoursesSyncPull = {
  rev: number;
  unchanged: boolean;
  gz: Buffer | null;
  updatedAt: string | null;
};

export async function pullCustomCoursesSync(
  userId: number,
  appId: ClientAppId,
  knownRev: number | null,
): Promise<CustomCoursesSyncPull> {
  await ensureUserCustomCoursesSyncTable();
  const meta = await query<SyncRow[]>(
    `SELECT rev, updated_at FROM user_custom_courses_sync
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
    `SELECT rev, blob_gz, updated_at FROM user_custom_courses_sync
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

export type CustomCoursesSyncPush = {
  rev: number;
  unchanged: boolean;
  gz: Buffer | null;
  updatedAt: string | null;
};

/**
 * Merge incoming snapshot into cloud (LWW). Always accepts when logged in.
 * Returns the stored rev + gzip of merged doc when the client should adopt
 * (rev advanced or conflict-style refresh). `unchanged: true` means client
 * may keep its view and only update rev (merged equals what we stored and
 * matches a no-op or identical payload after merge).
 */
export async function pushCustomCoursesSync(input: {
  userId: number;
  appId: ClientAppId;
  baseRev: number;
  deviceId: string | null;
  snapshotGz: Buffer;
}): Promise<CustomCoursesSyncPush> {
  const json = gunzipCapped(input.snapshotGz);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SyntaxError("bad custom-courses json");
  }
  const incoming = parseCustomCoursesSyncDoc(parsed);

  await ensureUserCustomCoursesSyncTable();
  await upsertEmptySyncRow(input.userId, input.appId);

  return withTransaction(async () => {
    const rows = await query<SyncRow[]>(
      `SELECT rev, blob_gz, updated_at FROM user_custom_courses_sync
       WHERE user_id = :userId AND app_id = :appId
       FOR UPDATE`,
      { userId: input.userId, appId: input.appId },
    );
    const row = rows[0];
    const prevRev = row ? Number(row.rev) || 0 : 0;
    const prevGz =
      row?.blob_gz && row.blob_gz.length > 0 ? Buffer.from(row.blob_gz) : null;
    const prevUpdated = row ? toIso(row.updated_at) : null;
    const base = decodeRowDoc(prevGz);
    const merged = mergeCustomCoursesSyncDocs(base, incoming);
    const mergedJson = JSON.stringify(merged);
    const gz = encodeGz(mergedJson);
    const rawBytes = Buffer.byteLength(mergedJson, "utf8");

    if (prevGz && prevGz.equals(gz)) {
      return { rev: prevRev, unchanged: true, gz: null, updatedAt: prevUpdated };
    }

    // baseRev mismatch: still merge (LWW) so two devices editing different
    // banks do not lose work; return merged snapshot for client to adopt.
    const rev = prevRev + 1;
    await execute(
      `UPDATE user_custom_courses_sync
       SET schema_ver = :ver, rev = :rev, blob_gz = :blob,
           raw_bytes = :rawBytes, gz_bytes = :gzBytes,
           last_device_id = :deviceId, updated_at = NOW()
       WHERE user_id = :userId AND app_id = :appId`,
      {
        ver: CUSTOM_COURSES_SYNC_SCHEMA_VERSION,
        rev,
        blob: gz as unknown as string,
        rawBytes,
        gzBytes: gz.length,
        deviceId: input.deviceId,
        userId: input.userId,
        appId: input.appId,
      },
    );

    const clientMatched =
      input.baseRev === prevRev && docsEqual(incoming, merged);
    return {
      rev,
      unchanged: clientMatched,
      gz: clientMatched ? null : gz,
      updatedAt: new Date().toISOString(),
    };
  });
}
