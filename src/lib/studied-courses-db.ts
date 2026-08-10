import type { RowDataPacket } from "mysql2";

import { execute, query } from "@/lib/db";

export type StudiedCourse = {
  packId: string;
  packTitle: string;
  firstStudiedAt: string;
  lastStudiedAt: string;
};

type StudiedRow = RowDataPacket & {
  pack_id: string;
  pack_title: string;
  first_studied_at: Date | string;
  last_studied_at: Date | string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function rowToCourse(row: StudiedRow): StudiedCourse {
  return {
    packId: row.pack_id,
    packTitle: row.pack_title,
    firstStudiedAt: toIso(row.first_studied_at),
    lastStudiedAt: toIso(row.last_studied_at),
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 12;
  return Math.min(50, Math.max(1, Math.floor(limit)));
}

export async function listStudiedCourses(
  userId: number,
  options?: { limit?: number; prefix?: string },
): Promise<StudiedCourse[]> {
  const limit = clampLimit(options?.limit);
  const prefix =
    typeof options?.prefix === "string" && options.prefix.length > 0
      ? options.prefix
      : null;

  const rows = prefix
    ? await query<StudiedRow[]>(
        `SELECT pack_id, pack_title, first_studied_at, last_studied_at
         FROM user_studied_courses
         WHERE user_id = :userId AND pack_id LIKE :prefixPattern
         ORDER BY last_studied_at DESC
         LIMIT ${limit}`,
        { userId, prefixPattern: `${prefix}%` },
      )
    : await query<StudiedRow[]>(
        `SELECT pack_id, pack_title, first_studied_at, last_studied_at
         FROM user_studied_courses
         WHERE user_id = :userId
         ORDER BY last_studied_at DESC
         LIMIT ${limit}`,
        { userId },
      );

  return rows.map(rowToCourse);
}

export async function upsertStudiedCourse(
  userId: number,
  packId: string,
  packTitle: string,
): Promise<void> {
  const id = packId.trim();
  const title = packTitle.trim();
  if (!id) throw new Error("packId 无效");
  if (!title) throw new Error("packTitle 无效");

  await execute(
    `INSERT INTO user_studied_courses
       (user_id, pack_id, pack_title, first_studied_at, last_studied_at)
     VALUES
       (:userId, :packId, :packTitle, UTC_TIMESTAMP(), UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       pack_title = VALUES(pack_title),
       last_studied_at = UTC_TIMESTAMP()`,
    { userId, packId: id, packTitle: title.slice(0, 255) },
  );
}
