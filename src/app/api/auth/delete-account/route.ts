import type { RowDataPacket } from "mysql2";
import { z } from "zod";

import { deleteAccountForUser } from "@/lib/account-delete";
import { jsonError, jsonOk } from "@/lib/api";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { query } from "@/lib/db";
import { consumeIpRateLimit, ipRateLimitedPeek } from "@/lib/ip-rate-limit";
import { verifyPassword } from "@/lib/password";

const schema = z.object({
  password: z.string().min(1, "请输入当前密码"),
});

const DELETE_LIMIT = { max: 5 } as const;

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const blocked = await ipRateLimitedPeek(req, "delete-account", DELETE_LIMIT);
    if (blocked) return withAuthCors(blocked);

    const body = schema.parse(await req.json());
    const rows = await query<(RowDataPacket & { password_hash: string })[]>(
      `SELECT password_hash FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const row = rows[0];
    if (!row) {
      return withAuthCors(jsonError("账号不存在", 404));
    }

    const ok = await verifyPassword(body.password, row.password_hash);
    if (!ok) {
      await consumeIpRateLimit(req, "delete-account", DELETE_LIMIT);
      return withAuthCors(jsonError("当前密码不正确"));
    }

    await deleteAccountForUser(user.id);
    await clearSessionCookie();

    return withAuthCors(jsonOk({ message: "账号已删除" }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("删除失败，请稍后重试", 500));
  }
}
