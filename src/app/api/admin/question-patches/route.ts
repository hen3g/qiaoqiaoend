import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  compactWordFields,
  paperQuestionSchema,
  WORD_ONLY_QUESTION_ID,
  wordFieldPatchSchema,
} from "@/lib/paper-question";
import {
  deleteQuestionPatch,
  listQuestionPatches,
  upsertQuestionPatch,
  getQuestionPatchVersion,
} from "@/lib/question-patches";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  word: z.string().trim().min(1, "请填写单词").max(128),
  questionId: z.string().trim().max(128).optional().default(""),
  question: paperQuestionSchema.nullable().optional(),
  wordFields: wordFieldPatchSchema.nullable().optional(),
  note: z.string().trim().max(500).optional().default(""),
});

const deleteSchema = z.object({
  id: z.number().int().positive(),
});

function mapAdminError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return jsonError("请先登录", 401);
  }
  if (err instanceof Error && err.message === "FORBIDDEN") {
    return jsonError("无权限", 403);
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const [patches, version] = await Promise.all([
      listQuestionPatches(),
      getQuestionPatchVersion(),
    ]);
    return jsonOk({ patches, version, total: patches.length });
  } catch (err) {
    const mapped = mapAdminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = upsertSchema.parse(await req.json());
    const questionId = body.questionId.trim() || WORD_ONLY_QUESTION_ID;
    const question =
      questionId === WORD_ONLY_QUESTION_ID
        ? null
        : body.question
          ? { ...body.question, id: questionId }
          : null;
    const result = await upsertQuestionPatch({
      word: body.word,
      questionId,
      question,
      wordFields: compactWordFields(body.wordFields ?? null),
      note: body.note,
    });
    return jsonOk({
      patch: result.patch,
      version: result.version,
      message: result.created ? "已发布补丁" : "已更新补丁",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = mapAdminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("保存失败", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const body = deleteSchema.parse(await req.json());
    const result = await deleteQuestionPatch(body.id);
    return jsonOk({
      deleted: result.deleted,
      version: result.version,
      message: "已删除补丁",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = mapAdminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("删除失败", 500);
  }
}
