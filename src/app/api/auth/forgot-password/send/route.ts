import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  findUserIdByEmail,
  isValidEmail,
  normalizeEmail,
} from "@/lib/email-bind";
import {
  consumeIpRateLimitAll,
  IP_RATE_DAY_MS,
  ipRateLimitedPeekAll,
  type IpRateCheck,
} from "@/lib/ip-rate-limit";
import {
  assertCanSendResetCode,
  createResetCode,
  generateEmailCode,
} from "@/lib/password-reset";
import { sendVerificationCodeEmail } from "@/lib/tencent-ses";
import { ensureUserEmailColumn } from "@/lib/user-schema";

const schema = z.object({
  email: z.string().min(1, "请输入邮箱"),
});

const EMAIL_SEND_LIMITS: IpRateCheck[] = [
  { action: "email-send" },
  { action: "email-send-day", max: 10, windowMs: IP_RATE_DAY_MS },
];

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const blocked = await ipRateLimitedPeekAll(req, EMAIL_SEND_LIMITS);
    if (blocked) return withAuthCors(blocked);

    await ensureUserEmailColumn();
    const body = schema.parse(await req.json());
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return withAuthCors(jsonError("邮箱格式不正确", 400));
    }

    const userId = await findUserIdByEmail(email);
    if (userId == null) {
      return withAuthCors(jsonError("该邮箱未绑定账号", 400));
    }

    try {
      await assertCanSendResetCode(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.startsWith("SEND_COOLDOWN:")) {
        const seconds = message.slice("SEND_COOLDOWN:".length);
        return withAuthCors(
          jsonError(`发送过于频繁，请 ${seconds} 秒后再试`, 429),
        );
      }
      throw err;
    }

    const limited = await consumeIpRateLimitAll(req, EMAIL_SEND_LIMITS);
    if (limited) return withAuthCors(limited);

    const code = generateEmailCode();
    const { expiresAt } = await createResetCode({
      userId,
      email,
      code,
    });

    try {
      await sendVerificationCodeEmail({ to: email, code });
    } catch (err) {
      console.error("[forgot-password/send] SES failed", err);
      return withAuthCors(jsonError("验证码发送失败，请稍后重试", 502));
    }

    return withAuthCors(
      jsonOk({
        message: "验证码已发送",
        email,
        expiresAt: expiresAt.toISOString(),
        cooldownSeconds: 60,
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("发送失败，请稍后重试", 500));
  }
}
