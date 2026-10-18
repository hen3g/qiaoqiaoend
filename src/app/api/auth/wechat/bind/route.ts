import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import {
  getCurrentUser,
  mapUser,
  SESSION_USER_COLUMNS_WITH_EMAIL,
  type SessionUserRow,
} from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { query } from "@/lib/db";
import { ErrorCode } from "@/lib/error-codes";
import { consumeIpRateLimit, ipRateLimitedPeek } from "@/lib/ip-rate-limit";
import {
  ensureUserPaidVipColumns,
  ensureUserWechatColumns,
} from "@/lib/user-schema";
import {
  bindWechatToUser,
  exchangeWechatCode,
  findUserIdByWechatOpenid,
} from "@/lib/wechat";

const schema = z.object({
  code: z.string().min(1, "缺少微信授权码"),
});

const BIND_LIMIT = { max: 10 } as const;

const AUTH_FLAGS_SQL = `(password_hash IS NOT NULL AND password_hash <> '') AS has_password,
  (wechat_openid IS NOT NULL AND wechat_openid <> '') AS wechat_bound`;

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

    const blocked = await ipRateLimitedPeek(req, "wechat-bind", BIND_LIMIT);
    if (blocked) return withAuthCors(blocked);

    await ensureUserWechatColumns();
    const body = schema.parse(await req.json());

    // Already bound?
    const selfRows = await query<(SessionUserRow & { wechat_openid?: string | null })[]>(
      `SELECT ${SESSION_USER_COLUMNS_WITH_EMAIL}, wechat_openid
       FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const self = selfRows[0];
    if (self?.wechat_openid) {
      return withAuthCors(
        jsonError("当前账号已绑定微信", 409, {
          code: ErrorCode.WECHAT_ALREADY_BOUND,
        }),
      );
    }

    let openid: string;
    let unionid: string | null;
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
      await consumeIpRateLimit(req, "wechat-bind", BIND_LIMIT);
      return withAuthCors(
        jsonError("微信授权失败，请重试", 400, {
          code: ErrorCode.WECHAT_AUTH_FAILED,
        }),
      );
    }

    const ownerId = await findUserIdByWechatOpenid(openid);
    if (ownerId != null && ownerId !== user.id) {
      return withAuthCors(
        jsonError("该微信已绑定其他账号", 409, {
          code: ErrorCode.WECHAT_TAKEN,
        }),
      );
    }

    await bindWechatToUser(user.id, openid, unionid);
    await ensureUserPaidVipColumns();

    const rows = await query<SessionUserRow[]>(
      `SELECT ${SESSION_USER_COLUMNS_WITH_EMAIL}, ${AUTH_FLAGS_SQL}
       FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const row = rows[0];
    if (!row) {
      return withAuthCors(
        jsonError("账号不存在", 404, { code: ErrorCode.ACCOUNT_NOT_FOUND }),
      );
    }

    return withAuthCors(
      jsonOk({
        message: "微信绑定成功",
        user: mapUser(row),
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
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
      jsonError("绑定失败，请稍后重试", 500, { code: ErrorCode.BIND_FAILED }),
    );
  }
}
