import type {
  CourseDifficulty,
  CoursePack,
  CoursePackSummary,
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
     ORDER BY title ASC`,
    { userId },
  );
  return rows.map(rowToSummary);
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

  const where = `s.audio_ready = 1
       AND u.share_custom_courses = 1
       AND (s.source_course_key IS NULL OR s.source_course_key = '')
       ${authorId != null ? `AND s.user_id = :authorId` : ""}
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
    authorId != null || like
      ? {
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

  const added = new Set<string>();
  if (rows.length > 0) {
    const owned = await query<(RowDataPacket & { source_course_key: string })[]>(
      `SELECT source_course_key FROM user_course_summaries
       WHERE user_id = :viewerId
         AND source_course_key IS NOT NULL
         AND source_course_key <> ''`,
      { viewerId: opts.viewerId },
    );
    for (const row of owned) {
      if (row.source_course_key) added.add(row.source_course_key);
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
    return {
      ...base,
      ownerUserId,
      authorUserId: ownerUserId,
      authorName,
      authorAvatarUrl,
      sourceCourseKey: sourceKey,
      alreadyAdded: isMine || added.has(sourceKey),
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
