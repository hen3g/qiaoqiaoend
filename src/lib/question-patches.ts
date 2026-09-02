import type { RowDataPacket } from "mysql2";

import { execute, query, withTransaction } from "@/lib/db";
import {
  compactWordFields,
  parseJsonValue,
  WORD_ONLY_QUESTION_ID,
  type PaperQuestionDto,
  type WordFieldPatch,
} from "@/lib/paper-question";

export type QuestionPatchDto = {
  id: number;
  word: string;
  questionId: string;
  question: PaperQuestionDto | null;
  wordFields: WordFieldPatch | null;
  note: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublicQuestionPatch = {
  word: string;
  questionId: string;
  question: PaperQuestionDto | null;
  wordFields: WordFieldPatch | null;
};

type PatchRow = RowDataPacket & {
  id: number;
  word: string;
  question_id: string;
  question_json: unknown;
  word_json: unknown;
  note: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type MetaRow = RowDataPacket & {
  version: number | string;
};

let tableEnsured = false;

export async function ensureQuestionPatchesTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS question_patch_meta (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      version INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await execute(`
    INSERT IGNORE INTO question_patch_meta (id, version, updated_at)
    VALUES (1, 0, UTC_TIMESTAMP())
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS question_patches (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      word VARCHAR(128) NOT NULL,
      question_id VARCHAR(128) NOT NULL,
      question_json JSON NULL,
      word_json JSON NULL,
      note VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_question_patches_word_qid (word, question_id),
      KEY idx_question_patches_word (word)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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

function mapRow(row: PatchRow): QuestionPatchDto {
  return {
    id: Number(row.id),
    word: row.word,
    questionId: row.question_id,
    question: parseJsonValue<PaperQuestionDto>(row.question_json),
    wordFields: compactWordFields(
      parseJsonValue<WordFieldPatch>(row.word_json),
    ),
    note: row.note ?? "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toPublic(patch: QuestionPatchDto): PublicQuestionPatch {
  return {
    word: patch.word,
    questionId: patch.questionId,
    question: patch.question,
    wordFields: patch.wordFields,
  };
}

const SELECT_PATCHES = `
  SELECT id, word, question_id, question_json, word_json, note, created_at, updated_at
  FROM question_patches
`;

async function bumpPatchVersion(): Promise<number> {
  await execute(`
    UPDATE question_patch_meta
    SET version = version + 1, updated_at = UTC_TIMESTAMP()
    WHERE id = 1
    LIMIT 1
  `);
  return getQuestionPatchVersion();
}

export async function getQuestionPatchVersion(): Promise<number> {
  await ensureQuestionPatchesTable();
  const rows = await query<MetaRow[]>(
    `SELECT version FROM question_patch_meta WHERE id = 1 LIMIT 1`,
  );
  const version = Number(rows[0]?.version ?? 0);
  return Number.isFinite(version) ? version : 0;
}

export async function listQuestionPatches(): Promise<QuestionPatchDto[]> {
  await ensureQuestionPatchesTable();
  const rows = await query<PatchRow[]>(
    `${SELECT_PATCHES}
     ORDER BY updated_at DESC, id DESC`,
  );
  return rows.map(mapRow);
}

export async function listPublicQuestionPatches(): Promise<{
  version: number;
  patches: PublicQuestionPatch[];
}> {
  const [version, patches] = await Promise.all([
    getQuestionPatchVersion(),
    listQuestionPatches(),
  ]);
  return {
    version,
    patches: patches.map(toPublic),
  };
}

export async function upsertQuestionPatch(input: {
  word: string;
  questionId: string;
  question: PaperQuestionDto | null;
  wordFields: WordFieldPatch | null;
  note: string;
}): Promise<{ patch: QuestionPatchDto; version: number; created: boolean }> {
  const word = clip(input.word, 128);
  const questionId = clip(input.questionId, 128) || WORD_ONLY_QUESTION_ID;
  const note = clip(input.note, 500);
  const wordFields = compactWordFields(input.wordFields);
  const question =
    questionId === WORD_ONLY_QUESTION_ID ? null : input.question;

  if (!word) throw new Error("请填写单词");
  if (!question && !wordFields) {
    throw new Error("请填写要替换的题目或词条修正");
  }
  if (questionId !== WORD_ONLY_QUESTION_ID && !question) {
    throw new Error("请填写要替换的题目");
  }

  await ensureQuestionPatchesTable();
  return withTransaction(async () => {
    const existing = await query<PatchRow[]>(
      `${SELECT_PATCHES}
       WHERE word = :word AND question_id = :questionId
       LIMIT 1`,
      { word, questionId },
    );
    const created = existing.length === 0;

    if (created) {
      await execute(
        `INSERT INTO question_patches
           (word, question_id, question_json, word_json, note, created_at, updated_at)
         VALUES
           (:word, :questionId, :questionJson, :wordJson, :note, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        {
          word,
          questionId,
          questionJson: question ? JSON.stringify(question) : null,
          wordJson: wordFields ? JSON.stringify(wordFields) : null,
          note,
        },
      );
    } else {
      await execute(
        `UPDATE question_patches
         SET question_json = :questionJson,
             word_json = :wordJson,
             note = :note,
             updated_at = UTC_TIMESTAMP()
         WHERE word = :word AND question_id = :questionId
         LIMIT 1`,
        {
          word,
          questionId,
          questionJson: question ? JSON.stringify(question) : null,
          wordJson: wordFields ? JSON.stringify(wordFields) : null,
          note,
        },
      );
    }

    const version = await bumpPatchVersion();
    const rows = await query<PatchRow[]>(
      `${SELECT_PATCHES}
       WHERE word = :word AND question_id = :questionId
       LIMIT 1`,
      { word, questionId },
    );
    const row = rows[0];
    if (!row) throw new Error("保存失败，请重试");
    return { patch: mapRow(row), version, created };
  });
}

export async function deleteQuestionPatch(id: number): Promise<{
  deleted: number;
  version: number;
}> {
  await ensureQuestionPatchesTable();
  return withTransaction(async () => {
    const result = await execute(
      `DELETE FROM question_patches WHERE id = :id LIMIT 1`,
      { id },
    );
    const deleted = Number(result.affectedRows || 0);
    if (deleted === 0) throw new Error("补丁不存在");
    const version = await bumpPatchVersion();
    return { deleted, version };
  });
}
