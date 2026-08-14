import "server-only";

import { getAppSetting, setAppSetting } from "@/lib/app-settings";
import {
  deductDiamondsFloorZero,
  getUserDiamonds,
  yuanToDiamonds,
} from "@/lib/vip";
import type { DiamondTxType } from "@/lib/diamond-transactions";

/** Active provider. Admin override, else AI_PROVIDER. */
export const AI_PROVIDER_IDS = ["deepseek", "hy3", "hy3-deepseek"] as const;
export type AiProvider = (typeof AI_PROVIDER_IDS)[number];

const AI_PROVIDER_SETTING_KEY = "ai_provider";

type ProviderDef = {
  label: string;
  envAliases?: string[];
  token: () => string;
  baseUrl: () => string;
  model: () => string;
  deepseekExtras: boolean;
  missingTokenMessage: string;
};

function tokenhubToken(): string {
  return process.env.AI_HY3_TOKEN?.trim() || "";
}

function tokenhubBaseUrl(): string {
  return (
    process.env.AI_HY3_BASE_URL?.trim() || "https://tokenhub.tencentmaas.com/v1"
  );
}

const PROVIDER_DEFS: Record<AiProvider, ProviderDef> = {
  deepseek: {
    label: "DeepSeek 官方",
    token: () =>
      process.env.AI_RELAY_TOKEN?.trim() ||
      process.env.NEWAPI_TOKEN?.trim() ||
      "",
    baseUrl: () =>
      process.env.AI_RELAY_BASE_URL?.trim() || "https://api.deepseek.com/v1",
    model: () => process.env.AI_RELAY_MODEL?.trim() || "deepseek-v4-flash",
    deepseekExtras: true,
    missingTokenMessage: "DeepSeek 未配置 AI_RELAY_TOKEN，无法切换",
  },
  hy3: {
    label: "腾讯云 hy3",
    envAliases: ["tencent", "tokenhub"],
    token: tokenhubToken,
    baseUrl: tokenhubBaseUrl,
    model: () => process.env.AI_HY3_MODEL?.trim() || "hy3",
    deepseekExtras: false,
    missingTokenMessage: "腾讯云未配置 AI_HY3_TOKEN，无法切换",
  },
  "hy3-deepseek": {
    label: "腾讯云 DeepSeek v4 Flash",
    envAliases: ["tencent-deepseek", "tokenhub-deepseek"],
    token: tokenhubToken,
    baseUrl: tokenhubBaseUrl,
    model: () =>
      process.env.AI_HY3_DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash",
    deepseekExtras: true,
    missingTokenMessage: "腾讯云未配置 AI_HY3_TOKEN，无法切换",
  },
};

export const AI_PROVIDER_OPTIONS: {
  provider: AiProvider;
  label: string;
}[] = AI_PROVIDER_IDS.map((provider) => ({
  provider,
  label: PROVIDER_DEFS[provider].label,
}));

type ProviderConfig = {
  provider: AiProvider;
  baseUrl: string;
  token: string;
  model: string;
  /** DeepSeek-only request fields (thinking disable, etc.). */
  deepseekExtras: boolean;
};

export class AiRelayError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "AiRelayError";
    this.status = status;
  }
}

function parseStoredProvider(raw: string | undefined): AiProvider | null {
  const v = raw?.trim().toLowerCase();
  if (v && (AI_PROVIDER_IDS as readonly string[]).includes(v)) {
    return v as AiProvider;
  }
  return null;
}

function normalizeProvider(raw: string | undefined): AiProvider {
  const v = raw?.trim().toLowerCase();
  if (!v) return "deepseek";
  const stored = parseStoredProvider(v);
  if (stored) return stored;
  for (const id of AI_PROVIDER_IDS) {
    if (PROVIDER_DEFS[id].envAliases?.includes(v)) return id;
  }
  return "deepseek";
}

function tokenForProvider(provider: AiProvider): string {
  return PROVIDER_DEFS[provider].token();
}

function modelForProvider(provider: AiProvider): string {
  return PROVIDER_DEFS[provider].model();
}

function buildProviderConfig(provider: AiProvider): ProviderConfig {
  const def = PROVIDER_DEFS[provider];
  const token = def.token();
  if (!token) {
    throw new AiRelayError(
      provider === "deepseek"
        ? "AI 服务未配置，请联系管理员"
        : "腾讯云 TokenHub 未配置 AI_HY3_TOKEN，请联系管理员",
      503,
    );
  }
  return {
    provider,
    baseUrl: def.baseUrl().replace(/\/$/, ""),
    token,
    model: def.model(),
    deepseekExtras: def.deepseekExtras,
  };
}

async function readProviderOverride(): Promise<{
  provider: AiProvider;
  updatedAt: string | null;
} | null> {
  const row = await getAppSetting(AI_PROVIDER_SETTING_KEY);
  if (!row) return null;
  const provider = parseStoredProvider(row.value);
  if (!provider) return null;
  return { provider, updatedAt: row.updatedAt };
}

async function resolveActiveProvider(): Promise<{
  provider: AiProvider;
  source: "admin" | "env";
  updatedAt: string | null;
}> {
  const override = await readProviderOverride();
  if (override) {
    return {
      provider: override.provider,
      source: "admin",
      updatedAt: override.updatedAt,
    };
  }
  return {
    provider: normalizeProvider(process.env.AI_PROVIDER),
    source: "env",
    updatedAt: null,
  };
}

/**
 * Resolve which upstream to call.
 * Admin override in app_settings wins; otherwise AI_PROVIDER env (default deepseek).
 */
export async function resolveAiProvider(): Promise<ProviderConfig> {
  const { provider } = await resolveActiveProvider();
  return buildProviderConfig(provider);
}

export type AiProviderOptionStatus = {
  provider: AiProvider;
  label: string;
  model: string;
  tokenConfigured: boolean;
};

export type AiRuntimeStatus = {
  provider: AiProvider;
  source: "admin" | "env";
  model: string;
  tokenConfigured: boolean;
  updatedAt: string | null;
  options: AiProviderOptionStatus[];
};

export async function getAiRuntimeStatus(): Promise<AiRuntimeStatus> {
  const active = await resolveActiveProvider();
  const options = AI_PROVIDER_OPTIONS.map((opt) => ({
    provider: opt.provider,
    label: opt.label,
    model: modelForProvider(opt.provider),
    tokenConfigured: Boolean(tokenForProvider(opt.provider)),
  }));
  return {
    provider: active.provider,
    source: active.source,
    model: modelForProvider(active.provider),
    tokenConfigured: Boolean(tokenForProvider(active.provider)),
    updatedAt: active.updatedAt,
    options,
  };
}

export async function setActiveAiProvider(
  provider: AiProvider,
): Promise<AiRuntimeStatus> {
  if (!tokenForProvider(provider)) {
    throw new AiRelayError(PROVIDER_DEFS[provider].missingTokenMessage, 400);
  }
  await setAppSetting(AI_PROVIDER_SETTING_KEY, provider);
  return getAiRuntimeStatus();
}

/** @deprecated Prefer resolveAiProvider().model — kept for callers. */
export const DEFAULT_AI_MODEL =
  process.env.AI_RELAY_MODEL?.trim() || "deepseek-v4-flash";

/** User-facing diamond rate: ¥10 / 1M tokens → 1000 diamonds / 1M tokens. */
const YUAN_PER_MILLION_TOKENS = 10;

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
 * Call configured AI provider (DeepSeek / 腾讯云 TokenHub), then deduct diamonds
 * post-hoc (100 diamonds = ¥1, balance floored at 0).
 * Cancel / disconnect after the upstream stream starts still settles an
 * estimated charge so partial usage is not free.
 */
export async function requestAiJson({
  userId,
  system,
  user,
  temperature = 0.5,
  maxTokens = 65536,
  chargeType,
}: AiJsonRequest): Promise<AiJsonResult> {
  return requestAiJsonStream({
    userId,
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

  const cfg = await resolveAiProvider();
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
      choices?: {
        message?: { content?: string; reasoning_content?: string };
      }[];
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

    const message = payload.choices?.[0]?.message;
    const content = message?.content || message?.reasoning_content;
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
  if (message) return message;
  if (status === 401) return "AI 服务凭证无效，请联系管理员";
  if (status === 402) return "AI 服务额度不足，请稍后重试或联系管理员";
  if (status === 504 || status === 408) {
    return "AI 服务超时，请稍后重试";
  }
  return `AI 请求失败（HTTP ${status}）`;
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
