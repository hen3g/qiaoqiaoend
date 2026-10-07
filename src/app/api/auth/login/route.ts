import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  createSessionToken,
  mapUser,
  SESSION_USER_COLUMNS_WITH_EMAIL,
  setSessionCookie,
  type SessionUserRow,
} from "@/lib/auth";
import { clientAppFromRequest } from "@/lib/client-app";
import { query } from "@/lib/db";
import { isValidEmail } from "@/lib/email-bind";
import { consumeIpRateLimit, ipRateLimitedPeek } from "@/lib/ip-rate-limit";
import { verifyPassword } from "@/lib/password";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserEmailColumn,
  ensureUserPaidVipColumns,
  ensureUserPromoterColumns,
  touchUserLastApp,
} from "@/lib/user-schema";
import { ErrorCode } from "@/lib/error-codes";

const schema = z.object({
  username: z.string().min(1, "请输入用户名或邮箱"),
  password: z.string().min(1, "请输入密码"),
});

type UserAuthRow = SessionUserRow & {
  password_hash: string;
};

const LOGIN_LIMIT = { max: 20 } as const;

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const blocked = await ipRateLimitedPeek(req, "login", LOGIN_LIMIT);
    if (blocked) return withAuthCors(blocked);

    const body = schema.parse(await req.json());
    const identifier = body.username.trim().toLowerCase();
    await ensureUserDiamondsColumn();
    await ensureShareCustomCoursesColumn();
    await ensureUserPromoterColumns();
    await ensureUserEmailColumn();
    await ensureUserPaidVipColumns();

    const byEmail = isValidEmail(identifier);
    const rows = await query<UserAuthRow[]>(
      `SELECT ${SESSION_USER_COLUMNS_WITH_EMAIL}, password_hash
       FROM users
       WHERE ${byEmail ? "email = :identifier" : "username = :identifier"}
       LIMIT 1`,
      { identifier },
    );
    const user = rows[0];
    if (!user) {
      await consumeIpRateLimit(req, "login", LOGIN_LIMIT);
      return withAuthCors(jsonError("用户不存在", 401, { code: ErrorCode.USER_NOT_FOUND }));
    }

    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) {
      await consumeIpRateLimit(req, "login", LOGIN_LIMIT);
      return withAuthCors(jsonError("密码错误", 401, { code: ErrorCode.BAD_PASSWORD }));
    }

    const token = await createSessionToken(user.id);
    await setSessionCookie(token);
    await touchUserLastApp(user.id, clientAppFromRequest(req));

    return withAuthCors(
      jsonOk({
        message: "登录成功",
        token,
        user: mapUser(user),
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("登录失败，请稍后重试", 500, { code: ErrorCode.LOGIN_FAILED }));
  }
}
