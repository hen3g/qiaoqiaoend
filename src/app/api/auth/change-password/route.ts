import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { consumeIpRateLimit, ipRateLimitedPeek } from "@/lib/ip-rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";

const schema = z
  .object({
    oldPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z.string().min(6, "新密码至少 6 位").max(72, "密码过长"),
    newPasswordConfirm: z.string().min(1, "请再次输入新密码"),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "两次输入的新密码不一致",
    path: ["newPasswordConfirm"],
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
  });

const PASSWORD_LIMIT = { max: 5 } as const;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonError("请先登录", 401);
    }

    const blocked = await ipRateLimitedPeek(req, "change-password", PASSWORD_LIMIT);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());
    const rows = await query<(RowDataPacket & { password_hash: string })[]>(
      `SELECT password_hash FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const row = rows[0];
    if (!row) {
      return jsonError("账号不存在", 404);
    }

    const ok = await verifyPassword(body.oldPassword, row.password_hash);
    if (!ok) {
      await consumeIpRateLimit(req, "change-password", PASSWORD_LIMIT);
      return jsonError("当前密码不正确");
    }

    const passwordHash = await hashPassword(body.newPassword);
    await execute(`UPDATE users SET password_hash = :passwordHash WHERE id = :id`, {
      passwordHash,
      id: user.id,
    });

    return jsonOk({ message: "密码已修改" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    console.error(err);
    return jsonError("修改失败，请稍后重试", 500);
  }
}
