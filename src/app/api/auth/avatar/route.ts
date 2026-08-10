import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser, mapUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  fetchAvatarPng,
  isAvatarStyle,
} from "@/lib/avatar-generate";
import { execute, query } from "@/lib/db";
import { uploadPublicObject } from "@/lib/r2";

const schema = z.object({
  style: z.string().min(1),
  seed: z
    .string()
    .trim()
    .min(1, "缺少头像参数")
    .max(64, "头像参数过长"),
  backgroundColor: z
    .string()
    .trim()
    .regex(/^[0-9A-Fa-f]{6}$/, "背景色无效"),
});

export async function OPTIONS() {
  return authPreflight();
}

/** Confirm selected avatar → upload PNG to R2 → save URL on user. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const body = schema.parse(await req.json());
    if (!isAvatarStyle(body.style)) {
      return withAuthCors(jsonError("不支持的头像风格"));
    }

    const option = {
      style: body.style,
      seed: body.seed,
      backgroundColor: body.backgroundColor.replace(/^#/, "").toUpperCase(),
    };

    const png = await fetchAvatarPng(option);
    const version = Date.now();
    const key = `avatars/${user.id}/${version}.png`;
    const uploaded = await uploadPublicObject({
      key,
      body: png,
      contentType: "image/png",
    });

    await execute(`UPDATE users SET avatar_url = :avatarUrl WHERE id = :id`, {
      avatarUrl: uploaded.url,
      id: user.id,
    });

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
       FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const row = rows[0];
    if (!row) {
      return withAuthCors(jsonError("账号不存在", 404));
    }

    return withAuthCors(
      jsonOk({
        message: "头像已更新",
        user: mapUser(row),
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    const message =
      err instanceof Error && /R2_|not configured/i.test(err.message)
        ? "头像存储未配置，请检查 R2 环境变量"
        : "保存头像失败，请稍后重试";
    return withAuthCors(jsonError(message, 500));
  }
}
