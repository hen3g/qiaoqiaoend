import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { ErrorCode } from "@/lib/error-codes";
import {
  getLearnSyncStatus,
  learnSyncGate,
  learnSyncRateLimit,
  markLearnSyncEnabled,
} from "@/lib/learn-sync-db";

export const dynamic = "force-dynamic";

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

/**
 * GET /api/learn-sync/status
 *   Logged-in + active paid VIP only (same gate as /api/learn-sync).
 *   → { everEnabled, rev, empty, updatedAt }
 *   everEnabled: the account switched cloud sync on at least once on any device
 *   (stays true even after it is switched off). Used right after login to offer
 *   syncing on a device where the switch is off.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const gate = learnSyncGate(user);
    if (gate || !user) {
      return withAuthCors(jsonError(gate!.message, gate!.status, { code: gate!.code }));
    }
    const appId = clientAppFromRequest(req);
    const wait = learnSyncRateLimit(user.id, appId, "status");
    if (wait > 0) return rateLimited(wait);
    const status = await getLearnSyncStatus(user.id, appId);
    return withAuthCors(jsonOk(status));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载失败", 500, { code: ErrorCode.LOAD_FAILED }));
  }
}

/**
 * POST /api/learn-sync/status   body: { enabled: true }
 *   Records that the account switched sync on, for enables that do not upload
 *   anything (使用云端). Pushes record it automatically.
 *   → { everEnabled: true }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const gate = learnSyncGate(user);
    if (gate || !user) {
      return withAuthCors(jsonError(gate!.message, gate!.status, { code: gate!.code }));
    }
    let body: { enabled?: unknown } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return withAuthCors(jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }));
    }
    if (body?.enabled !== true) {
      return withAuthCors(jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }));
    }
    const appId = clientAppFromRequest(req);
    const wait = learnSyncRateLimit(user.id, appId, "mark");
    if (wait > 0) return rateLimited(wait);
    await markLearnSyncEnabled(user.id, appId);
    return withAuthCors(jsonOk({ everEnabled: true }));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("保存失败，请稍后重试", 500, { code: ErrorCode.SAVE_FAILED }));
  }
}
