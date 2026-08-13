import type { CoursePack } from "@/data/course-types";
import {
  ARTICLE_MAX_CHARS,
  ARTICLE_MIN_CHARS,
} from "@/data/ai-article-limits";
import {
  isPracticeMode,
  type PracticeMode,
} from "@/data/practice-modes";
import {
  systemGenerateForMode,
  systemReviseForMode,
} from "@/lib/ai-course-prompt";
import {
  AiRelayError,
  requestAiJson,
  requestAiJsonStream,
} from "@/lib/ai-relay";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authCorsHeaders, authPreflight, withAuthCors } from "@/lib/auth-cors";
import { parseAndValidateCourse } from "@/lib/course-validate";
import { createJsonSse } from "@/lib/sse";
import {
  getUserDiamonds,
  INSUFFICIENT_DIAMONDS_CODE,
  INSUFFICIENT_DIAMONDS_MESSAGE,
} from "@/lib/vip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type WordInput = { en?: string; zh?: string };

type Body = {
  prompt?: string;
  theme?: string;
  difficulty?: number;
  practiceMode?: PracticeMode;
  liteMode?: boolean;
  words?: WordInput[];
  article?: string;
  existingCourse?: CoursePack;
  model?: string;
  /** When true, respond with SSE progress events. */
  stream?: boolean;
};

export type GenerateCourseSseEvent =
  | { type: "start"; message: string }
  | { type: "progress"; chars: number; message: string }
  | {
      type: "done";
      course: CoursePack;
      raw: string;
      costYuan: number;
      diamondsCharged: number;
      diamonds: number;
    }
  | { type: "error"; error: string };

function stripSentenceTokens(course: CoursePack): CoursePack {
  return {
    ...course,
    lessons: course.lessons.map((lesson) => ({
      ...lesson,
      sentences: lesson.sentences.map(({ tokens, ...sentence }) => {
        void tokens;
        return sentence;
      }),
    })),
  };
}

function resolvePracticeMode(body: Body, isRevise: boolean): PracticeMode {
  if (isPracticeMode(body.practiceMode)) return body.practiceMode;
  if (isRevise && isPracticeMode(body.existingCourse?.practiceMode)) {
    return body.existingCourse.practiceMode;
  }
  return "progressive";
}

function exerciseRequirements(mode: PracticeMode, wordCount: number): string {
  const lessonHint =
    wordCount <= 8 ? "1 课" : wordCount <= 16 ? "2 课" : "2～3 课";

  if (mode === "sentences") {
    const min = Math.max(16, wordCount * 2);
    return `练习模式：全造句（practiceMode=sentences）。分成 ${lessonHint}；只生成 level=sentence；sentences 总数至少 ${min} 道；每个单词尽量出现在至少 2 句里；仍须把全部单词写入 words。`;
  }

  if (mode === "dialogue") {
    const min = Math.max(16, wordCount * 2);
    return `练习模式：情景对话（practiceMode=dialogue）。分成 ${lessonHint}；全部 level=sentence；每道题必须有 speaker（如 A/B）；en/zh 只写台词、禁止 "A:" 前缀；用用户单词自然融入对白；对话轮次至少 ${min} 轮；words 写入用户单词。`;
  }

  if (mode === "article") {
    return `练习模式：文章模式（practiceMode=article）。按文章语序拆成 level=sentence；禁止 word/phrase 与 speaker；从文中抽取 6～12 个词写入 words；覆盖全部拆出句子，短文至少 8 句；通常 1 课（句子多可 2 课），总题量建议不超过 24。`;
  }

  const min = Math.max(24, wordCount * 3);
  return `练习模式：循序渐进（practiceMode=progressive）。分成 ${lessonHint}；sentences 总数至少 ${min} 道；每个单词都要有 word 练习；phrase 与 sentence 各自不少于 ${wordCount} 道。`;
}

function progressMessage(chars: number): string {
  if (chars < 400) return "正在构思课程结构…";
  if (chars < 1500) return "正在编写练习内容…";
  if (chars < 4000) return "正在生成句子与释义…";
  return "正在完善课程细节…";
}

function buildPrompt(body: Body): {
  practiceMode: PracticeMode;
  liteMode: boolean;
  system: string;
  userContent: string;
} {
  const isRevise = Boolean(body.existingCourse);
  const practiceMode = resolvePracticeMode(body, isRevise);
  const words = (body.words ?? [])
    .map((w) => ({
      en: String(w.en ?? "").trim().toLowerCase(),
      zh: String(w.zh ?? "").trim(),
    }))
    .filter((w) => w.en);
  const article = String(body.article ?? "").trim();

  if (isRevise && !body.prompt?.trim()) {
    throw new Error("请填写修改要求");
  }

  if (!isRevise && practiceMode === "article") {
    if (article.length < ARTICLE_MIN_CHARS) {
      throw new Error(
        `文章太短，请至少输入 ${ARTICLE_MIN_CHARS} 个字符（当前 ${article.length}）`,
      );
    }
    if (article.length > ARTICLE_MAX_CHARS) {
      throw new Error(
        `文章太长，请控制在 ${ARTICLE_MAX_CHARS} 个字符以内（当前 ${article.length}）`,
      );
    }
  } else if (!isRevise && words.length === 0 && !body.prompt?.trim()) {
    throw new Error("请先准备至少几个单词，或填写生成说明");
  }

  const theme = body.theme?.trim() || "";
  const difficulty = body.difficulty
    ? Math.min(5, Math.max(1, Math.round(Number(body.difficulty))))
    : undefined;
  const liteMode = body.liteMode !== false;

  const system = isRevise
    ? systemReviseForMode(practiceMode, { liteMode })
    : systemGenerateForMode(practiceMode, { liteMode });

  let userContent: string;
  if (isRevise) {
    userContent = `当前课程 JSON：\n${JSON.stringify(body.existingCourse, null, 2)}\n\n修改要求：\n${body.prompt!.trim()}\n\n请保持 practiceMode 为「${practiceMode}」。`;
  } else if (practiceMode === "article") {
    userContent = [
      "请根据以下英文文章生成一门英语打字练习课程（practiceMode=article）：",
      "----- 文章开始 -----",
      article,
      "----- 文章结束 -----",
      "难度：请根据文章词汇与句式自行评估 difficulty（1～5），不要为迎合某档难度改写原文。",
      exerciseRequirements("article", 8),
      body.prompt?.trim() ? `补充要求：${body.prompt.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (words.length > 0) {
    const wordLines = words
      .map((w) => (w.zh ? `- ${w.en}（${w.zh}）` : `- ${w.en}`))
      .join("\n");
    userContent = [
      "请用以下单词生成一门英语打字练习课程（必须覆盖全部单词）：",
      wordLines,
      theme
        ? `场景/主题（短语和句子必须贴合此场景）：${theme}`
        : "场景/主题：未指定，请根据单词自行拟定一个连贯场景",
      difficulty ? `难度目标：${difficulty}/5` : "",
      exerciseRequirements(practiceMode, words.length),
      body.prompt?.trim() ? `补充要求：${body.prompt.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    userContent = [
      `请根据以下需求生成一门英语打字练习课程（practiceMode=${practiceMode}）：`,
      body.prompt!.trim(),
      exerciseRequirements(practiceMode, 8),
    ].join("\n");
  }

  return { practiceMode, liteMode, system, userContent };
}

function finalizeCourse(
  content: string,
  practiceMode: PracticeMode,
  liteMode: boolean,
): CoursePack {
  let course = parseAndValidateCourse(content);
  course.practiceMode = practiceMode;
  if (liteMode) {
    course = stripSentenceTokens(course);
  }
  return course;
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

    const diamonds = await getUserDiamonds(user.id);
    if (diamonds <= 0) {
      return withAuthCors(
        jsonError(INSUFFICIENT_DIAMONDS_MESSAGE, 402, {
          code: INSUFFICIENT_DIAMONDS_CODE,
          diamonds,
        }),
      );
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return withAuthCors(jsonError("请求体必须是 JSON"));
    }

    let prompt: ReturnType<typeof buildPrompt>;
    try {
      prompt = buildPrompt(body);
    } catch (err) {
      return withAuthCors(
        jsonError(err instanceof Error ? err.message : "参数错误"),
      );
    }

    const useStream = body.stream === true;

    if (!useStream) {
      const result = await requestAiJson({
        userId: user.id,
        model: body.model,
        system: prompt.system,
        user: prompt.userContent,
        temperature: 0.7,
        maxTokens: 65536,
      });
      const course = finalizeCourse(
        result.content,
        prompt.practiceMode,
        prompt.liteMode,
      );
      return withAuthCors(
        jsonOk({
          course,
          raw: result.content,
          costYuan: result.costYuan,
          diamondsCharged: result.diamondsCharged,
          diamonds: result.diamonds,
        }),
      );
    }

    const sse = createJsonSse<GenerateCourseSseEvent>({
      run: async (send, signal) => {
        await send({ type: "start", message: "正在连接 AI…" });

        let lastMsg = "";
        const result = await requestAiJsonStream({
          userId: user.id,
          model: body.model,
          system: prompt.system,
          user: prompt.userContent,
          temperature: 0.7,
          maxTokens: 65536,
          signal,
          stream: true,
          onDelta: async ({ chars }) => {
            const message = progressMessage(chars);
            if (message === lastMsg && chars % 200 !== 0) return;
            lastMsg = message;
            await send({ type: "progress", chars, message });
          },
        });

        if (signal.aborted) return;

        await send({
          type: "progress",
          chars: result.content.length,
          message: "正在校验课程…",
        });

        const course = finalizeCourse(
          result.content,
          prompt.practiceMode,
          prompt.liteMode,
        );

        await send({
          type: "done",
          course,
          raw: result.content,
          costYuan: result.costYuan,
          diamondsCharged: result.diamondsCharged,
          diamonds: result.diamonds,
        });
      },
      onErrorEvent: (message) => ({ type: "error", error: message }),
    });

    const headers = new Headers(sse.headers);
    for (const [key, value] of Object.entries(authCorsHeaders())) {
      headers.set(key, value);
    }
    return new NextResponse(sse.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof AiRelayError) {
      return withAuthCors(jsonError(err.message, err.status));
    }
    if (err instanceof Error) {
      return withAuthCors(jsonError(err.message, 422));
    }
    console.error(err);
    return withAuthCors(jsonError("生成课程失败，请稍后重试", 500));
  }
}
