import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { ErrorCode } from "@/lib/error-codes";
import {
  getManorWishStatus,
  MANOR_SYNC_MESSAGES,
  ManorWishInsufficientDiamondsError,
  ManorWishNeedCorrectError,
  manorSyncRateLimit,
  performManorWish,
} from "@/lib/manor-sync-db";
import { INSUFFICIENT_DIAMONDS_CODE, INSUFFICIENT_DIAMONDS_MESSAGE } from "@/lib/vip";

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
 * GET /api/manor/wish
 * Wish gate status for UI (todayCorrect, free remaining, etc.).
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }));
    }
    const appId = clientAppFromRequest(req);
    const wait = manorSyncRateLimit(user.id, appId, "wishStatus");
    if (wait > 0) return rateLimited(wait);

    const status = await getManorWishStatus(user.id, appId);
    return withAuthCors(jsonOk(status));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载失败", 500, { code: ErrorCode.LOAD_FAILED }));
  }
}

/**
 * POST /api/manor/wish
 * Authoritative ding/wish. Client then adds +1 star + random item locally and pushes manor-sync.
 * → { free, wishCount, wishDay, freeRemaining, freeUnlocked, todayCorrect, needCorrect,
 *     diamondCost, dailyFreeMax, diamondsSpent, diamonds, starsGranted }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }));
    }
    const appId = clientAppFromRequest(req);
    const wait = manorSyncRateLimit(user.id, appId, "wish");
    if (wait > 0) return rateLimited(wait);

    const result = await performManorWish(user.id, appId);
    return withAuthCors(jsonOk(result));
  } catch (err) {
    if (err instanceof ManorWishNeedCorrectError) {
      return withAuthCors(
        jsonError(MANOR_SYNC_MESSAGES.needCorrect, 403, {
          code: ErrorCode.MANOR_WISH_NEED_CORRECT,
          todayCorrect: err.todayCorrect,
          needCorrect: 10,
        }),
      );
    }
    if (err instanceof ManorWishInsufficientDiamondsError) {
      return withAuthCors(
        jsonError(INSUFFICIENT_DIAMONDS_MESSAGE, 402, {
          code: INSUFFICIENT_DIAMONDS_CODE,
          diamonds: err.balance,
        }),
      );
    }
    console.error(err);
    return withAuthCors(jsonError("保存失败，请稍后重试", 500, { code: ErrorCode.SAVE_FAILED }));
  }
}
