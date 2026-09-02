import type { RowDataPacket } from "mysql2";

import type { ClientAppId } from "@/lib/client-app";
import { DEFAULT_CLIENT_APP, isClientAppId } from "@/lib/client-app";
import { execute, query } from "@/lib/db";
import {
  parseJsonValue,
  type PaperQuestionDto,
} from "@/lib/paper-question";

export type QuestionReportStatus = "pending" | "handled";

export type QuestionReportDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  appId: ClientAppId;
  courseId: string;
  paperId: string;
  word: string;
  phonetic: string;
  meaning: string;
  partOfSpeech: string;
  example: string;
  questionId: string;
  questionType: string;
  prompt: string;
  answer: string;
  translation: string;
  audioText: string;
  options: string[];
  question: PaperQuestionDto | null;
  comment: string;
  status: QuestionReportStatus;
  createdAt: string | null;
  handledAt: string | null;
};

type QuestionReportRow = RowDataPacket & {
  id: number;
  user_id: number;
  username: string | null;
  nickname: string | null;
  app_id: string | null;
  course_id: string | null;
  paper_id: string | null;
  word: string;
  phonetic: string | null;
  meaning: string | null;
  part_of_speech: string | null;
  example: string | null;
  question_id: string | null;
  question_type: string | null;
  prompt: string | null;
  answer: string | null;
  translation: string | null;
  audio_text: string | null;
  options_json: string | null;
  question_json: unknown;
  comment: string;
  status: string;
  created_at: Date | string | null;
  handled_at: Date | string | null;
};

let tableEnsured = false;

export async function ensureQuestionReportsTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS question_reports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      app_id VARCHAR(32) NOT NULL DEFAULT 'hamster',
      course_id VARCHAR(64) NOT NULL DEFAULT '',
      paper_id VARCHAR(128) NOT NULL DEFAULT '',
      word VARCHAR(128) NOT NULL,
      phonetic VARCHAR(128) NOT NULL DEFAULT '',
      meaning VARCHAR(512) NOT NULL DEFAULT '',
      part_of_speech VARCHAR(64) NOT NULL DEFAULT '',
      question_id VARCHAR(128) NOT NULL DEFAULT '',
      question_type VARCHAR(64) NOT NULL DEFAULT '',
      prompt TEXT NULL,
      answer TEXT NULL,
      translation TEXT NULL,
      audio_text TEXT NULL,
      options_json TEXT NULL,
      comment TEXT NOT NULL,
      status ENUM('pending', 'handled') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      handled_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_question_reports_created (created_at),
      KEY idx_question_reports_status (status),
      KEY idx_question_reports_user (user_id),
      KEY idx_question_reports_app (app_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  type ColRow = RowDataPacket & { Field: string };
  const questionCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM question_reports LIKE 'question_json'`,
  );
  if (questionCols.length === 0) {
    await execute(
      `ALTER TABLE question_reports
       ADD COLUMN question_json JSON NULL AFTER options_json`,
    );
  }
  const exampleCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM question_reports LIKE 'example'`,
  );
  if (exampleCols.length === 0) {
    await execute(
      `ALTER TABLE question_reports
       ADD COLUMN example VARCHAR(2000) NOT NULL DEFAULT '' AFTER part_of_speech`,
    );
  }

  tableEnsured = true;
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function parseOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  } catch {
    return [];
  }
}

function normalizeStatus(value: unknown): QuestionReportStatus {
  return value === "handled" ? "handled" : "pending";
}

const SELECT_REPORTS = `
  SELECT r.id, r.user_id, u.username, u.nickname, r.app_id, r.course_id, r.paper_id,
         r.word, r.phonetic, r.meaning, r.part_of_speech, r.example, r.question_id, r.question_type,
         r.prompt, r.answer, r.translation, r.audio_text, r.options_json, r.question_json, r.comment,
         r.status, r.created_at, r.handled_at
  FROM question_reports r
  LEFT JOIN users u ON u.id = r.user_id
`;

function mapRow(row: QuestionReportRow): QuestionReportDto {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    username: row.username,
    nickname: row.nickname,
    appId: isClientAppId(row.app_id) ? row.app_id : DEFAULT_CLIENT_APP,
    courseId: row.course_id ?? "",
    paperId: row.paper_id ?? "",
    word: row.word,
    phonetic: row.phonetic ?? "",
    meaning: row.meaning ?? "",
    partOfSpeech: row.part_of_speech ?? "",
    example: row.example ?? "",
    questionId: row.question_id ?? "",
    questionType: row.question_type ?? "",
    prompt: row.prompt ?? "",
    answer: row.answer ?? "",
    translation: row.translation ?? "",
    audioText: row.audio_text ?? "",
    options: parseOptions(row.options_json),
    question: parseJsonValue<PaperQuestionDto>(row.question_json),
    comment: row.comment,
    status: normalizeStatus(row.status),
    createdAt: toIso(row.created_at),
    handledAt: toIso(row.handled_at),
  };
}

export async function createQuestionReport(input: {
  userId: number;
  appId: ClientAppId;
  courseId: string;
  paperId: string;
  word: string;
  phonetic: string;
  meaning: string;
  partOfSpeech: string;
  example: string;
  questionId: string;
  questionType: string;
  prompt: string;
  answer: string;
  translation: string;
  audioText: string;
  options: string[];
  question: PaperQuestionDto | null;
  comment: string;
}): Promise<QuestionReportDto> {
  await ensureQuestionReportsTable();
  const word = clip(input.word, 128);
  const comment = clip(input.comment, 1000);
  if (!word) throw new Error("缺少单词");
  if (!comment) throw new Error("请填写这道题有什么问题");

  const options = input.options
    .map((item) => clip(item, 200))
    .filter(Boolean)
    .slice(0, 12);

  const result = await execute(
    `INSERT INTO question_reports (
       user_id, app_id, course_id, paper_id, word, phonetic, meaning, part_of_speech,
       example, question_id, question_type, prompt, answer, translation, audio_text,
       options_json, question_json, comment, status, created_at
     ) VALUES (
       :userId, :appId, :courseId, :paperId, :word, :phonetic, :meaning, :partOfSpeech,
       :example, :questionId, :questionType, :prompt, :answer, :translation, :audioText,
       :optionsJson, :questionJson, :comment, 'pending', UTC_TIMESTAMP()
     )`,
    {
      userId: input.userId,
      appId: input.appId,
      courseId: clip(input.courseId, 64),
      paperId: clip(input.paperId, 128),
      word,
      phonetic: clip(input.phonetic, 128),
      meaning: clip(input.meaning, 512),
      partOfSpeech: clip(input.partOfSpeech, 64),
      example: clip(input.example, 2000),
      questionId: clip(input.questionId, 128),
      questionType: clip(input.questionType, 64),
      prompt: clip(input.prompt, 2000),
      answer: clip(input.answer, 2000),
      translation: clip(input.translation, 2000),
      audioText: clip(input.audioText, 2000),
      optionsJson: JSON.stringify(options),
      questionJson: input.question ? JSON.stringify(input.question) : null,
      comment,
    },
  );

  const id = Number(result.insertId);
  const rows = await query<QuestionReportRow[]>(
    `${SELECT_REPORTS}
     WHERE r.id = :id
     LIMIT 1`,
    { id },
  );
  const row = rows[0];
  if (!row) throw new Error("提交失败，请重试");
  return mapRow(row);
}

export async function listQuestionReports(): Promise<QuestionReportDto[]> {
  await ensureQuestionReportsTable();
  const rows = await query<QuestionReportRow[]>(
    `${SELECT_REPORTS}
     WHERE r.app_id = 'hamster'
     ORDER BY r.id DESC
     LIMIT 500`,
  );
  return rows.map(mapRow);
}

export async function setQuestionReportStatus(input: {
  id: number;
  status: QuestionReportStatus;
}): Promise<QuestionReportDto> {
  await ensureQuestionReportsTable();
  const existing = await query<QuestionReportRow[]>(
    `${SELECT_REPORTS}
     WHERE r.id = :id
     LIMIT 1`,
    { id: input.id },
  );
  if (!existing[0]) throw new Error("报告不存在");

  await execute(
    `UPDATE question_reports
     SET status = :status,
         handled_at = IF(:isHandled = 1, UTC_TIMESTAMP(), NULL)
     WHERE id = :id
     LIMIT 1`,
    {
      id: input.id,
      status: input.status,
      isHandled: input.status === "handled" ? 1 : 0,
    },
  );

  const rows = await query<QuestionReportRow[]>(
    `${SELECT_REPORTS}
     WHERE r.id = :id
     LIMIT 1`,
    { id: input.id },
  );
  const row = rows[0];
  if (!row) throw new Error("更新失败，请重试");
  return mapRow(row);
}
