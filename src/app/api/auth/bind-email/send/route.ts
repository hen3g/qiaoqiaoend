import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  assertCanSendCode,
  createBindCode,
  findUserIdByEmail,
  generateEmailCode,
  getUserEmail,
  isValidEmail,
  normalizeEmail,
} from "@/lib/email-bind";
import { sendVerificationCodeEmail } from "@/lib/tencent-ses";

const schema = z.object({
  email: z.string().min(1, "请输入邮箱"),
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
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return withAuthCors(jsonError("邮箱格式不正确", 400));
    }

    const currentEmail = await getUserEmail(user.id);
    if (currentEmail && currentEmail === email) {
      return withAuthCors(jsonError("该邮箱已绑定到当前账号", 400));
    }

    const ownerId = await findUserIdByEmail(email);
    if (ownerId != null && ownerId !== user.id) {
      return withAuthCors(jsonError("该邮箱已被其他账号绑定", 409));
    }

    try {
      await assertCanSendCode(user.id);
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

    const code = generateEmailCode();
    const { expiresAt } = await createBindCode({
      userId: user.id,
      email,
      code,
    });

    try {
      await sendVerificationCodeEmail({ to: email, code });
    } catch (err) {
      console.error("[bind-email/send] SES failed", err);
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
