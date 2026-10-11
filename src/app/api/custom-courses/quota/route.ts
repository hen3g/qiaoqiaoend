import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { getCustomCourseQuota } from "@/lib/custom-course-quota";
import { ErrorCode } from "@/lib/error-codes";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return authPreflight();
}

/**
 * GET /api/custom-courses/quota
 * → { quota, maxQuota, defaultQuota, unlockCost, diamonds, canUnlock }
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(
        jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }),
      );
    }
    const status = await getCustomCourseQuota(user.id);
    return withAuthCors(jsonOk(status));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError("读取失败", 500, { code: ErrorCode.LOAD_FAILED }),
    );
  }
}
