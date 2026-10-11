import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { ErrorCode } from "@/lib/error-codes";
import {
  CUSTOM_COURSES_SYNC_LIMITS,
  CUSTOM_COURSES_SYNC_MESSAGES,
  CustomCoursesSyncTooLargeError,
  customCoursesSyncRateLimit,
  pullCustomCoursesSync,
  pushCustomCoursesSync,
} from "@/lib/custom-courses-sync-db";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS =
  Math.ceil((CUSTOM_COURSES_SYNC_LIMITS.maxGzBytes * 4) / 3) + 4096;
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
    jsonError(CUSTOM_COURSES_SYNC_MESSAGES.tooLarge, 413, {
      code: ErrorCode.CUSTOM_COURSE_SYNC_TOO_LARGE,
    }),
  );
}

/**
 * GET /api/custom-courses/sync?rev=N
 * Login required. No VIP gate.
 * → { rev, unchanged: true }
 * → { rev, unchanged: false, data, updatedAt } data = base64 gzip sync doc
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(
        jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }),
      );
    }
    const appId = clientAppFromRequest(req);
    const wait = customCoursesSyncRateLimit(user.id, appId, "pull");
    if (wait > 0) return rateLimited(wait);

    const revRaw = new URL(req.url).searchParams.get("rev");
    const revNum = revRaw === null || revRaw === "" ? null : Number(revRaw);
    const knownRev =
      revNum !== null && Number.isInteger(revNum) && revNum >= 0 ? revNum : null;

    const result = await pullCustomCoursesSync(user.id, appId, knownRev);
    if (result.unchanged) {
      return withAuthCors(
        jsonOk({
          rev: result.rev,
          unchanged: true,
          updatedAt: result.updatedAt,
        }),
      );
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
    if (err instanceof CustomCoursesSyncTooLargeError) return tooLarge();
    console.error(err);
    return withAuthCors(
      jsonError("加载失败", 500, { code: ErrorCode.LOAD_FAILED }),
    );
  }
}

/**
 * POST /api/custom-courses/sync
 * Body: { baseRev: number, deviceId?: string, data: base64(gzip(sync doc)) }
 * Server merges LWW per course. Login required; no VIP gate.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(
        jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }),
      );
    }
    const appId = clientAppFromRequest(req);

    const length = Number(req.headers.get("content-length") || 0);
    if (length > MAX_BODY_CHARS) return tooLarge();

    const wait = customCoursesSyncRateLimit(user.id, appId, "push");
    if (wait > 0) return rateLimited(wait);

    const text = await req.text();
    if (text.length > MAX_BODY_CHARS) return tooLarge();
    let body: { baseRev?: unknown; deviceId?: unknown; data?: unknown };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      return withAuthCors(
        jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }),
      );
    }

    const baseRev = Number(body.baseRev);
    const data = typeof body.data === "string" ? body.data : "";
    const deviceId =
      typeof body.deviceId === "string" && DEVICE_ID_RE.test(body.deviceId)
        ? body.deviceId
        : null;
    if (
      !Number.isInteger(baseRev) ||
      baseRev < 0 ||
      !data ||
      !BASE64_RE.test(data)
    ) {
      return withAuthCors(
        jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }),
      );
    }
    const snapshotGz = Buffer.from(data, "base64");
    if (snapshotGz.length > CUSTOM_COURSES_SYNC_LIMITS.maxGzBytes) {
      return tooLarge();
    }

    const result = await pushCustomCoursesSync({
      userId: user.id,
      appId,
      baseRev,
      deviceId,
      snapshotGz,
    });

    if (result.unchanged) {
      return withAuthCors(
        jsonOk({
          rev: result.rev,
          unchanged: true,
          updatedAt: result.updatedAt,
        }),
      );
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
    if (err instanceof CustomCoursesSyncTooLargeError) return tooLarge();
    if (err instanceof SyntaxError) {
      return withAuthCors(
        jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }),
      );
    }
    console.error(err);
    return withAuthCors(
      jsonError("保存失败", 500, { code: ErrorCode.SAVE_FAILED }),
    );
  }
}
