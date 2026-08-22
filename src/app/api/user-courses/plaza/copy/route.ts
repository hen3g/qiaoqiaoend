import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { query } from "@/lib/db";
import { ipRateLimited } from "@/lib/ip-rate-limit";
import { ensureShareCustomCoursesColumn } from "@/lib/user-schema";
import {
  copyPlazaCourseToUser,
  PlazaCopyError,
} from "@/lib/user-courses-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  ownerUserId: z.number().int().positive(),
  courseId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(255).optional(),
});

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    if (!user.isVip) {
      return withAuthCors(jsonError("仅会员可添加课程广场课程", 403));
    }

    const limited = await ipRateLimited(req, "plaza-copy", { max: 10 });
    if (limited) return withAuthCors(limited);

    const body = schema.parse(await req.json());
    await ensureShareCustomCoursesColumn();

    const rows = await query<
      (RowDataPacket & {
        id: number;
        username: string;
        nickname: string | null;
        share_custom_courses: number | boolean | null;
      })[]
    >(
      `SELECT id, username, nickname, share_custom_courses
       FROM users WHERE id = :id LIMIT 1`,
      { id: body.ownerUserId },
    );
    const owner = rows[0];
    if (!owner) {
      return withAuthCors(jsonError("作者不存在", 404));
    }

    const course = await copyPlazaCourseToUser({
      viewerId: user.id,
      ownerUserId: body.ownerUserId,
      courseId: body.courseId,
      title: body.title,
      owner: {
        username: owner.username,
        nickname: owner.nickname,
        shareCustomCourses:
          owner.share_custom_courses === undefined ||
          owner.share_custom_courses === null
            ? true
            : Boolean(owner.share_custom_courses),
      },
    });

    return withAuthCors(jsonOk({ course, message: "已添加到自制课程" }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    if (err instanceof PlazaCopyError) {
      return withAuthCors(jsonError(err.message, err.status));
    }
    console.error(err);
    return withAuthCors(jsonError("添加失败，请稍后重试", 500));
  }
}
