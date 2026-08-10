import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser, mapUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { execute, query } from "@/lib/db";
import { validateNickname } from "@/lib/nickname-validate";

const schema = z.object({
  nickname: z.string(),
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
    const checked = validateNickname(body.nickname);
    if (!checked.ok) {
      return withAuthCors(jsonError(checked.message, 400));
    }
    const nickname = checked.nickname;

    if (user.nickname === nickname) {
      return withAuthCors(jsonOk({ message: "昵称未变更", user }));
    }

    const taken = await query<RowDataPacket[]>(
      `SELECT id FROM users
       WHERE LOWER(nickname) = LOWER(:nickname) AND id <> :id
       LIMIT 1`,
      { nickname, id: user.id },
    );
    if (taken[0]) {
      return withAuthCors(jsonError("该昵称已被使用", 409));
    }

    await execute(`UPDATE users SET nickname = :nickname WHERE id = :id`, {
      nickname,
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

    return withAuthCors(jsonOk({ message: "昵称已更新", user: mapUser(row) }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("修改失败，请稍后重试", 500));
  }
}
