import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { bumpUserTokenVersion } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { execute, query } from "@/lib/db";
import {
  findUserIdByEmail,
  isValidEmail,
  normalizeEmail,
} from "@/lib/email-bind";
import { consumeIpRateLimit, ipRateLimitedPeek } from "@/lib/ip-rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { verifyAndConsumeResetCode } from "@/lib/password-reset";
import { ensureUserEmailColumn } from "@/lib/user-schema";
import { ErrorCode } from "@/lib/error-codes";

const schema = z
  .object({
    email: z.string().min(1, "请输入邮箱"),
    code: z.string().regex(/^\d{6}$/, "请输入 6 位数字验证码"),
    newPassword: z.string().min(6, "新密码至少 6 位").max(72, "密码过长"),
    newPasswordConfirm: z.string().min(1, "请再次输入新密码"),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "两次输入的新密码不一致",
    path: ["newPasswordConfirm"],
  });

const VERIFY_LIMIT = { max: 5 } as const;

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const blocked = await ipRateLimitedPeek(req, "email-verify", VERIFY_LIMIT);
    if (blocked) return withAuthCors(blocked);

    await ensureUserEmailColumn();
    const body = schema.parse(await req.json());
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return withAuthCors(jsonError("邮箱格式不正确", 400, { code: ErrorCode.BAD_EMAIL }));
    }

    const userId = await findUserIdByEmail(email);
    if (userId == null) {
      return withAuthCors(jsonError("该邮箱未绑定账号", 400, { code: ErrorCode.EMAIL_NOT_BOUND }));
    }

    const verified = await verifyAndConsumeResetCode({
      userId,
      email,
      code: body.code,
    });

    if (!verified.ok) {
      await consumeIpRateLimit(req, "email-verify", VERIFY_LIMIT);
      const messages = {
        not_found: "请先获取验证码",
        expired: "验证码已过期，请重新获取",
        mismatch: "验证码错误",
        too_many: "验证次数过多，请重新获取验证码",
      } as const;
      const reasonCodes = {
        not_found: ErrorCode.VERIFY_CODE_REQUIRED,
        expired: ErrorCode.VERIFY_CODE_EXPIRED,
        mismatch: ErrorCode.VERIFY_CODE_MISMATCH,
        too_many: ErrorCode.VERIFY_CODE_TOO_MANY,
      } as const;
      return withAuthCors(
        jsonError(messages[verified.reason], 400, {
          code: reasonCodes[verified.reason],
        }),
      );
    }

    const rows = await query<(RowDataPacket & { password_hash: string })[]>(
      `SELECT password_hash FROM users WHERE id = :id LIMIT 1`,
      { id: userId },
    );
    const row = rows[0];
    if (!row) {
      return withAuthCors(jsonError("账号不存在", 404, { code: ErrorCode.ACCOUNT_NOT_FOUND }));
    }

    const sameAsOld = await verifyPassword(
      body.newPassword,
      row.password_hash,
    );
    if (sameAsOld) {
      return withAuthCors(jsonError("新密码不能与当前密码相同", 400, { code: ErrorCode.PASSWORD_SAME }));
    }

    const passwordHash = await hashPassword(body.newPassword);
    await execute(
      `UPDATE users SET password_hash = :passwordHash WHERE id = :id`,
      { passwordHash, id: userId },
    );
    await bumpUserTokenVersion(userId);

    return withAuthCors(
      jsonOk({
        message: "密码已重置，请使用新密码登录",
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("重置失败，请稍后重试", 500, { code: ErrorCode.RESET_FAILED }));
  }
}
