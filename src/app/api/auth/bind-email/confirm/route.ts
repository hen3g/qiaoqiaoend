import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser, mapUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { query } from "@/lib/db";
import {
  bindUserEmail,
  findUserIdByEmail,
  isValidEmail,
  normalizeEmail,
  verifyAndConsumeBindCode,
} from "@/lib/email-bind";
import { ensureUserEmailColumn } from "@/lib/user-schema";

const schema = z.object({
  email: z.string().min(1, "请输入邮箱"),
  code: z
    .string()
    .regex(/^\d{6}$/, "请输入 6 位数字验证码"),
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

    const body = schema.parse(await req.json());
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return withAuthCors(jsonError("邮箱格式不正确", 400));
    }

    const ownerId = await findUserIdByEmail(email);
    if (ownerId != null && ownerId !== user.id) {
      return withAuthCors(jsonError("该邮箱已被其他账号绑定", 409));
    }

    const verified = await verifyAndConsumeBindCode({
      userId: user.id,
      email,
      code: body.code,
    });

    if (!verified.ok) {
      const messages = {
        not_found: "请先获取验证码",
        expired: "验证码已过期，请重新获取",
        mismatch: "验证码错误",
        too_many: "验证次数过多，请重新获取验证码",
      } as const;
      return withAuthCors(jsonError(messages[verified.reason], 400));
    }

    await bindUserEmail(user.id, verified.email);
    await ensureUserEmailColumn();

    const rows = await query<
      (RowDataPacket & {
        id: number;
        username: string;
        nickname: string | null;
        email: string | null;
        avatar_url: string | null;
        vip_expires_at: Date | string | null;
        diamonds: number;
        share_custom_courses: number | boolean | null;
        is_promoter: number | boolean | null;
        promoter_id: number | null;
        created_at: Date | string | null;
      })[]
    >(
      `SELECT id, username, nickname, email, avatar_url, vip_expires_at, diamonds,
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
        message: "邮箱绑定成功",
        user: mapUser(row),
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("绑定失败，请稍后重试", 500));
  }
}
