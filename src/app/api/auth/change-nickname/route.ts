import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser, mapUser } from "@/lib/auth";
import { execute, query } from "@/lib/db";

const schema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, "请输入昵称")
    .max(32, "昵称最多 32 个字符"),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonError("请先登录", 401);
    }

    const body = schema.parse(await req.json());
    const nickname = body.nickname;

    if (user.nickname === nickname) {
      return jsonOk({ message: "昵称未变更", user });
    }

    const taken = await query<RowDataPacket[]>(
      `SELECT id FROM users
       WHERE LOWER(nickname) = LOWER(:nickname) AND id <> :id
       LIMIT 1`,
      { nickname, id: user.id },
    );
    if (taken[0]) {
      return jsonError("该昵称已被使用", 409);
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
        vip_expires_at: Date | string | null;
        created_at: Date | string | null;
      })[]
    >(
      `SELECT id, username, nickname, vip_expires_at, created_at
       FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const row = rows[0];
    if (!row) {
      return jsonError("账号不存在", 404);
    }

    return jsonOk({ message: "昵称已更新", user: mapUser(row) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    console.error(err);
    return jsonError("修改失败，请稍后重试", 500);
  }
}
