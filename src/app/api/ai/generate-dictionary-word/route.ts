import { AiRelayError, requestAiJson } from "@/lib/ai-relay";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { ensureDictionaryAudio } from "@/lib/dictionary-audio";
import {
  app2DictionarySlug,
  dictionaryRepairUserMessage,
  dictionarySourceFromInput,
  DictionaryValidationError,
  normalizeDictionaryWord,
  parseDictionaryWordContent,
  SYSTEM_GENERATE_DICTIONARY_WORD,
  type DictionaryWordEntry,
} from "@/lib/dictionary-word";
import { ipRateLimited } from "@/lib/ip-rate-limit";
import { app2DictionaryObjectKey, r2GetText, r2Put } from "@/lib/r2";
import {
  deductDiamondsFloorZero,
  getUserDiamonds,
  INSUFFICIENT_DIAMONDS_CODE,
  INSUFFICIENT_DIAMONDS_MESSAGE,
  yuanToDiamonds,
} from "@/lib/vip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  word?: string;
  corpus?: string;
  rank?: number;
};

function parseStoredEntry(raw: string): DictionaryWordEntry | null {
  try {
    return parseDictionaryWordContent(raw);
  } catch {
    return null;
  }
}

async function loadCachedEntry(
  slug: string,
): Promise<DictionaryWordEntry | null> {
  const raw = await r2GetText(app2DictionaryObjectKey(slug));
  if (!raw) return null;
  return parseStoredEntry(raw);
}

async function audioForEntry(entry: DictionaryWordEntry) {
  try {
    return await ensureDictionaryAudio(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      total: 0,
      generated: 0,
      skipped: 0,
      failed: 1,
      errors: [{ text: "", error: message }],
      files: [],
    };
  }
}

async function persistEntry(slug: string, entry: DictionaryWordEntry) {
  await r2Put(
    app2DictionaryObjectKey(slug),
    JSON.stringify(entry),
    "application/json",
  );
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

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return withAuthCors(jsonError("请求体必须是 JSON"));
    }

    const word = normalizeDictionaryWord(body.word);
    if (!word) {
      return withAuthCors(jsonError("请输入英语词或短语"));
    }
    if (word.length > 80) {
      return withAuthCors(jsonError("词或短语过长"));
    }
    const slug = app2DictionarySlug(word);
    if (!slug) {
      return withAuthCors(jsonError("请输入有效的英语词或短语"));
    }

    const cached = await loadCachedEntry(slug);
    if (cached) {
      const audio = await audioForEntry(cached);
      const diamonds = await getUserDiamonds(user.id);
      return withAuthCors(
        jsonOk({
          entry: cached,
          cached: true,
          audio,
          diamondsCharged: 0,
          diamonds,
        }),
      );
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

    const limited = await ipRateLimited(req, "ai-generate", { max: 6 });
    if (limited) return withAuthCors(limited);

    const source = dictionarySourceFromInput(body);
    const validateOpts = { expectedWord: word, source };

    let costYuan = 0;
    const first = await requestAiJson({
      userId: user.id,
      system: SYSTEM_GENERATE_DICTIONARY_WORD,
      user: word,
      temperature: 0.4,
      maxTokens: 16384,
      chargeType: "ai_generate_dictionary",
      skipCharge: true,
    });
    costYuan += first.costYuan;

    let entry: DictionaryWordEntry;
    try {
      entry = parseDictionaryWordContent(first.content, validateOpts);
    } catch (err) {
      const issues =
        err instanceof DictionaryValidationError
          ? err.issues
          : [err instanceof Error ? err.message : "词条格式无效"];
      const repair = await requestAiJson({
        userId: user.id,
        system: SYSTEM_GENERATE_DICTIONARY_WORD,
        user: dictionaryRepairUserMessage(word, issues, first.content),
        temperature: 0.2,
        maxTokens: 16384,
        chargeType: "ai_generate_dictionary",
        skipCharge: true,
      });
      costYuan += repair.costYuan;
      try {
        entry = parseDictionaryWordContent(repair.content, validateOpts);
      } catch (retryErr) {
        const retryIssues =
          retryErr instanceof DictionaryValidationError
            ? retryErr.issues
            : [
                retryErr instanceof Error
                  ? retryErr.message
                  : "词条格式无效",
              ];
        return withAuthCors(
          jsonError("词条格式无效", 422, { issues: retryIssues }),
        );
      }
    }

    const raced = await loadCachedEntry(slug);
    if (raced) {
      const audio = await audioForEntry(raced);
      return withAuthCors(
        jsonOk({
          entry: raced,
          cached: true,
          audio,
          diamondsCharged: 0,
          diamonds: await getUserDiamonds(user.id),
        }),
      );
    }

    const audio = await audioForEntry(entry);
    await persistEntry(slug, entry);

    const diamondsCharged = yuanToDiamonds(costYuan);
    const nextDiamonds = await deductDiamondsFloorZero(
      user.id,
      diamondsCharged,
      {
        type: "ai_generate_dictionary",
        meta: {
          costYuan,
          word,
          slug,
          audioFailed: audio.failed,
        },
      },
    );

    return withAuthCors(
      jsonOk({
        entry,
        cached: false,
        audio,
        costYuan,
        diamondsCharged,
        diamonds: nextDiamonds,
      }),
    );
  } catch (err) {
    if (err instanceof AiRelayError) {
      return withAuthCors(jsonError(err.message, err.status));
    }
    if (err instanceof DictionaryValidationError) {
      return withAuthCors(jsonError(err.message, 422, { issues: err.issues }));
    }
    if (err instanceof Error) {
      return withAuthCors(jsonError(err.message, 422));
    }
    console.error(err);
    return withAuthCors(jsonError("生成词条失败，请稍后重试", 500));
  }
}
