import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { execute, query } from "@/lib/db";
import { consumeIpRateLimit, ipRateLimitedPeek } from "@/lib/ip-rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ErrorCode } from "@/lib/error-codes";
import { ensureUserWechatColumns } from "@/lib/user-schema";
import { isPasswordSet } from "@/lib/wechat";

const schema = z
  .object({
    oldPassword: z.string().optional(),
    newPassword: z.string().min(6, "新密码至少 6 位").max(72, "密码过长"),
    newPasswordConfirm: z.string().min(1, "请再次输入新密码"),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "两次输入的新密码不一致",
    path: ["newPasswordConfirm"],
  });

const PASSWORD_LIMIT = { max: 5 } as const;

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(
        jsonError("请先登录", 401, { code: ErrorCode.LOGIN_REQUIRED }),
      );
    }

    const blocked = await ipRateLimitedPeek(req, "change-password", PASSWORD_LIMIT);
    if (blocked) return withAuthCors(blocked);

    await ensureUserWechatColumns();
    const body = schema.parse(await req.json());
    const rows = await query<(RowDataPacket & { password_hash: string | null })[]>(
      `SELECT password_hash FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const row = rows[0];
    if (!row) {
      return withAuthCors(
        jsonError("账号不存在", 404, { code: ErrorCode.ACCOUNT_NOT_FOUND }),
      );
    }

    const hasPassword = isPasswordSet(row.password_hash);

    if (hasPassword) {
      const oldPassword = (body.oldPassword || "").trim();
      if (!oldPassword) {
        return withAuthCors(
          jsonError("请输入当前密码", 400, { code: ErrorCode.BAD_PARAMS }),
        );
      }
      if (oldPassword === body.newPassword) {
        return withAuthCors(
          jsonError("新密码不能与当前密码相同", 400, {
            code: ErrorCode.PASSWORD_SAME,
          }),
        );
      }
      const ok = await verifyPassword(oldPassword, row.password_hash);
      if (!ok) {
        await consumeIpRateLimit(req, "change-password", PASSWORD_LIMIT);
        return withAuthCors(
          jsonError("当前密码不正确", 400, {
            code: ErrorCode.BAD_CURRENT_PASSWORD,
          }),
        );
      }
    }

    const passwordHash = await hashPassword(body.newPassword);
    await execute(`UPDATE users SET password_hash = :passwordHash WHERE id = :id`, {
      passwordHash,
      id: user.id,
    });

    return withAuthCors(
      jsonOk({
        message: hasPassword ? "密码已修改" : "初始密码已设置",
        hasPassword: true,
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(
      jsonError("修改失败，请稍后重试", 500, { code: ErrorCode.UPDATE_FAILED }),
    );
  }
}
