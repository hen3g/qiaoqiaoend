/**
 * Microsoft Edge / Translator free TTS client
 * (ported from /Users/xuezhiwen/tts/tts_client.py).
 */
import { createHmac, randomUUID } from "node:crypto";
import { rename, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const MT_APP_KEY = Buffer.from(
  "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==",
  "base64",
);

const ENDPOINT_URL =
  "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
const TOKEN_REFRESH_BEFORE_EXPIRY = 3 * 60; // seconds
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0";

export class RateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitedError";
  }
}

type EndpointPayload = { r: string; t: string };

function dateFormat(): string {
  return new Date().toUTCString().toLowerCase();
}

/** Match Python urllib.parse.quote(url, safe=""). */
function quoteAll(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function sign(urlStr: string): string {
  const url = urlStr.split("://", 2)[1] ?? urlStr;
  const encoded = quoteAll(url);
  const uuidStr = randomUUID().replace(/-/g, "");
  const formattedDate = dateFormat();
  const bytesToSign =
    `MSTranslatorAndroidApp${encoded}${formattedDate}${uuidStr}`.toLowerCase();
  const digest = createHmac("sha256", MT_APP_KEY)
    .update(bytesToSign)
    .digest("base64");
  return `MSTranslatorAndroidApp::${digest}::${formattedDate}::${uuidStr}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type TtsClientOptions = {
  voice?: string;
  speed?: number;
  pitch?: string;
  volume?: string;
  style?: string;
  outputFormat?: string;
  timeoutMs?: number;
};

export class TtsClient {
  voice: string;
  speed: number;
  pitch: string;
  volume: string;
  style: string;
  outputFormat: string;
  timeoutMs: number;

  private endpoint: EndpointPayload | null = null;
  private tokenExp = 0;
  private endpointPromise: Promise<EndpointPayload> | null = null;

  constructor(opts: TtsClientOptions = {}) {
    this.voice = opts.voice ?? "en-US-JennyNeural";
    this.speed = opts.speed ?? 1.0;
    this.pitch = opts.pitch ?? "0%";
    this.volume = opts.volume ?? "0%";
    this.style = opts.style ?? "general";
    this.outputFormat =
      opts.outputFormat ?? "audio-24khz-48kbitrate-mono-mp3";
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  ratePercent(): string {
    const pct = Math.round((this.speed - 1) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}%`;
  }

  async getEndpoint(): Promise<EndpointPayload> {
    const now = Date.now() / 1000;
    if (
      this.endpoint &&
      this.tokenExp &&
      now < this.tokenExp - TOKEN_REFRESH_BEFORE_EXPIRY
    ) {
      return this.endpoint;
    }

    if (this.endpointPromise) return this.endpointPromise;

    this.endpointPromise = (async () => {
      const nowInner = Date.now() / 1000;
      if (
        this.endpoint &&
        this.tokenExp &&
        nowInner < this.tokenExp - TOKEN_REFRESH_BEFORE_EXPIRY
      ) {
        return this.endpoint;
      }

      const clientId = randomUUID().replace(/-/g, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(ENDPOINT_URL, {
          method: "POST",
          headers: {
            "Accept-Language": "zh-Hans",
            "X-ClientVersion": "4.0.530a 5fe1dc6c",
            "X-UserId": "0f04d16a175c411e",
            "X-HomeGeographicRegion": "zh-Hans-CN",
            "X-ClientTraceId": clientId,
            "X-MT-Signature": sign(ENDPOINT_URL),
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: "",
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = (await response.text()).slice(0, 300);
          throw new Error(
            `Failed to get Edge TTS endpoint: HTTP ${response.status} ${body}`,
          );
        }
        const data = (await response.json()) as EndpointPayload;
        const token = data.t || "";
        let exp = nowInner + 600;
        try {
          const payload = token.split(".")[1] ?? "";
          const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
          const decoded = JSON.parse(
            Buffer.from(padded, "base64url").toString("utf8"),
          ) as { exp?: number };
          if (decoded.exp) exp = Number(decoded.exp);
        } catch {
          /* keep default */
        }
        this.endpoint = data;
        this.tokenExp = exp;
        return data;
      } finally {
        clearTimeout(timer);
        this.endpointPromise = null;
      }
    })();

    return this.endpointPromise;
  }

  buildSsml(text: string, voice?: string): string {
    const escaped = escapeXml(text);
    const rate = this.ratePercent();
    const voiceName = voice || this.voice;
    const parts = voiceName.split("-");
    const lang =
      parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "en-US";
    return (
      `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' ` +
      `xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='${lang}'>` +
      `<voice name='${voiceName}'>` +
      `<mstts:express-as style='${this.style}'>` +
      `<prosody rate='${rate}' pitch='${this.pitch}' volume='${this.volume}'>` +
      `${escaped}` +
      `</prosody>` +
      `</mstts:express-as>` +
      `</voice>` +
      `</speak>`
    );
  }

  async synthesise(text: string, voice?: string): Promise<Buffer> {
    const endpoint = await this.getEndpoint();
    const region = endpoint.r;
    const token = endpoint.t;
    if (!region || !token) {
      throw new Error(`Invalid endpoint payload: ${JSON.stringify(endpoint)}`);
    }

    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/ssml+xml",
          "User-Agent": USER_AGENT,
          "X-Microsoft-OutputFormat": this.outputFormat,
        },
        body: this.buildSsml(text, voice),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new RateLimitedError(
          (await response.text()).slice(0, 300),
        );
      }
      if (response.status !== 200 && response.status !== 201) {
        if (response.status === 401 || response.status === 403) {
          this.endpoint = null;
          this.tokenExp = 0;
        }
        const body = (await response.text()).slice(0, 500);
        throw new Error(`Edge TTS failed HTTP ${response.status}: ${body}`);
      }

      const data = Buffer.from(await response.arrayBuffer());
      if (data.length < 100) {
        throw new Error(`Audio payload too small (${data.length} bytes)`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async synthesiseWithRetry(
    text: string,
    opts: { voice?: string; maxRetries?: number } = {},
  ): Promise<Buffer> {
    const maxRetries = opts.maxRetries ?? 3;
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.synthesise(text, opts.voice);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        const retryable =
          err instanceof RateLimitedError ||
          msg.includes("401") ||
          msg.includes("403") ||
          msg.includes("500") ||
          msg.includes("502") ||
          msg.includes("503") ||
          (err instanceof Error && err.name === "AbortError");
        if (!retryable || attempt >= maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw new Error(`Edge TTS failed after retries: ${String(lastError)}`);
  }

  async synthesiseToFile(
    text: string,
    filePath: string,
    opts: { voice?: string; maxRetries?: number } = {},
  ): Promise<string> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const audio = await this.synthesiseWithRetry(text, opts);
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, audio);
    await rename(tmp, filePath);
    return filePath;
  }
}
