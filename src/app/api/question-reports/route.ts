import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { sendBarkPush } from "@/lib/bark";
import { IP_RATE_DAY_MS, ipRateLimitedAll } from "@/lib/ip-rate-limit";
import { paperQuestionSchema, type PaperQuestionDto } from "@/lib/paper-question";
import { createQuestionReport } from "@/lib/question-reports";

const schema = z.object({
  courseId: z.string().trim().max(64).optional().default(""),
  paperId: z.string().trim().max(128).optional().default(""),
  word: z.string().trim().min(1, "缺少单词").max(128, "单词过长"),
  phonetic: z.string().trim().max(128).optional().default(""),
  meaning: z.string().trim().max(512).optional().default(""),
  partOfSpeech: z.string().trim().max(64).optional().default(""),
  questionId: z.string().trim().max(128).optional().default(""),
  questionType: z.string().trim().max(64).optional().default(""),
  prompt: z.string().trim().max(2000).optional().default(""),
  answer: z.string().trim().max(2000).optional().default(""),
  translation: z.string().trim().max(2000).optional().default(""),
  audioText: z.string().trim().max(2000).optional().default(""),
  options: z.array(z.string().trim().max(200)).max(12).optional().default([]),
  example: z.string().trim().max(2000).optional().default(""),
  question: z.unknown().optional(),
  comment: z
    .string()
    .trim()
    .min(1, "请填写这道题有什么问题")
    .max(1000, "内容过长"),
});

function parseReportQuestion(value: unknown): PaperQuestionDto | null {
  const parsed = paperQuestionSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.type !== "string") return null;
  return value as PaperQuestionDto;
}

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const limited = await ipRateLimitedAll(req, [
      { action: "question-report", max: 8, windowMs: 10 * 60 * 1000 },
      { action: "question-report-day", max: 30, windowMs: IP_RATE_DAY_MS },
    ]);
    if (limited) return withAuthCors(limited);

    const body = schema.parse(await req.json());
    const appId = clientAppFromRequest(req);
    if (appId !== "hamster") {
      return withAuthCors(jsonError("题目报告仅支持仓鼠单词", 404));
    }
    const report = await createQuestionReport({
      userId: user.id,
      appId: "hamster",
      courseId: body.courseId,
      paperId: body.paperId,
      word: body.word,
      phonetic: body.phonetic,
      meaning: body.meaning,
      partOfSpeech: body.partOfSpeech,
      example: body.example,
      questionId: body.questionId,
      questionType: body.questionType,
      prompt: body.prompt,
      answer: body.answer,
      translation: body.translation,
      audioText: body.audioText,
      options: body.options,
      question: parseReportQuestion(body.question),
      comment: body.comment,
    });

    const who =
      user.nickname?.trim() || user.username || `用户#${user.id}`;
    void sendBarkPush({
      title: "仓鼠单词 · 题目报告",
      body: `${who}\n${report.word} · ${report.questionType || "题目"}\n${report.comment}`,
      group: "题目报告",
    });

    return withAuthCors(
      jsonOk({
        report,
        message: "已提交，谢谢你的报告",
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    if (err instanceof Error) {
      return withAuthCors(jsonError(err.message));
    }
    console.error(err);
    return withAuthCors(jsonError("提交失败", 500));
  }
}
