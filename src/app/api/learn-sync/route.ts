import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { ErrorCode } from "@/lib/error-codes";
import { SyncCodecError, SYNC_LIMITS } from "@/lib/learn-sync-codec";
import {
  LEARN_SYNC_MESSAGES,
  LearnSyncTooLargeError,
  learnSyncGate,
  learnSyncRateLimit,
  pullLearnSync,
  pushLearnSync,
} from "@/lib/learn-sync-db";

export const dynamic = "force-dynamic";

/** base64 of a ≤1 MB gzip body, plus JSON overhead. */
const MAX_BODY_CHARS = Math.ceil((SYNC_LIMITS.maxGzBytes * 4) / 3) + 4096;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function OPTIONS() {
  return authPreflight();
}

function rateLimited(seconds: number) {
  return withAuthCors(
    jsonError("请求过于频繁，请过段时间再试", 429, {
      code: ErrorCode.RATE_LIMITED,
      retryAfterSec: seconds,
    }),
  );
}

function tooLarge() {
  return withAuthCors(
    jsonError(LEARN_SYNC_MESSAGES.tooLarge, 413, {
      code: ErrorCode.CLOUD_SYNC_TOO_LARGE,
    }),
  );
}

/**
 * GET /api/learn-sync?rev=N
 *   Logged-in + active paid VIP only.
 *   → { rev, unchanged: true }                  when N equals the server rev
 *   → { rev, unchanged: false, data, updatedAt } data = base64 gzip snapshot, or null when the cloud is empty
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const gate = learnSyncGate(user);
    if (gate || !user) {
      return withAuthCors(jsonError(gate!.message, gate!.status, { code: gate!.code }));
    }
    const appId = clientAppFromRequest(req);
    const wait = learnSyncRateLimit(user.id, appId, "pull");
    if (wait > 0) return rateLimited(wait);

    const revRaw = new URL(req.url).searchParams.get("rev");
    const revNum = revRaw === null || revRaw === "" ? null : Number(revRaw);
    const knownRev =
      revNum !== null && Number.isInteger(revNum) && revNum >= 0 ? revNum : null;

    const result = await pullLearnSync(user.id, appId, knownRev);
    if (result.unchanged) {
      return withAuthCors(jsonOk({ rev: result.rev, unchanged: true, updatedAt: result.updatedAt }));
    }
    return withAuthCors(
      jsonOk({
        rev: result.rev,
        unchanged: false,
        data: result.gz ? result.gz.toString("base64") : null,
        updatedAt: result.updatedAt,
      }),
    );
  } catch (err) {
    if (err instanceof LearnSyncTooLargeError) return tooLarge();
    console.error(err);
    return withAuthCors(jsonError("加载失败", 500, { code: ErrorCode.LOAD_FAILED }));
  }
}

/**
 * POST /api/learn-sync
 * Body: { baseRev: number, deviceId?: string, data: base64(gzip(compact delta)) }
 *   → { rev, unchanged: true }               server was at baseRev; client already has the merged state
 *   → { rev, unchanged: false, data }        another device wrote: data = merged snapshot (base64 gzip)
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const gate = learnSyncGate(user);
    if (gate || !user) {
      return withAuthCors(jsonError(gate!.message, gate!.status, { code: gate!.code }));
    }
    const appId = clientAppFromRequest(req);

    const length = Number(req.headers.get("content-length") || 0);
    if (length > MAX_BODY_CHARS) return tooLarge();

    const wait = learnSyncRateLimit(user.id, appId, "push");
    if (wait > 0) return rateLimited(wait);

    const text = await req.text();
    if (text.length > MAX_BODY_CHARS) return tooLarge();
    let body: { baseRev?: unknown; deviceId?: unknown; data?: unknown };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      return withAuthCors(jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }));
    }

    const baseRev = Number(body.baseRev);
    const data = typeof body.data === "string" ? body.data : "";
    const deviceId =
      typeof body.deviceId === "string" && DEVICE_ID_RE.test(body.deviceId)
        ? body.deviceId
        : null;
    if (!Number.isInteger(baseRev) || baseRev < 0 || !data || !BASE64_RE.test(data)) {
      return withAuthCors(jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }));
    }
    const deltaGz = Buffer.from(data, "base64");
    if (deltaGz.length === 0) {
      return withAuthCors(jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }));
    }
    if (deltaGz.length > SYNC_LIMITS.maxGzBytes) return tooLarge();

    const result = await pushLearnSync({
      userId: user.id,
      appId,
      baseRev,
      deviceId,
      deltaGz,
    });
    if (result.unchanged) {
      return withAuthCors(jsonOk({ rev: result.rev, unchanged: true, updatedAt: result.updatedAt }));
    }
    return withAuthCors(
      jsonOk({
        rev: result.rev,
        unchanged: false,
        data: result.gz ? result.gz.toString("base64") : null,
        updatedAt: result.updatedAt,
      }),
    );
  } catch (err) {
    if (err instanceof LearnSyncTooLargeError) return tooLarge();
    if (err instanceof SyncCodecError) {
      return withAuthCors(jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }));
    }
    const zlibCode = (err as { code?: string })?.code;
    if (typeof zlibCode === "string" && zlibCode.startsWith("Z_")) {
      return withAuthCors(jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }));
    }
    console.error(err);
    return withAuthCors(jsonError("保存失败，请稍后重试", 500, { code: ErrorCode.SAVE_FAILED }));
  }
}
