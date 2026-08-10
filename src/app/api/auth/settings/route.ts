import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser, mapUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { execute, query } from "@/lib/db";
import { ensureShareCustomCoursesColumn, ensureUserPromoterColumns } from "@/lib/user-schema";

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
      return withAuthCors(jsonError("请先登录", 401));
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

    const rows = await query<
      (RowDataPacket & {
        id: number;
        username: string;
        nickname: string | null;
        avatar_url: string | null;
        vip_expires_at: Date | string | null;
        diamonds: number;
        share_custom_courses: number | boolean;
        is_promoter: number | boolean | null;
        promoter_id: number | null;
        created_at: Date | string | null;
      })[]
    >(
      `SELECT id, username, nickname, avatar_url, vip_expires_at, diamonds,
              share_custom_courses, is_promoter, promoter_id, created_at
       FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const row = rows[0];
    if (!row) {
      return withAuthCors(jsonError("账号不存在", 404));
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
    return withAuthCors(jsonError("保存失败，请稍后重试", 500));
  }
}
