import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import { PERMANENT_VIP_SQL, type SessionUser } from "@/lib/auth";

export type CategoryRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  accent_color: string | null;
  tint_color: string | null;
  sort_order: number;
  course_count?: number;
};

export type CourseRow = RowDataPacket & {
  id: number;
  category_id: number | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  difficulty: number | null;
  word_count: number;
  duration_minutes: number;
  download_url: string;
  r2_key: string | null;
  is_free: number;
  requires_vip: number;
  sort_order: number;
  unlocked?: number;
  category_slug?: string | null;
  category_title?: string | null;
};

export type CourseDto = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  difficulty: number | null;
  wordCount: number;
  durationMinutes: number;
  isFree: boolean;
  requiresVip: boolean;
  canDownload: boolean;
  categoryId: number | null;
  categorySlug: string | null;
};

export type CategoryDto = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  accentColor: string | null;
  tintColor: string | null;
  courseCount: number;
  courses: CourseDto[];
};

export function mapCourse(row: CourseRow, canDownload: boolean): CourseDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    level: row.level,
    difficulty: row.difficulty,
    wordCount: row.word_count,
    durationMinutes: row.duration_minutes,
    isFree: Boolean(row.is_free),
    requiresVip: Boolean(row.requires_vip),
    canDownload,
    categoryId: row.category_id,
    categorySlug: row.category_slug ?? null,
  };
}

export function userCanAccessCourse(_user: SessionUser | null, _row: CourseRow): boolean {
  // 课程下载对所有人开放，不需要登录或会员
  return true;
}

export async function listCategories(): Promise<CategoryRow[]> {
  return query<CategoryRow[]>(
    `SELECT id, slug, title, subtitle, description, accent_color, tint_color, sort_order
     FROM course_categories
     ORDER BY sort_order ASC, id ASC`,
  );
}

export async function listCoursesForUser(user: SessionUser | null): Promise<CourseDto[]> {
  if (!user) {
    const rows = await query<CourseRow[]>(
      `SELECT c.id, c.category_id, c.slug, c.title, c.description, c.level, c.difficulty,
              c.word_count, c.duration_minutes, c.download_url, c.r2_key, c.is_free,
              c.requires_vip, c.sort_order, cat.slug AS category_slug, cat.title AS category_title
       FROM courses c
       LEFT JOIN course_categories cat ON cat.id = c.category_id
       ORDER BY cat.sort_order ASC, c.sort_order ASC, c.id ASC`,
    );
    return rows.map((row) => mapCourse(row, true));
  }

  const rows = await query<CourseRow[]>(
    `SELECT c.id, c.category_id, c.slug, c.title, c.description, c.level, c.difficulty,
            c.word_count, c.duration_minutes, c.download_url, c.r2_key, c.is_free,
            c.requires_vip, c.sort_order, cat.slug AS category_slug, cat.title AS category_title,
            CASE WHEN uc.id IS NULL THEN 0 ELSE 1 END AS unlocked
     FROM courses c
     LEFT JOIN course_categories cat ON cat.id = c.category_id
     LEFT JOIN user_courses uc ON uc.course_id = c.id AND uc.user_id = :userId
     ORDER BY cat.sort_order ASC, c.sort_order ASC, c.id ASC`,
    { userId: user.id },
  );

  return rows.map((row) => mapCourse(row, true));
}

export async function listCoursesGroupedForUser(
  user: SessionUser | null,
): Promise<{ categories: CategoryDto[]; total: number }> {
  const [categories, courses] = await Promise.all([
    listCategories(),
    listCoursesForUser(user),
  ]);

  const byCategory = new Map<number, CourseDto[]>();
  for (const course of courses) {
    if (course.categoryId == null) continue;
    const list = byCategory.get(course.categoryId) ?? [];
    list.push(course);
    byCategory.set(course.categoryId, list);
  }

  const grouped: CategoryDto[] = categories
    .map((cat) => {
      const list = byCategory.get(cat.id) ?? [];
      return {
        id: cat.id,
        slug: cat.slug,
        title: cat.title,
        subtitle: cat.subtitle,
        description: cat.description,
        accentColor: cat.accent_color,
        tintColor: cat.tint_color,
        courseCount: list.length,
        courses: list,
      };
    })
    .filter((cat) => cat.courseCount > 0);

  return { categories: grouped, total: courses.length };
}

export async function getCourseById(id: number): Promise<CourseRow | null> {
  const rows = await query<CourseRow[]>(
    `SELECT id, category_id, slug, title, description, level, difficulty, word_count,
            duration_minutes, download_url, r2_key, is_free, requires_vip, sort_order
     FROM courses WHERE id = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

export async function getCourseAccess(
  user: SessionUser | null,
  courseId: number,
): Promise<CourseRow | null> {
  if (!user) {
    return getCourseById(courseId);
  }
  const rows = await query<CourseRow[]>(
    `SELECT c.id, c.category_id, c.slug, c.title, c.description, c.level, c.difficulty,
            c.word_count, c.duration_minutes, c.download_url, c.r2_key, c.is_free,
            c.requires_vip, c.sort_order,
            CASE WHEN uc.id IS NULL THEN 0 ELSE 1 END AS unlocked
     FROM courses c
     LEFT JOIN user_courses uc ON uc.course_id = c.id AND uc.user_id = :userId
     WHERE c.id = :courseId
     LIMIT 1`,
    { userId: user.id, courseId },
  );
  return rows[0] ?? null;
}

export async function unlockCourseForUser(userId: number, courseId: number) {
  await execute(
    `INSERT IGNORE INTO user_courses (user_id, course_id) VALUES (:userId, :courseId)`,
    { userId, courseId },
  );
}

export async function unlockAllCoursesForUser(userId: number) {
  await execute(
    `INSERT IGNORE INTO user_courses (user_id, course_id)
     SELECT :userId, id FROM courses`,
    { userId },
  );
}

export async function extendVip(userId: number, days: number) {
  await execute(
    `UPDATE users
     SET vip_expires_at = CASE
       WHEN vip_expires_at IS NOT NULL AND YEAR(vip_expires_at) >= 9999
         THEN vip_expires_at
       WHEN vip_expires_at IS NULL OR vip_expires_at < NOW()
         THEN DATE_ADD(NOW(), INTERVAL :days DAY)
       ELSE DATE_ADD(vip_expires_at, INTERVAL :days DAY)
     END
     WHERE id = :userId`,
    { userId, days },
  );
}

export async function setPermanentVip(userId: number) {
  await execute(
    `UPDATE users SET vip_expires_at = :expiresAt WHERE id = :userId`,
    { userId, expiresAt: PERMANENT_VIP_SQL },
  );
}
