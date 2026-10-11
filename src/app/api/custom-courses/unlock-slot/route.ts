import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  CustomCourseQuotaInsufficientDiamondsError,
  CustomCourseQuotaMaxError,
  unlockCustomCourseSlot,
} from "@/lib/custom-course-quota";
import { ErrorCode } from "@/lib/error-codes";
import {
  INSUFFICIENT_DIAMONDS_CODE,
  INSUFFICIENT_DIAMONDS_MESSAGE,
} from "@/lib/vip";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return authPreflight();
}

/**
 * POST /api/custom-courses/unlock-slot
 * Spend 10 diamonds to unlock +1 custom-course slot (max 10).
 * → { quota, diamonds, unlockCost, maxQuota }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(
        jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }),
      );
    }

    const result = await unlockCustomCourseSlot(user.id);
    return withAuthCors(jsonOk(result));
  } catch (err) {
    if (err instanceof CustomCourseQuotaInsufficientDiamondsError) {
      return withAuthCors(
        jsonError(INSUFFICIENT_DIAMONDS_MESSAGE, 402, {
          code: INSUFFICIENT_DIAMONDS_CODE,
          diamonds: err.balance,
        }),
      );
    }
    if (err instanceof CustomCourseQuotaMaxError) {
      return withAuthCors(
        jsonError("自制词库名额已达上限", 403, {
          code: ErrorCode.CUSTOM_COURSE_QUOTA_MAX,
          quota: err.quota,
          maxQuota: 10,
        }),
      );
    }
    console.error(err);
    return withAuthCors(
      jsonError("开通失败，请稍后重试", 500, { code: ErrorCode.SAVE_FAILED }),
    );
  }
}
