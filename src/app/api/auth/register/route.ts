import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import {
  createSessionToken,
  mapUser,
  setSessionCookie,
} from "@/lib/auth";
import { requireCapToken } from "@/lib/cap";
import { execute, query } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const schema = z
  .object({
    username: z
      .string()
      .min(3, "用户名至少 3 位")
      .max(32, "用户名最多 32 位")
      .regex(/^[a-zA-Z0-9_]+$/, "用户名仅支持字母、数字和下划线"),
    password: z.string().min(6, "密码至少 6 位").max(72, "密码过长"),
    passwordConfirm: z.string().min(1, "请再次输入密码"),
    captchaToken: z.string().min(1, "请先完成人机验证"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "两次输入的密码不一致",
    path: ["passwordConfirm"],
  });

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    try {
      await requireCapToken(body.captchaToken);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "人机验证失败");
    }

    const username = body.username.toLowerCase();

    const existing = await query<RowDataPacket[]>(
      `SELECT id FROM users WHERE username = :username LIMIT 1`,
      { username },
    );
    if (existing[0]) {
      return jsonError("用户名已被注册", 409);
    }

    const passwordHash = await hashPassword(body.password);
    const result = await execute(
      `INSERT INTO users (username, password_hash, nickname)
       VALUES (:username, :passwordHash, :nickname)`,
      { username, passwordHash, nickname: username },
    );

    const userId = Number(result.insertId);
    const token = await createSessionToken(userId);
    await setSessionCookie(token);

    const rows = await query<
      (RowDataPacket & {
        id: number;
        username: string;
        nickname: string | null;
        vip_expires_at: Date | string | null;
        created_at: Date | string | null;
      })[]
    >(
      `SELECT id, username, nickname, vip_expires_at, created_at FROM users WHERE id = :id`,
      { id: userId },
    );

    return jsonOk({
      message: "注册成功",
      user: mapUser(rows[0]),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    console.error(err);
    return jsonError("注册失败，请稍后重试", 500);
  }
}
