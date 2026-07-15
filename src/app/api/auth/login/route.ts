import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import {
  createSessionToken,
  mapUser,
  setSessionCookie,
} from "@/lib/auth";
import { requireCapToken } from "@/lib/cap";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const schema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
  captchaToken: z.string().min(1, "请先完成人机验证"),
});

type UserAuthRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  password_hash: string;
  vip_expires_at: Date | string | null;
  created_at: Date | string | null;
};

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    try {
      await requireCapToken(body.captchaToken);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "人机验证失败");
    }

    const username = body.username.trim().toLowerCase();

    const rows = await query<UserAuthRow[]>(
      `SELECT id, username, nickname, password_hash, vip_expires_at, created_at
       FROM users
       WHERE username = :username
       LIMIT 1`,
      { username },
    );
    const user = rows[0];
    if (!user) {
      return jsonError("用户不存在", 401);
    }

    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) {
      return jsonError("密码错误", 401);
    }

    const token = await createSessionToken(user.id);
    await setSessionCookie(token);

    return jsonOk({
      message: "登录成功",
      user: mapUser(user),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    console.error(err);
    return jsonError("登录失败，请稍后重试", 500);
  }
}
