import type {
  CourseDifficulty,
  CoursePack,
  CoursePackSummary,
  MyCourseSummary,
  PlazaCourseSummary,
} from "@/data/course-types";
import { isPracticeMode } from "@/data/practice-modes";
import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import { ensureShareCustomCoursesColumn } from "@/lib/user-schema";

type SummaryRow = RowDataPacket & {
  course_id: string;
  series_id: string | null;
  series_order: number | null;
  title: string;
  description: string;
  difficulty: number;
  duration_minutes: number;
  word_count: number;
  exercise_count: number;
  lesson_count: number;
  stage: string | null;
  practice_mode: string | null;
  is_user_created: number | boolean;
  audio_ready?: number | boolean | null;
  author_user_id?: number | null;
  author_name?: string | null;
  source_course_key?: string | null;
  note?: string | null;
  group_id?: number | null;
  group_name?: string | null;
  updated_at?: Date | string | null;
};

type PlazaRow = SummaryRow & {
  user_id: number;
  owner_nickname: string | null;
  owner_username: string;
  owner_avatar_url: string | null;
};

let audioReadyEnsured = false;
let authorColsEnsured = false;

/** Ensure user_course_summaries.audio_ready exists. */
export async function ensureAudioReadyColumn(): Promise<void> {
  if (audioReadyEnsured) return;
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_course_summaries LIKE 'audio_ready'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE user_course_summaries
       ADD COLUMN audio_ready TINYINT(1) NOT NULL DEFAULT 1
       AFTER is_user_created`,
    );
  }
  audioReadyEnsured = true;
}

/** Ensure author / source columns for plaza copies. */
export async function ensureAuthorColumns(): Promise<void> {
  if (authorColsEnsured) return;
  await ensureAudioReadyColumn();
  type ColRow = RowDataPacket & { Field: string };

  const authorUser = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_course_summaries LIKE 'author_user_id'`,
  );
  if (authorUser.length === 0) {
    await execute(
      `ALTER TABLE user_course_summaries
       ADD COLUMN author_user_id BIGINT NULL AFTER audio_ready`,
    );
  }

  const authorName = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_course_summaries LIKE 'author_name'`,
  );
  if (authorName.length === 0) {
    await execute(
      `ALTER TABLE user_course_summaries
       ADD COLUMN author_name VARCHAR(64) NULL AFTER author_user_id`,
    );
  }

  const sourceKey = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_course_summaries LIKE 'source_course_key'`,
  );
  if (sourceKey.length === 0) {
    await execute(
      `ALTER TABLE user_course_summaries
       ADD COLUMN source_course_key VARCHAR(192) NULL AFTER author_name`,
    );
  }

  authorColsEnsured = true;
}

let myCourseMetaEnsured = false;

/** Ensure note / group_id columns for 我的课程. */
export async function ensureMyCourseMetaColumns(): Promise<void> {
  if (myCourseMetaEnsured) return;
  await ensureAuthorColumns();

  await execute(`
    CREATE TABLE IF NOT EXISTS user_course_groups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      name VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_course_groups_user (user_id),
      KEY idx_user_course_groups_user_sort (user_id, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  type ColRow = RowDataPacket & { Field: string };

  const noteCol = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_course_summaries LIKE 'note'`,
  );
  if (noteCol.length === 0) {
    await execute(
      `ALTER TABLE user_course_summaries
       ADD COLUMN note VARCHAR(500) NULL AFTER source_course_key`,
    );
  }

  const groupCol = await query<ColRow[]>(
    `SHOW COLUMNS FROM user_course_summaries LIKE 'group_id'`,
  );
  if (groupCol.length === 0) {
    await execute(
      `ALTER TABLE user_course_summaries
       ADD COLUMN group_id BIGINT UNSIGNED NULL AFTER note`,
    );
  }

  type IndexRow = RowDataPacket & { Key_name: string };
  const indexes = await query<IndexRow[]>(
    `SHOW INDEX FROM user_course_summaries WHERE Key_name = 'idx_user_group'`,
  );
  if (indexes.length === 0) {
    await execute(
      `ALTER TABLE user_course_summaries
       ADD KEY idx_user_group (user_id, group_id)`,
    );
  }

  myCourseMetaEnsured = true;
}

function toDifficulty(value: unknown): CourseDifficulty {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return 1;
}

function authorFields(row: {
  author_user_id?: number | null;
  author_name?: string | null;
  source_course_key?: string | null;
}): Pick<
  CoursePackSummary,
  "authorUserId" | "authorName" | "sourceCourseKey"
> {
  const authorUserId =
    row.author_user_id != null && Number(row.author_user_id) > 0
      ? Number(row.author_user_id)
      : undefined;
  const authorName =
    typeof row.author_name === "string" && row.author_name.trim()
      ? row.author_name.trim()
      : undefined;
  const sourceCourseKey =
    typeof row.source_course_key === "string" && row.source_course_key.trim()
      ? row.source_course_key.trim()
      : undefined;
  return {
    ...(authorUserId != null ? { authorUserId } : {}),
    ...(authorName ? { authorName } : {}),
    ...(sourceCourseKey ? { sourceCourseKey } : {}),
  };
}

function rowToSummary(row: SummaryRow): CoursePackSummary {
  return {
    id: row.course_id,
    ...(row.series_id ? { seriesId: row.series_id } : {}),
    ...(row.series_order != null
      ? { seriesOrder: Number(row.series_order) }
      : {}),
    title: row.title,
    description: row.description,
    difficulty: toDifficulty(row.difficulty),
    durationMinutes: Number(row.duration_minutes) || 0,
    wordCount: Number(row.word_count) || 0,
    exerciseCount: Number(row.exercise_count) || 0,
    lessonCount: Number(row.lesson_count) || 0,
    ...(row.stage ? { stage: row.stage } : {}),
    ...(row.practice_mode && isPracticeMode(row.practice_mode)
      ? { practiceMode: row.practice_mode }
      : {}),
    isUserCreated: Boolean(row.is_user_created),
    audioReady: Boolean(row.audio_ready),
    ...authorFields(row),
  };
}

export function toCourseSummary(
  pack: CoursePack | CoursePackSummary,
): CoursePackSummary {
  if (!("lessons" in pack) || !Array.isArray(pack.lessons)) {
    const summary = pack as CoursePackSummary;
    return {
      id: summary.id,
      ...(summary.seriesId ? { seriesId: summary.seriesId } : {}),
      ...(summary.seriesOrder ? { seriesOrder: summary.seriesOrder } : {}),
      title: summary.title,
      description: summary.description,
      difficulty: summary.difficulty,
      durationMinutes: summary.durationMinutes,
      wordCount: summary.wordCount ?? 0,
      exerciseCount: summary.exerciseCount ?? 0,
      lessonCount: summary.lessonCount ?? 0,
      ...(summary.stage ? { stage: summary.stage } : {}),
      ...(summary.practiceMode ? { practiceMode: summary.practiceMode } : {}),
      isUserCreated: summary.isUserCreated ?? true,
      audioReady: summary.audioReady === true,
      ...(summary.authorUserId != null
        ? { authorUserId: summary.authorUserId }
        : {}),
      ...(summary.authorName ? { authorName: summary.authorName } : {}),
      ...(summary.sourceCourseKey
        ? { sourceCourseKey: summary.sourceCourseKey }
        : {}),
    };
  }

  const wordIds = new Set<string>();
  let exerciseCount = 0;
  for (const lesson of pack.lessons) {
    for (const w of lesson.words) wordIds.add(w.id);
    exerciseCount += lesson.sentences.length;
  }
  const stage =
    pack.stage === undefined || pack.stage === null || pack.stage === ""
      ? undefined
      : String(pack.stage).trim() || undefined;
  return {
    id: pack.id,
    ...(pack.seriesId ? { seriesId: pack.seriesId } : {}),
    ...(pack.seriesOrder ? { seriesOrder: pack.seriesOrder } : {}),
    title: pack.title,
    description: pack.description,
    difficulty: pack.difficulty,
    durationMinutes: pack.durationMinutes,
    wordCount: wordIds.size,
    exerciseCount,
    lessonCount: pack.lessons.length,
    ...(stage ? { stage } : {}),
    ...(pack.practiceMode ? { practiceMode: pack.practiceMode } : {}),
    isUserCreated: true,
    audioReady: pack.audioReady === true,
    ...(pack.authorUserId != null ? { authorUserId: pack.authorUserId } : {}),
    ...(pack.authorName ? { authorName: pack.authorName } : {}),
    ...(pack.sourceCourseKey
      ? { sourceCourseKey: pack.sourceCourseKey }
      : {}),
  };
}

export function makeSourceCourseKey(
  ownerUserId: number,
  courseId: string,
): string {
  return `${ownerUserId}:${courseId}`;
}

export function parseSourceCourseKey(
  key: string,
): { ownerUserId: number; courseId: string } | null {
  const trimmed = key.trim();
  const idx = trimmed.indexOf(":");
  if (idx <= 0) return null;
  const ownerUserId = Number(trimmed.slice(0, idx));
  const courseId = trimmed.slice(idx + 1).trim();
  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0 || !courseId) {
    return null;
  }
  return { ownerUserId, courseId };
}

export type UserCourseLibraryEntry = {
  courseId: string;
  title: string;
  sourceCourseKey?: string;
  authorUserId?: number;
  authorName?: string;
};

export async function getUserCourseLibraryEntry(
  userId: number,
  courseId: string,
): Promise<UserCourseLibraryEntry | null> {
  await ensureAuthorColumns();
  const rows = await query<SummaryRow[]>(
    `SELECT course_id, title, author_user_id, author_name, source_course_key
     FROM user_course_summaries
     WHERE user_id = :userId AND course_id = :courseId
     LIMIT 1`,
    { userId, courseId },
  );
  const row = rows[0];
  if (!row) return null;
  const authors = authorFields(row);
  return {
    courseId: row.course_id,
    title: typeof row.title === "string" ? row.title : "",
    ...authors,
  };
}

export async function countSourceCourseRefs(
  sourceCourseKey: string,
): Promise<number> {
  await ensureAuthorColumns();
  const rows = await query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c FROM user_course_summaries
     WHERE source_course_key = :sourceKey`,
    { sourceKey: sourceCourseKey },
  );
  return Number(rows[0]?.c ?? 0);
}

export async function listUserCourseSummariesFromDb(
  userId: number,
): Promise<CoursePackSummary[]> {
  await ensureAuthorColumns();
  const rows = await query<SummaryRow[]>(
    `SELECT course_id, series_id, series_order, title, description, difficulty,
            duration_minutes, word_count, exercise_count, lesson_count,
            stage, practice_mode, is_user_created, audio_ready,
            author_user_id, author_name, source_course_key
     FROM user_course_summaries
     WHERE user_id = :userId
       AND (source_course_key IS NULL OR source_course_key = '')
     ORDER BY title ASC`,
    { userId },
  );
  return rows.map(rowToSummary);
}

async function countUserCourseSummaries(userId: number): Promise<number> {
  await ensureAuthorColumns();
  const rows = await query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c FROM user_course_summaries WHERE user_id = :userId`,
    { userId },
  );
  return Number(rows[0]?.c ?? 0);
}

export async function countAllUserCourseSummaries(
  userId: number,
): Promise<number> {
  return countUserCourseSummaries(userId);
}

export async function upsertUserCourseSummary(
  userId: number,
  summary: CoursePackSummary,
): Promise<void> {
  await ensureAuthorColumns();
  const title = summary.title.trim().slice(0, 255) || summary.id;

  await execute(
    `INSERT INTO user_course_summaries
       (user_id, course_id, series_id, series_order, title, description,
        difficulty, duration_minutes, word_count, exercise_count, lesson_count,
        stage, practice_mode, is_user_created, audio_ready,
        author_user_id, author_name, source_course_key, updated_at)
     VALUES
       (:userId, :courseId, :seriesId, :seriesOrder, :title, :description,
        :difficulty, :durationMinutes, :wordCount, :exerciseCount, :lessonCount,
        :stage, :practiceMode, :isUserCreated, :audioReady,
        :authorUserId, :authorName, :sourceCourseKey, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       series_id = VALUES(series_id),
       series_order = VALUES(series_order),
       title = VALUES(title),
       description = VALUES(description),
       difficulty = VALUES(difficulty),
       duration_minutes = VALUES(duration_minutes),
       word_count = VALUES(word_count),
       exercise_count = VALUES(exercise_count),
       lesson_count = VALUES(lesson_count),
       stage = VALUES(stage),
       practice_mode = VALUES(practice_mode),
       is_user_created = VALUES(is_user_created),
       audio_ready = VALUES(audio_ready),
       author_user_id = VALUES(author_user_id),
       author_name = VALUES(author_name),
       source_course_key = VALUES(source_course_key),
       updated_at = UTC_TIMESTAMP()`,
    {
      userId,
      courseId: summary.id,
      seriesId: summary.seriesId ?? null,
      seriesOrder: summary.seriesOrder ?? null,
      title,
      description: summary.description ?? "",
      difficulty: toDifficulty(summary.difficulty),
      durationMinutes: summary.durationMinutes ?? 0,
      wordCount: summary.wordCount ?? 0,
      exerciseCount: summary.exerciseCount ?? 0,
      lessonCount: summary.lessonCount ?? 0,
      stage: summary.stage ?? null,
      practiceMode: summary.practiceMode ?? null,
      isUserCreated: summary.isUserCreated === false ? 0 : 1,
      audioReady: summary.audioReady === true ? 1 : 0,
      authorUserId: summary.authorUserId ?? null,
      authorName: summary.authorName?.trim().slice(0, 64) || null,
      sourceCourseKey: summary.sourceCourseKey?.trim().slice(0, 192) || null,
    },
  );
}

export async function deleteUserCourseSummary(
  userId: number,
  courseId: string,
): Promise<void> {
  await execute(
    `DELETE FROM user_course_summaries
     WHERE user_id = :userId AND course_id = :courseId`,
    { userId, courseId },
  );
}

export async function viewerHasSourceCourse(
  viewerId: number,
  sourceCourseKey: string,
): Promise<boolean> {
  await ensureAuthorColumns();
  const rows = await query<RowDataPacket[]>(
    `SELECT course_id FROM user_course_summaries
     WHERE user_id = :viewerId AND source_course_key = :sourceKey
     LIMIT 1`,
    { viewerId, sourceKey: sourceCourseKey },
  );
  return rows.length > 0;
}

export const PLAZA_PAGE_SIZE = 20;

export type PlazaCoursesPage = {
  courses: PlazaCourseSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export async function listPlazaCourseSummaries(opts: {
  viewerId: number;
  page?: number;
  q?: string;
  /** 仅看某一创作者分享的课程 */
  authorId?: number;
  /** added = 仅看当前用户已从广场添加的课程 */
  filter?: "added";
}): Promise<PlazaCoursesPage> {
  await ensureAuthorColumns();
  await ensureShareCustomCoursesColumn();

  const pageSize = PLAZA_PAGE_SIZE;
  const safePage =
    Number.isInteger(opts.page) && (opts.page ?? 0) > 0 ? Number(opts.page) : 1;
  const offset = (safePage - 1) * pageSize;
  const q = opts.q?.trim().slice(0, 64) || "";
  const like = q ? `%${q.replace(/[%_\\]/g, "")}%` : "";
  const authorId =
    Number.isInteger(opts.authorId) && (opts.authorId ?? 0) > 0
      ? Number(opts.authorId)
      : null;
  const onlyAdded = opts.filter === "added";

  const where = `s.audio_ready = 1
       AND u.share_custom_courses = 1
       AND (s.source_course_key IS NULL OR s.source_course_key = '')
       ${authorId != null ? `AND s.user_id = :authorId` : ""}
       ${
         onlyAdded
           ? `AND EXISTS (
                SELECT 1 FROM user_course_summaries v
                WHERE v.user_id = :viewerId
                  AND v.source_course_key = CONCAT(s.user_id, ':', s.course_id)
              )`
           : ""
       }
       ${
         like
           ? authorId != null
             ? `AND s.title LIKE :like`
             : `AND (
                s.title LIKE :like
                OR IFNULL(u.nickname, '') LIKE :like
                OR u.username LIKE :like
              )`
           : ""
       }`;
  const params: Record<string, string | number> | undefined =
    authorId != null || like || onlyAdded
      ? {
          ...(onlyAdded ? { viewerId: opts.viewerId } : {}),
          ...(authorId != null ? { authorId } : {}),
          ...(like ? { like } : {}),
        }
      : undefined;

  const countRows = await query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c
     FROM user_course_summaries s
     INNER JOIN users u ON u.id = s.user_id
     WHERE ${where}`,
    params,
  );
  const total = Number(countRows[0]?.c ?? 0);

  const rows = await query<PlazaRow[]>(
    `SELECT s.user_id, s.course_id, s.series_id, s.series_order, s.title,
            s.description, s.difficulty, s.duration_minutes, s.word_count,
            s.exercise_count, s.lesson_count, s.stage, s.practice_mode,
            s.is_user_created, s.audio_ready, s.author_user_id, s.author_name,
            s.source_course_key,
            u.nickname AS owner_nickname, u.username AS owner_username,
            u.avatar_url AS owner_avatar_url
     FROM user_course_summaries s
     INNER JOIN users u ON u.id = s.user_id
     WHERE ${where}
     ORDER BY s.updated_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );

  const addedMap = new Map<string, string>();
  if (rows.length > 0) {
    const owned = await query<
      (RowDataPacket & { course_id: string; source_course_key: string })[]
    >(
      `SELECT course_id, source_course_key FROM user_course_summaries
       WHERE user_id = :viewerId
         AND source_course_key IS NOT NULL
         AND source_course_key <> ''`,
      { viewerId: opts.viewerId },
    );
    for (const row of owned) {
      if (row.source_course_key && row.course_id) {
        addedMap.set(row.source_course_key, row.course_id);
      }
    }
  }

  const courses = rows.map((row) => {
    const ownerUserId = Number(row.user_id);
    const sourceKey = makeSourceCourseKey(ownerUserId, row.course_id);
    const authorName =
      (typeof row.owner_nickname === "string" && row.owner_nickname.trim()
        ? row.owner_nickname.trim()
        : null) ||
      row.owner_username ||
      "用户";
    const authorAvatarUrl =
      typeof row.owner_avatar_url === "string" && row.owner_avatar_url.trim()
        ? row.owner_avatar_url.trim()
        : null;
    const base = rowToSummary(row);
    const isMine = ownerUserId === opts.viewerId;
    const copiedId = addedMap.get(sourceKey);
    return {
      ...base,
      ownerUserId,
      authorUserId: ownerUserId,
      authorName,
      authorAvatarUrl,
      sourceCourseKey: sourceKey,
      alreadyAdded: isMine || Boolean(copiedId),
      ...(isMine
        ? { myCourseId: base.id }
        : copiedId
          ? { myCourseId: copiedId }
          : {}),
    };
  });

  return {
    courses,
    total,
    page: safePage,
    pageSize,
    hasMore: safePage * pageSize < total,
  };
}

export const MY_COURSES_PAGE_SIZE = 20;

export type MyCoursesSort =
  | "updated_desc"
  | "updated_asc"
  | "title_asc"
  | "title_desc";

export type MyCoursesPage = {
  courses: MyCourseSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

type MineRow = SummaryRow & {
  group_name?: string | null;
  updated_at?: Date | string | null;
};

function rowToMyCourse(row: MineRow): MyCourseSummary {
  const base = rowToSummary(row);
  const note =
    typeof row.note === "string" && row.note.trim() ? row.note.trim() : "";
  const groupId =
    row.group_id != null && Number(row.group_id) > 0
      ? Number(row.group_id)
      : null;
  const groupName =
    typeof row.group_name === "string" && row.group_name.trim()
      ? row.group_name.trim()
      : null;
  const fromPlaza = Boolean(
    typeof row.source_course_key === "string" && row.source_course_key.trim(),
  );
  let updatedAt: string | undefined;
  if (row.updated_at instanceof Date) {
    updatedAt = row.updated_at.toISOString();
  } else if (typeof row.updated_at === "string" && row.updated_at.trim()) {
    updatedAt = row.updated_at.trim();
  }
  return {
    ...base,
    note,
    groupId,
    groupName,
    fromPlaza,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function sortSql(sort: MyCoursesSort): string {
  switch (sort) {
    case "updated_asc":
      return "s.updated_at ASC, s.course_id ASC";
    case "title_asc":
      return "s.title ASC, s.course_id ASC";
    case "title_desc":
      return "s.title DESC, s.course_id ASC";
    case "updated_desc":
    default:
      return "s.updated_at DESC, s.course_id ASC";
  }
}

/**
 * 我的课程：当前用户全部自制课 + 广场添加的引用。
 * 支持分页、按标题/备注搜索、按分组筛选、排序。
 */
export async function listMyCourseSummaries(opts: {
  userId: number;
  page?: number;
  q?: string;
  /** 指定分组；`ungrouped` = 未分组 */
  groupId?: number | "ungrouped";
  sort?: MyCoursesSort;
}): Promise<MyCoursesPage> {
  await ensureMyCourseMetaColumns();

  const pageSize = MY_COURSES_PAGE_SIZE;
  const safePage =
    Number.isInteger(opts.page) && (opts.page ?? 0) > 0 ? Number(opts.page) : 1;
  const offset = (safePage - 1) * pageSize;
  const q = opts.q?.trim().slice(0, 64) || "";
  const like = q ? `%${q.replace(/[%_\\]/g, "")}%` : "";
  const sort = opts.sort ?? "updated_desc";

  const whereParts = ["s.user_id = :userId"];
  const params: Record<string, string | number> = { userId: opts.userId };

  if (opts.groupId === "ungrouped") {
    whereParts.push("(s.group_id IS NULL OR s.group_id = 0)");
  } else if (
    typeof opts.groupId === "number" &&
    Number.isInteger(opts.groupId) &&
    opts.groupId > 0
  ) {
    whereParts.push("s.group_id = :groupId");
    params.groupId = opts.groupId;
  }

  if (like) {
    whereParts.push(
      "(s.title LIKE :like OR IFNULL(s.note, '') LIKE :like)",
    );
    params.like = like;
  }

  const where = whereParts.join(" AND ");

  const countRows = await query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c
     FROM user_course_summaries s
     WHERE ${where}`,
    params,
  );
  const total = Number(countRows[0]?.c ?? 0);

  const rows = await query<MineRow[]>(
    `SELECT s.course_id, s.series_id, s.series_order, s.title, s.description,
            s.difficulty, s.duration_minutes, s.word_count, s.exercise_count,
            s.lesson_count, s.stage, s.practice_mode, s.is_user_created,
            s.audio_ready, s.author_user_id, s.author_name, s.source_course_key,
            s.note, s.group_id, s.updated_at,
            g.name AS group_name
     FROM user_course_summaries s
     LEFT JOIN user_course_groups g
       ON g.id = s.group_id AND g.user_id = s.user_id
     WHERE ${where}
     ORDER BY ${sortSql(sort)}
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );

  return {
    courses: rows.map(rowToMyCourse),
    total,
    page: safePage,
    pageSize,
    hasMore: safePage * pageSize < total,
  };
}

export async function updateMyCourseMeta(
  userId: number,
  courseId: string,
  patch: {
    title?: string;
    note?: string | null;
    groupId?: number | null;
  },
): Promise<MyCourseSummary | null> {
  await ensureMyCourseMetaColumns();

  const existing = await query<MineRow[]>(
    `SELECT s.course_id, s.series_id, s.series_order, s.title, s.description,
            s.difficulty, s.duration_minutes, s.word_count, s.exercise_count,
            s.lesson_count, s.stage, s.practice_mode, s.is_user_created,
            s.audio_ready, s.author_user_id, s.author_name, s.source_course_key,
            s.note, s.group_id, s.updated_at,
            g.name AS group_name
     FROM user_course_summaries s
     LEFT JOIN user_course_groups g
       ON g.id = s.group_id AND g.user_id = s.user_id
     WHERE s.user_id = :userId AND s.course_id = :courseId
     LIMIT 1`,
    { userId, courseId },
  );
  if (!existing[0]) return null;

  const sets: string[] = [];
  const params: Record<string, string | number | null> = {
    userId,
    courseId,
  };

  if ("title" in patch) {
    const title = String(patch.title ?? "").trim().slice(0, 255);
    if (!title) {
      throw new Error("课程名称不能为空");
    }
    sets.push("title = :title");
    params.title = title;
  }

  if ("note" in patch) {
    const note =
      patch.note == null
        ? null
        : String(patch.note).trim().slice(0, 500) || null;
    sets.push("note = :note");
    params.note = note;
  }

  if ("groupId" in patch) {
    const groupId =
      patch.groupId == null ||
      !Number.isInteger(patch.groupId) ||
      patch.groupId <= 0
        ? null
        : Number(patch.groupId);
    if (groupId != null) {
      const groupRows = await query<RowDataPacket[]>(
        `SELECT id FROM user_course_groups
         WHERE user_id = :userId AND id = :groupId
         LIMIT 1`,
        { userId, groupId },
      );
      if (groupRows.length === 0) {
        throw new Error("分组不存在");
      }
    }
    sets.push("group_id = :groupId");
    params.groupId = groupId;
  }

  if (sets.length === 0) {
    return rowToMyCourse(existing[0]);
  }

  await execute(
    `UPDATE user_course_summaries
     SET ${sets.join(", ")}
     WHERE user_id = :userId AND course_id = :courseId`,
    params,
  );

  const updated = await query<MineRow[]>(
    `SELECT s.course_id, s.series_id, s.series_order, s.title, s.description,
            s.difficulty, s.duration_minutes, s.word_count, s.exercise_count,
            s.lesson_count, s.stage, s.practice_mode, s.is_user_created,
            s.audio_ready, s.author_user_id, s.author_name, s.source_course_key,
            s.note, s.group_id, s.updated_at,
            g.name AS group_name
     FROM user_course_summaries s
     LEFT JOIN user_course_groups g
       ON g.id = s.group_id AND g.user_id = s.user_id
     WHERE s.user_id = :userId AND s.course_id = :courseId
     LIMIT 1`,
    { userId, courseId },
  );
  return updated[0] ? rowToMyCourse(updated[0]) : null;
}
