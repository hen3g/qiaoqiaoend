import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  createSessionToken,
  mapUser,
  setSessionCookie,
} from "@/lib/auth";
import { clientAppFromRequest } from "@/lib/client-app";
import { execute, query } from "@/lib/db";
import {
  consumeIpRateLimitAll,
  IP_RATE_DAY_MS,
  ipRateLimitedPeekAll,
  type IpRateCheck,
} from "@/lib/ip-rate-limit";
import { createDefaultNickname } from "@/lib/nickname";
import { hashPassword } from "@/lib/password";
import {
  ensureShareCustomCoursesColumn,
  ensureUserAppColumns,
  ensureUserDiamondsColumn,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";

const schema = z
  .object({
    username: z
      .string()
      .min(3, "用户名至少 3 位")
      .max(32, "用户名最多 32 位")
      .regex(/^[a-zA-Z0-9_]+$/, "用户名仅支持字母、数字和下划线"),
    password: z.string().min(6, "密码至少 6 位").max(72, "密码过长"),
    passwordConfirm: z.string().min(1, "请再次输入密码"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "两次输入的密码不一致",
    path: ["passwordConfirm"],
  });

async function allocateDefaultNickname(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nickname = createDefaultNickname();
    const existing = await query<RowDataPacket[]>(
      `SELECT id FROM users WHERE nickname = :nickname LIMIT 1`,
      { nickname },
    );
    if (!existing[0]) return nickname;
  }
  return createDefaultNickname(14);
}

const REGISTER_LIMITS: IpRateCheck[] = [
  { action: "register" },
  { action: "register-day", max: 8, windowMs: IP_RATE_DAY_MS },
];

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const blocked = await ipRateLimitedPeekAll(req, REGISTER_LIMITS);
    if (blocked) return withAuthCors(blocked);

    const body = schema.parse(await req.json());
    const username = body.username.toLowerCase();

    const existing = await query<RowDataPacket[]>(
      `SELECT id FROM users WHERE username = :username LIMIT 1`,
      { username },
    );
    if (existing[0]) {
      return withAuthCors(jsonError("用户名已被注册", 409));
    }

    const limited = await consumeIpRateLimitAll(req, REGISTER_LIMITS);
    if (limited) return withAuthCors(limited);

    const nickname = await allocateDefaultNickname();
    const passwordHash = await hashPassword(body.password);
    const appId = clientAppFromRequest(req);
    await ensureUserAppColumns();
    const result = await execute(
      `INSERT INTO users (username, password_hash, nickname, register_app_id, last_app_id)
       VALUES (:username, :passwordHash, :nickname, :appId, :appId)`,
      { username, passwordHash, nickname, appId },
    );

    const userId = Number(result.insertId);
    const token = await createSessionToken(userId);
    await setSessionCookie(token);

    await ensureUserDiamondsColumn();
    await ensureShareCustomCoursesColumn();
    await ensureUserPromoterColumns();
    const rows = await query<
      (RowDataPacket & {
        id: number;
        username: string;
        nickname: string | null;
        avatar_url: string | null;
        vip_expires_at: Date | string | null;
        diamonds: number;
        share_custom_courses: number | boolean | null;
        is_promoter: number | boolean | null;
        promoter_id: number | null;
        created_at: Date | string | null;
      })[]
    >(
      `SELECT id, username, nickname, avatar_url, vip_expires_at, diamonds,
              share_custom_courses, is_promoter, promoter_id, created_at
       FROM users WHERE id = :id`,
      { id: userId },
    );

    return withAuthCors(
      jsonOk({
        message: "注册成功",
        token,
        user: mapUser(rows[0]),
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("注册失败，请稍后重试", 500));
  }
}
