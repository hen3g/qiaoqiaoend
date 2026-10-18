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
import { execute, query } from "@/lib/db";
import { ErrorCode } from "@/lib/error-codes";
import {
  consumeIpRateLimit,
  consumeIpRateLimitAll,
  IP_RATE_DAY_MS,
  ipRateLimitedPeek,
  ipRateLimitedPeekAll,
  type IpRateCheck,
} from "@/lib/ip-rate-limit";
import { tryGrantAichiVipPromo } from "@/lib/aichi-vip-promo";
import {
  ensureShareCustomCoursesColumn,
  ensureUserAppColumns,
  ensureUserDiamondsColumn,
  ensureUserPaidVipColumns,
  ensureUserPromoterColumns,
  ensureUserRegisterPlatformColumn,
  ensureUserWechatColumns,
  isRegisterPlatform,
  touchUserLastApp,
} from "@/lib/user-schema";
import {
  allocateDefaultNicknameUnique,
  allocateWechatUsername,
  createWechatPendingTicket,
  exchangeWechatCode,
  findUserIdByWechatOpenid,
  readWechatPendingTicket,
} from "@/lib/wechat";

const schema = z
  .object({
    code: z.string().min(1).optional(),
    ticket: z.string().min(1).optional(),
    autoCreate: z.boolean().optional(),
    platform: z.enum(["ios", "android"]).optional(),
  })
  .refine((d) => Boolean(d.code) || Boolean(d.ticket), {
    message: "缺少微信授权参数",
  });

const LOGIN_LIMIT = { max: 20 } as const;
const REGISTER_LIMITS: IpRateCheck[] = [
  { action: "register" },
  { action: "register-day", max: 8, windowMs: IP_RATE_DAY_MS },
];

const AUTH_FLAGS_SQL = `(password_hash IS NOT NULL AND password_hash <> '') AS has_password,
  (wechat_openid IS NOT NULL AND wechat_openid <> '') AS wechat_bound`;

async function loadMappedUser(userId: number) {
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();
  await ensureUserPaidVipColumns();
  await ensureUserWechatColumns();
  const rows = await query<SessionUserRow[]>(
    `SELECT ${SESSION_USER_COLUMNS_WITH_EMAIL}, ${AUTH_FLAGS_SQL}
     FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

async function sessionForUser(userId: number, req: Request) {
  const token = await createSessionToken(userId);
  await setSessionCookie(token);
  await touchUserLastApp(userId, clientAppFromRequest(req));
  const user = await loadMappedUser(userId);
  if (!user) throw new Error("USER_MISSING");
  return { token, user };
}

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const blocked = await ipRateLimitedPeek(req, "login", LOGIN_LIMIT);
    if (blocked) return withAuthCors(blocked);

    const body = schema.parse(await req.json());
    await ensureUserWechatColumns();
    await ensureUserAppColumns();
    await ensureUserRegisterPlatformColumn();

    let openid: string;
    let unionid: string | null;

    if (body.ticket && body.autoCreate) {
      const pending = await readWechatPendingTicket(body.ticket);
      if (!pending) {
        return withAuthCors(
          jsonError("微信授权已过期，请重新登录", 400, {
            code: ErrorCode.WECHAT_TICKET_EXPIRED,
          }),
        );
      }
      openid = pending.openid;
      unionid = pending.unionid;
    } else if (body.code) {
      try {
        const token = await exchangeWechatCode(body.code);
        openid = token.openid;
        unionid = token.unionid;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "WECHAT_NOT_CONFIGURED") {
          return withAuthCors(
            jsonError("微信登录未配置", 503, {
              code: ErrorCode.WECHAT_NOT_CONFIGURED,
            }),
          );
        }
        await consumeIpRateLimit(req, "login", LOGIN_LIMIT);
        return withAuthCors(
          jsonError("微信授权失败，请重试", 400, {
            code: ErrorCode.WECHAT_AUTH_FAILED,
          }),
        );
      }
    } else {
      return withAuthCors(jsonError("参数错误", 400, { code: ErrorCode.BAD_PARAMS }));
    }

    const existingId = await findUserIdByWechatOpenid(openid);
    if (existingId) {
      const result = await sessionForUser(existingId, req);
      return withAuthCors(
        jsonOk({
          message: "登录成功",
          token: result.token,
          user: result.user,
        }),
      );
    }

    // Not bound yet
    if (!body.autoCreate) {
      const ticket = await createWechatPendingTicket({ openid, unionid });
      return withAuthCors(
        jsonOk({
          needsCreate: true,
          ticket,
          message: "该用户未注册，是否自动分配账号",
        }),
      );
    }

    // Auto-create passwordless account
    const regBlocked = await ipRateLimitedPeekAll(req, REGISTER_LIMITS);
    if (regBlocked) return withAuthCors(regBlocked);
    const limited = await consumeIpRateLimitAll(req, REGISTER_LIMITS);
    if (limited) return withAuthCors(limited);

    // Race: another request may have bound this openid
    const raced = await findUserIdByWechatOpenid(openid);
    if (raced) {
      const result = await sessionForUser(raced, req);
      return withAuthCors(
        jsonOk({
          message: "登录成功",
          token: result.token,
          user: result.user,
        }),
      );
    }

    const username = await allocateWechatUsername();
    const nickname = await allocateDefaultNicknameUnique();
    const appId = clientAppFromRequest(req);
    const registerPlatform = isRegisterPlatform(body.platform)
      ? body.platform
      : "android";

    const insert = await execute(
      `INSERT INTO users
         (username, password_hash, nickname, wechat_openid, wechat_unionid,
          register_app_id, last_app_id, register_platform)
       VALUES
         (:username, NULL, :nickname, :openid, :unionid,
          :appId, :appId, :registerPlatform)`,
      {
        username,
        nickname,
        openid,
        unionid,
        appId,
        registerPlatform,
      },
    );
    const userId = Number(insert.insertId);

    try {
      await tryGrantAichiVipPromo({
        userId,
        nickname,
        source: "register",
      });
    } catch (grantErr) {
      console.error("aichi vip promo grant failed (wechat)", grantErr);
    }

    const result = await sessionForUser(userId, req);
    return withAuthCors(
      jsonOk({
        message: "注册成功",
        created: true,
        token: result.token,
        user: result.user,
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    // Duplicate openid unique key
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ER_DUP_ENTRY"
    ) {
      return withAuthCors(
        jsonError("该微信已绑定其他账号", 409, {
          code: ErrorCode.WECHAT_TAKEN,
        }),
      );
    }
    console.error(err);
    return withAuthCors(
      jsonError("微信登录失败，请稍后重试", 500, {
        code: ErrorCode.WECHAT_LOGIN_FAILED,
      }),
    );
  }
}
