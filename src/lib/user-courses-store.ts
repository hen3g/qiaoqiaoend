import type { CoursePack, CoursePackSummary } from "@/data/course-types";
import { createUserCourseId, validateCoursePack } from "@/lib/course-validate";
import {
  deleteUserCourseSummary,
  listPlazaCourseSummaries,
  listUserCourseSummariesFromDb,
  makeSourceCourseKey,
  toCourseSummary,
  upsertUserCourseSummary,
  viewerHasSourceCourse,
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

  const keys = await r2ListKeys(userCoursesPrefix(userId));
  const hasCourses = keys.some((key) => key.endsWith(".json"));
  if (!hasCourses) return [];

  return backfillSummariesFromR2(userId);
}

export async function loadUserCourseForUser(
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

export async function saveUserCourseForUser(
  userId: number,
  pack: CoursePack,
): Promise<CoursePack> {
  const course = validateCoursePack(pack);
  assertSafeCourseId(course.id);
  await r2Put(
    userCourseObjectKey(userId, course.id),
    `${JSON.stringify(course, null, 2)}\n`,
    "application/json; charset=utf-8",
  );
  await upsertUserCourseSummary(userId, toCourseSummary(course));
  return course;
}

/** Mark course audio as ready (preview → normal). */
export async function markUserCourseAudioReady(
  userId: number,
  id: string,
): Promise<CoursePack | null> {
  const course = await loadUserCourseForUser(userId, id);
  if (!course) return null;
  if (course.audioReady === true) return course;
  return saveUserCourseForUser(userId, { ...course, audioReady: true });
}

export async function deleteUserCourseForUser(
  userId: number,
  id: string,
): Promise<boolean> {
  assertSafeCourseId(id);
  const key = userCourseObjectKey(userId, id);
  const existing = await r2GetText(key);
  if (!existing) {
    await deleteUserCourseSummary(userId, id);
    return false;
  }
  await r2Delete(key);
  await deleteUserCourseSummary(userId, id);
  return true;
}

export { listPlazaCourseSummaries };

export class PlazaCopyError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlazaCopyError";
    this.status = status;
  }
}

/**
 * Copy a shared custom course into the viewer's library.
 * Audio is content-addressed, so copied JSON keeps working without re-TTS.
 */
export async function copyPlazaCourseToUser(opts: {
  viewerId: number;
  ownerUserId: number;
  courseId: string;
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
  const copied: CoursePack = {
    ...source,
    id: newId,
    audioReady: true,
    authorUserId: ownerUserId,
    authorName,
    sourceCourseKey: sourceKey,
  };

  return saveUserCourseForUser(viewerId, copied);
}
