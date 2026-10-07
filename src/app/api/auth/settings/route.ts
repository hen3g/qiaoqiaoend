import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import {
  getCurrentUser,
  mapUser,
  SESSION_USER_COLUMNS,
  type SessionUserRow,
} from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { execute, query } from "@/lib/db";
import {
  ensureShareCustomCoursesColumn,
  ensureUserPromoterColumns,
  ensureUserPaidVipColumns,
} from "@/lib/user-schema";
import { ErrorCode } from "@/lib/error-codes";

const schema = z.object({
  shareCustomCourses: z.boolean(),
});

export async function OPTIONS() {
  return authPreflight();
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }));
    }

    const body = schema.parse(await req.json());
    await ensureShareCustomCoursesColumn();
    await ensureUserPromoterColumns();

    await execute(
      `UPDATE users
       SET share_custom_courses = :share
       WHERE id = :id`,
      {
        share: body.shareCustomCourses ? 1 : 0,
        id: user.id,
      },
    );

    await ensureUserPaidVipColumns();
    const rows = await query<SessionUserRow[]>(
      `SELECT ${SESSION_USER_COLUMNS}
       FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const row = rows[0];
    if (!row) {
      return withAuthCors(jsonError("账号不存在", 404, { code: ErrorCode.ACCOUNT_NOT_FOUND }));
    }

    return withAuthCors(
      jsonOk({
        message: body.shareCustomCourses
          ? "已开启课程分享"
          : "已关闭课程分享",
        user: mapUser(row),
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("保存失败，请稍后重试", 500, { code: ErrorCode.SAVE_FAILED }));
  }
}
