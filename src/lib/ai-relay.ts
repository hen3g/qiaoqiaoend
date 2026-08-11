import "server-only";

import {
  deductDiamondsFloorZero,
  getUserDiamonds,
  yuanToDiamonds,
} from "@/lib/vip";
import type { DiamondTxType } from "@/lib/diamond-transactions";

/** Active provider: `deepseek` | `hy3`. Switch via AI_PROVIDER. */
export type AiProvider = "deepseek" | "hy3";

type ProviderConfig = {
  provider: AiProvider;
  baseUrl: string;
  token: string;
  model: string;
  /** DeepSeek-only request fields (thinking disable, etc.). */
  deepseekExtras: boolean;
};

function normalizeProvider(raw: string | undefined): AiProvider {
  const v = raw?.trim().toLowerCase();
  if (v === "hy3" || v === "tencent" || v === "tokenhub") return "hy3";
  return "deepseek";
}

/**
 * Resolve which upstream to call from AI_PROVIDER.
 * - deepseek: AI_RELAY_* (default)
 * - hy3: AI_HY3_* → 腾讯云 TokenHub
 */
export function resolveAiProvider(modelOverride?: string): ProviderConfig {
  const provider = normalizeProvider(process.env.AI_PROVIDER);
  if (provider === "hy3") {
    const token = process.env.AI_HY3_TOKEN?.trim() || "";
    if (!token) {
      throw new AiRelayError("腾讯云 hy3 未配置 AI_HY3_TOKEN，请联系管理员", 503);
    }
    return {
      provider: "hy3",
      baseUrl: (
        process.env.AI_HY3_BASE_URL?.trim() ||
        "https://tokenhub.tencentmaas.com/v1"
      ).replace(/\/$/, ""),
      token,
      model:
        modelOverride?.trim() ||
        process.env.AI_HY3_MODEL?.trim() ||
        "hy3",
      deepseekExtras: false,
    };
  }

  const token =
    process.env.AI_RELAY_TOKEN?.trim() ||
    process.env.NEWAPI_TOKEN?.trim() ||
    "";
  if (!token) {
    throw new AiRelayError("AI 服务未配置，请联系管理员", 503);
  }
  return {
    provider: "deepseek",
    baseUrl: (
      process.env.AI_RELAY_BASE_URL?.trim() || "https://api.deepseek.com/v1"
    ).replace(/\/$/, ""),
    token,
    model:
      modelOverride?.trim() ||
      process.env.AI_RELAY_MODEL?.trim() ||
      "deepseek-v4-flash",
    deepseekExtras: true,
  };
}

/** @deprecated Prefer resolveAiProvider().model — kept for callers. */
export const DEFAULT_AI_MODEL =
  process.env.AI_RELAY_MODEL?.trim() || "deepseek-v4-flash";

/** User-facing diamond rate: ¥10 / 1M tokens → 1000 diamonds / 1M tokens. */
const YUAN_PER_MILLION_TOKENS = 10;

export class AiRelayError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "AiRelayError";
    this.status = status;
  }
}

type TokenUsage = {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

function costYuanFromUsage(usage: TokenUsage | null | undefined): number {
  if (!usage) return 0;
  const total =
    typeof usage.total_tokens === "number" && usage.total_tokens > 0
      ? usage.total_tokens
      : (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
  if (total <= 0) return 0;
  return (total * YUAN_PER_MILLION_TOKENS) / 1_000_000;
}

/** Rough token estimate: ~4 chars per token (no official usage on cancel). */
function estimateTokensFromChars(chars: number): number {
  if (chars <= 0) return 0;
  return Math.ceil(chars / 4);
}

function estimateUsageFromText(
  system: string,
  user: string,
  completion: string,
): TokenUsage {
  const prompt_tokens = estimateTokensFromChars(system.length + user.length);
  const completion_tokens = estimateTokensFromChars(completion.length);
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: prompt_tokens + completion_tokens,
  };
}

export type AiJsonResult = {
  content: string;
  costYuan: number;
  diamondsCharged: number;
  diamonds: number;
};

type AiJsonRequest = {
  userId: number;
  model?: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onDelta?: (info: { chars: number; chunk: string }) => void | Promise<void>;
  /** Ledger type for diamond consumption (defaults to generate course). */
  chargeType?: DiamondTxType;
};

/**
 * Call configured AI provider (DeepSeek or 腾讯云 hy3), then deduct diamonds
 * post-hoc (100 diamonds = ¥1, balance floored at 0).
 * Cancel / disconnect after the upstream stream starts still settles an
 * estimated charge so partial usage is not free.
 */
export async function requestAiJson({
  userId,
  model,
  system,
  user,
  temperature = 0.5,
  maxTokens = 65536,
  chargeType,
}: AiJsonRequest): Promise<AiJsonResult> {
  return requestAiJsonStream({
    userId,
    model,
    system,
    user,
    temperature,
    maxTokens,
    stream: false,
    chargeType,
  });
}

/**
 * Stream or non-stream AI JSON. When stream=true, reads upstream SSE and
 * reports character progress via onDelta.
 */
export async function requestAiJsonStream({
  userId,
  model,
  system,
  user,
  temperature = 0.5,
  maxTokens = 65536,
  signal,
  onDelta,
  stream = true,
  chargeType,
}: AiJsonRequest & { stream?: boolean }): Promise<AiJsonResult> {
  const balance = await getUserDiamonds(userId);
  if (balance <= 0) {
    throw new AiRelayError("钻石不足，请先充值后再使用", 402);
  }

  const cfg = resolveAiProvider(model);
  const ledgerType: DiamondTxType =
    chargeType === "ai_suggest_words"
      ? "ai_suggest_words"
      : "ai_generate_course";

  const body: Record<string, unknown> = {
    model: cfg.model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    stream,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (cfg.deepseekExtras) {
    body.thinking = { type: "disabled" };
  }
  if (stream) {
    body.stream_options = { include_usage: true };
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify(body),
    });
  } catch {
    // Abort before a successful upstream response: no proven usage → no charge.
    if (signal?.aborted) throw new AiRelayError("已取消", 499);
    throw new AiRelayError("无法连接 AI 服务，请稍后重试。", 502);
  }

  if (!stream) {
    const rawText = await upstream.text();
    let payload: {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
      usage?: TokenUsage;
    };
    try {
      payload = JSON.parse(rawText) as typeof payload;
    } catch {
      throw new AiRelayError(
        `AI 服务返回异常（HTTP ${upstream.status}）`,
        502,
      );
    }

    if (!upstream.ok) {
      throw new AiRelayError(
        upstreamErrorMessage(payload.error?.message, upstream.status),
        upstream.status,
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new AiRelayError("AI 没有返回内容，请重试。", 502);

    return finalizeAiResult({
      userId,
      content,
      headerYuan: Number(upstream.headers.get("X-Usage-Cost-Yuan")),
      usage: payload.usage,
      chargeType: ledgerType,
    });
  }

  if (!upstream.ok) {
    let message = `AI 请求失败（HTTP ${upstream.status}）`;
    try {
      const errJson = (await upstream.json()) as {
        error?: { message?: string };
      };
      message = upstreamErrorMessage(errJson.error?.message, upstream.status);
    } catch {
      /* ignore */
    }
    throw new AiRelayError(message, upstream.status);
  }

  if (!upstream.body) {
    throw new AiRelayError("AI 服务未返回流式内容", 502);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage: TokenUsage | undefined;

  /** Stream body already open → prompt is typically billed; settle estimate then 499. */
  const settleCancelAndThrow = async (): Promise<never> => {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    await finalizeAiResult({
      userId,
      content,
      headerYuan: NaN,
      usage: estimateUsageFromText(system, user, content),
      chargeType: ledgerType,
      estimated: true,
      cancelled: true,
    });
    throw new AiRelayError("已取消", 499);
  };

  while (true) {
    if (signal?.aborted) {
      await settleCancelAndThrow();
    }

    let done: boolean;
    let value: Uint8Array | undefined;
    try {
      ({ done, value } = await reader.read());
    } catch {
      if (signal?.aborted) {
        await settleCancelAndThrow();
      }
      throw new AiRelayError("AI 流式读取中断，请重试。", 502);
    }
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      let chunk: {
        choices?: { delta?: { content?: string } }[];
        usage?: TokenUsage;
        error?: { message?: string };
      };
      try {
        chunk = JSON.parse(data) as typeof chunk;
      } catch {
        continue;
      }

      if (chunk.error?.message) {
        throw new AiRelayError(chunk.error.message, 502);
      }

      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        content += delta;
        await onDelta?.({ chars: content.length, chunk: delta });
      }
      if (chunk.usage) usage = chunk.usage;
    }
  }

  if (!content.trim()) {
    throw new AiRelayError("AI 没有返回内容，请重试。", 502);
  }

  return finalizeAiResult({
    userId,
    content,
    headerYuan: Number(upstream.headers.get("X-Usage-Cost-Yuan")),
    usage,
    chargeType: ledgerType,
  });
}

function upstreamErrorMessage(
  message: string | undefined,
  status: number,
): string {
  return (
    message ||
    (status === 401
      ? "AI 服务凭证无效，请联系管理员"
      : status === 402
        ? "AI 服务额度不足，请稍后重试或联系管理员"
        : `AI 请求失败（HTTP ${status}）`)
  );
}

async function finalizeAiResult(input: {
  userId: number;
  content: string;
  headerYuan: number;
  usage?: TokenUsage;
  chargeType: DiamondTxType;
  estimated?: boolean;
  cancelled?: boolean;
}): Promise<AiJsonResult> {
  const costYuan =
    Number.isFinite(input.headerYuan) && input.headerYuan > 0
      ? input.headerYuan
      : costYuanFromUsage(input.usage);

  const diamondsCharged = yuanToDiamonds(costYuan);
  const diamonds = await deductDiamondsFloorZero(
    input.userId,
    diamondsCharged,
    {
      type: input.chargeType,
      meta: {
        costYuan,
        totalTokens: input.usage?.total_tokens ?? null,
        promptTokens: input.usage?.prompt_tokens ?? null,
        completionTokens: input.usage?.completion_tokens ?? null,
        ...(input.estimated ? { estimated: true } : {}),
        ...(input.cancelled ? { cancelled: true } : {}),
      },
    },
  );

  return {
    content: input.content,
    costYuan,
    diamondsCharged,
    diamonds,
  };
}

export async function getDiamondBalance(userId: number): Promise<number> {
  return getUserDiamonds(userId);
}
