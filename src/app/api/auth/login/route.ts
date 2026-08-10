import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  createSessionToken,
  mapUser,
  setSessionCookie,
} from "@/lib/auth";
import { query } from "@/lib/db";
import { isValidEmail } from "@/lib/email-bind";
import { verifyPassword } from "@/lib/password";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserEmailColumn,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";

const schema = z.object({
  username: z.string().min(1, "请输入用户名或邮箱"),
  password: z.string().min(1, "请输入密码"),
});

type UserAuthRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  email: string | null;
  avatar_url: string | null;
  password_hash: string;
  vip_expires_at: Date | string | null;
  diamonds: number;
  share_custom_courses: number | boolean | null;
  is_promoter: number | boolean | null;
  promoter_id: number | null;
  created_at: Date | string | null;
};

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const identifier = body.username.trim().toLowerCase();
    await ensureUserDiamondsColumn();
    await ensureShareCustomCoursesColumn();
    await ensureUserPromoterColumns();
    await ensureUserEmailColumn();

    const byEmail = isValidEmail(identifier);
    const rows = await query<UserAuthRow[]>(
      `SELECT id, username, nickname, email, avatar_url, password_hash, vip_expires_at, diamonds,
              share_custom_courses, is_promoter, promoter_id, created_at
       FROM users
       WHERE ${byEmail ? "email = :identifier" : "username = :identifier"}
       LIMIT 1`,
      { identifier },
    );
    const user = rows[0];
    if (!user) {
      return withAuthCors(jsonError("用户不存在", 401));
    }

    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) {
      return withAuthCors(jsonError("密码错误", 401));
    }

    const token = await createSessionToken(user.id);
    await setSessionCookie(token);

    return withAuthCors(
      jsonOk({
        message: "登录成功",
        token,
        user: mapUser(user),
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("登录失败，请稍后重试", 500));
  }
}
