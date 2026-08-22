import type { CoursePack, CoursePackSummary } from "@/data/course-types";
import { createUserCourseId, validateCoursePack } from "@/lib/course-validate";
import {
  countAllUserCourseSummaries,
  countSourceCourseRefs,
  deleteUserCourseSummary,
  getUserCourseLibraryEntry,
  listMyCourseSummaries,
  listPlazaCourseSummaries,
  listUserCourseSummariesFromDb,
  makeSourceCourseKey,
  parseSourceCourseKey,
  toCourseSummary,
  updateMyCourseMeta,
  upsertUserCourseSummary,
  viewerHasSourceCourse,
  type MyCoursesSort,
} from "@/lib/user-course-summaries-db";
import {
  r2Delete,
  r2GetText,
  r2ListKeys,
  r2Put,
  userCourseObjectKey,
  userCoursesPrefix,
} from "@/lib/r2";

const SAFE_ID = /^[a-z0-9-]+$/;

function assertSafeCourseId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error("课程 id 格式无效。");
  }
}

function displayAuthorName(user: {
  nickname: string | null;
  username: string;
}): string {
  const nick = user.nickname?.trim();
  return nick || user.username || "用户";
}

async function backfillSummariesFromR2(
  userId: number,
): Promise<CoursePackSummary[]> {
  const keys = await r2ListKeys(userCoursesPrefix(userId));
  const summaries: CoursePackSummary[] = [];

  for (const key of keys) {
    if (!key.endsWith(".json")) continue;
    try {
      const raw = await r2GetText(key);
      if (!raw) continue;
      const summary = toCourseSummary(validateCoursePack(JSON.parse(raw)));
      await upsertUserCourseSummary(userId, summary);
      summaries.push(summary);
    } catch {
      /* skip invalid objects */
    }
  }

  summaries.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  return summaries;
}

export async function listUserCourseSummariesForUser(
  userId: number,
): Promise<CoursePackSummary[]> {
  const fromDb = await listUserCourseSummariesFromDb(userId);
  if (fromDb.length > 0) {
    return fromDb.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  }

  // 库里已有记录（例如只有广场添加的课）时，不再回填 R2，避免把复制课又列出来
  const total = await countAllUserCourseSummaries(userId);
  if (total > 0) return [];

  const keys = await r2ListKeys(userCoursesPrefix(userId));
  const hasCourses = keys.some((key) => key.endsWith(".json"));
  if (!hasCourses) return [];

  const backfilled = await backfillSummariesFromR2(userId);
  return backfilled
    .filter((c) => !c.sourceCourseKey?.trim())
    .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
}

async function loadCourseJson(
  userId: number,
  id: string,
): Promise<CoursePack | null> {
  assertSafeCourseId(id);
  try {
    const raw = await r2GetText(userCourseObjectKey(userId, id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return validateCoursePack({ ...parsed, id });
  } catch {
    return null;
  }
}

function overlayLibraryTitle(
  pack: CoursePack,
  entry: {
    courseId: string;
    title: string;
    sourceCourseKey?: string;
    authorUserId?: number;
    authorName?: string;
  },
): CoursePack {
  const title = entry.title.trim() || pack.title;
  return validateCoursePack({
    ...pack,
    id: entry.courseId,
    title,
    ...(entry.authorUserId != null ? { authorUserId: entry.authorUserId } : {}),
    ...(entry.authorName ? { authorName: entry.authorName } : {}),
    ...(entry.sourceCourseKey
      ? { sourceCourseKey: entry.sourceCourseKey }
      : {}),
  });
}

export async function loadUserCourseForUser(
  userId: number,
  id: string,
): Promise<CoursePack | null> {
  assertSafeCourseId(id);
  const entry = await getUserCourseLibraryEntry(userId, id);
  const source = entry?.sourceCourseKey
    ? parseSourceCourseKey(entry.sourceCourseKey)
    : null;

  let pack: CoursePack | null = null;
  if (source) {
    pack = await loadCourseJson(source.ownerUserId, source.courseId);
  }
  if (!pack) {
    pack = await loadCourseJson(userId, id);
  }
  if (!pack) return null;
  return entry ? overlayLibraryTitle(pack, entry) : pack;
}

export async function saveUserCourseForUser(
  userId: number,
  pack: CoursePack,
): Promise<CoursePack> {
  const course = validateCoursePack(pack);
  assertSafeCourseId(course.id);

  const existing = await getUserCourseLibraryEntry(userId, course.id);
  if (existing?.sourceCourseKey?.trim()) {
    const title = course.title.trim().slice(0, 255);
    if (title && title !== existing.title) {
      await updateMyCourseMeta(userId, course.id, { title });
    }
    const loaded = await loadUserCourseForUser(userId, course.id);
    if (!loaded) throw new Error("课程不存在");
    return loaded;
  }

  const canonical = validateCoursePack({ ...course, sourceCourseKey: "" });
  await r2Put(
    userCourseObjectKey(userId, course.id),
    `${JSON.stringify(canonical, null, 2)}\n`,
    "application/json; charset=utf-8",
  );
  await upsertUserCourseSummary(userId, toCourseSummary(canonical));
  return canonical;
}

/** Mark course audio as ready (preview → normal). */
export async function markUserCourseAudioReady(
  userId: number,
  id: string,
): Promise<CoursePack | null> {
  const course = await loadUserCourseForUser(userId, id);
  if (!course) return null;
  if (course.audioReady === true) return course;
  if (course.sourceCourseKey?.trim()) return course;
  return saveUserCourseForUser(userId, { ...course, audioReady: true });
}

export async function deleteUserCourseForUser(
  userId: number,
  id: string,
): Promise<boolean> {
  assertSafeCourseId(id);
  const entry = await getUserCourseLibraryEntry(userId, id);
  const key = userCourseObjectKey(userId, id);
  const existingJson = await r2GetText(key);
  if (!entry && !existingJson) return false;

  if (entry?.sourceCourseKey?.trim()) {
    const sourceKey = entry.sourceCourseKey.trim();
    const source = parseSourceCourseKey(sourceKey);
    await deleteUserCourseSummary(userId, id);
    if (existingJson) {
      try {
        await r2Delete(key);
      } catch {
        /* leftover copy from the old per-user JSON model */
      }
    }
    if (source) {
      const refs = await countSourceCourseRefs(sourceKey);
      const ownerEntry = await getUserCourseLibraryEntry(
        source.ownerUserId,
        source.courseId,
      );
      const ownerKeepsOriginal = Boolean(
        ownerEntry && !ownerEntry.sourceCourseKey?.trim(),
      );
      if (refs === 0 && !ownerKeepsOriginal) {
        try {
          await r2Delete(
            userCourseObjectKey(source.ownerUserId, source.courseId),
          );
        } catch {
          /* canonical file may already be gone */
        }
      }
    }
    return true;
  }

  await deleteUserCourseSummary(userId, id);
  const refs = await countSourceCourseRefs(makeSourceCourseKey(userId, id));
  if (existingJson && refs === 0) {
    await r2Delete(key);
  }
  return true;
}

/** 批量删除自制课与广场添加的引用（同一用户库）。 */
export async function batchDeleteUserCoursesForUser(
  userId: number,
  ids: string[],
): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  for (const id of unique.slice(0, 100)) {
    try {
      assertSafeCourseId(id);
      await deleteUserCourseForUser(userId, id);
      deleted.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { deleted, failed };
}

export {
  listPlazaCourseSummaries,
  listMyCourseSummaries,
  updateMyCourseMeta,
};
export type { MyCoursesSort };

export class PlazaCopyError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlazaCopyError";
    this.status = status;
  }
}

/**
 * Add a shared plaza course to the viewer's library as a named pointer.
 * The canonical JSON stays at the author's R2 object; each user only stores
 * a summary row (optional custom title) that points at it.
 */
export async function copyPlazaCourseToUser(opts: {
  viewerId: number;
  ownerUserId: number;
  courseId: string;
  title?: string;
  owner: {
    nickname: string | null;
    username: string;
    shareCustomCourses: boolean;
  };
}): Promise<CoursePack> {
  const { viewerId, ownerUserId, courseId, owner } = opts;

  if (viewerId === ownerUserId) {
    throw new PlazaCopyError("不能添加自己的课程");
  }
  if (!owner.shareCustomCourses) {
    throw new PlazaCopyError("该用户未开启课程分享", 403);
  }

  assertSafeCourseId(courseId);
  const sourceKey = makeSourceCourseKey(ownerUserId, courseId);

  if (await viewerHasSourceCourse(viewerId, sourceKey)) {
    throw new PlazaCopyError("该课程已在你的自制课程中");
  }

  const source = await loadUserCourseForUser(ownerUserId, courseId);
  if (!source) {
    throw new PlazaCopyError("课程不存在或已删除", 404);
  }
  if (source.audioReady !== true) {
    throw new PlazaCopyError("该课程读音尚未就绪");
  }

  const authorName = displayAuthorName(owner);
  const newId = createUserCourseId(source.title);
  const linked: CoursePack = {
    ...source,
    id: newId,
    title: opts.title?.trim().slice(0, 255) || source.title,
    audioReady: true,
    authorUserId: ownerUserId,
    authorName,
    sourceCourseKey: sourceKey,
  };

  await upsertUserCourseSummary(viewerId, toCourseSummary(linked));
  return linked;
}
