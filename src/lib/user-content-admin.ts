import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";

export type AdminUserCourse = {
  userId: number;
  username: string | null;
  nickname: string | null;
  courseId: string;
  title: string;
  difficulty: number;
  wordCount: number;
  lessonCount: number;
  isUserCreated: boolean;
  updatedAt: string | null;
};

export type AdminUserPaper = {
  userId: number;
  username: string | null;
  nickname: string | null;
  paperId: string;
  title: string;
  wordCount: number;
  questionCount: number;
  discardedQuestionCount: number;
  updatedAt: string | null;
};

type CourseRow = RowDataPacket & {
  user_id: number;
  username: string | null;
  nickname: string | null;
  course_id: string;
  title: string;
  difficulty: number;
  word_count: number;
  lesson_count: number;
  is_user_created: number | boolean;
  updated_at: string | Date | null;
};

type PaperRow = RowDataPacket & {
  user_id: number;
  username: string | null;
  nickname: string | null;
  paper_id: string;
  title: string;
  word_count: number;
  question_count: number;
  discarded_question_count: number;
  updated_at: string | Date | null;
};

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapCourse(row: CourseRow): AdminUserCourse {
  return {
    userId: Number(row.user_id),
    username: row.username,
    nickname: row.nickname,
    courseId: row.course_id,
    title: row.title,
    difficulty: Math.min(5, Math.max(1, Number(row.difficulty) || 1)),
    wordCount: Number(row.word_count) || 0,
    lessonCount: Number(row.lesson_count) || 0,
    isUserCreated: Boolean(row.is_user_created),
    updatedAt: toIso(row.updated_at),
  };
}

function mapPaper(row: PaperRow): AdminUserPaper {
  return {
    userId: Number(row.user_id),
    username: row.username,
    nickname: row.nickname,
    paperId: row.paper_id,
    title: row.title,
    wordCount: Number(row.word_count) || 0,
    questionCount: Number(row.question_count) || 0,
    discardedQuestionCount: Number(row.discarded_question_count) || 0,
    updatedAt: toIso(row.updated_at),
  };
}

export async function listAllUserCourses(): Promise<AdminUserCourse[]> {
  const rows = await query<CourseRow[]>(
    `SELECT c.user_id, u.username, u.nickname,
            c.course_id, c.title, c.difficulty, c.word_count, c.lesson_count,
            c.is_user_created, c.updated_at
     FROM user_course_summaries c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE u.username IS NULL OR LOWER(u.username) <> 'channg'
     ORDER BY c.updated_at DESC`,
  );
  return rows.map(mapCourse);
}

export async function listAllUserPapers(): Promise<AdminUserPaper[]> {
  const rows = await query<PaperRow[]>(
    `SELECT p.user_id, u.username, u.nickname,
            p.paper_id, p.title, p.word_count, p.question_count,
            p.discarded_question_count, p.updated_at
     FROM user_paper_summaries p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE u.username IS NULL OR LOWER(u.username) <> 'channg'
     ORDER BY p.updated_at DESC`,
  );
  return rows.map(mapPaper);
}
