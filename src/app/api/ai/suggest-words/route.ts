import { z } from "zod";
import { AiRelayError, requestAiJson } from "@/lib/ai-relay";
import { SYSTEM_SUGGEST_WORDS } from "@/lib/ai-course-prompt";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { ipRateLimited } from "@/lib/ip-rate-limit";
import { parseSuggestedWordsResult } from "@/lib/word-utils";
import {
  getUserDiamonds,
  INSUFFICIENT_DIAMONDS_CODE,
  INSUFFICIENT_DIAMONDS_MESSAGE,
} from "@/lib/vip";

const schema = z.object({
  request: z.string().optional(),
  theme: z.string().optional(),
  count: z.number().optional(),
  exclude: z.array(z.string()).optional(),
});

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

    const body = schema.parse(await req.json());
    const userRequest = body.request?.trim() || body.theme?.trim() || "";
    if (!userRequest) {
      return withAuthCors(jsonError("请用一句话描述想学什么"));
    }

    const limited = await ipRateLimited(req, "ai-suggest-words", { max: 8 });
    if (limited) return withAuthCors(limited);

    const count = Math.min(
      36,
      Math.max(8, Math.round(Number(body.count) || 20)),
    );
    const exclude = Array.isArray(body.exclude)
      ? body.exclude.map((w) => String(w).toLowerCase()).filter(Boolean)
      : [];

    const userContent = [
      `用户需求：${userRequest}`,
      `请推荐约 ${count} 个单词（尽量贴合该数量，±2 可接受）。`,
      "请根据这句话推断主题与难度。",
      exclude.length > 0
        ? `不要包含这些已有单词：${exclude.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await requestAiJson({
      userId: user.id,
      system: SYSTEM_SUGGEST_WORDS,
      user: userContent,
      temperature: 0.8,
      maxTokens: 8192,
      chargeType: "ai_suggest_words",
    });

    const parsed = parseSuggestedWordsResult(result.content, userRequest);
    return withAuthCors(
      jsonOk({
        ...parsed,
        costYuan: result.costYuan,
        diamondsCharged: result.diamondsCharged,
        diamonds: result.diamonds,
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    if (err instanceof AiRelayError) {
      return withAuthCors(jsonError(err.message, err.status));
    }
    if (err instanceof Error) {
      return withAuthCors(jsonError(err.message, 422));
    }
    console.error(err);
    return withAuthCors(jsonError("推荐单词失败，请稍后重试", 500));
  }
}
