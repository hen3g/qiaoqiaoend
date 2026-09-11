import type { RowDataPacket } from "mysql2";
import { z } from "zod";

import { deleteAccountForUser } from "@/lib/account-delete";
import { jsonError, jsonOk } from "@/lib/api";
import { ErrorCode } from "@/lib/error-codes";
import { clearSessionCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { isValidEmail } from "@/lib/email-bind";
import { consumeIpRateLimit, ipRateLimitedPeek } from "@/lib/ip-rate-limit";
import { verifyPassword } from "@/lib/password";
import { ensureUserEmailColumn } from "@/lib/user-schema";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const DELETE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 } as const;

type UserAuthRow = RowDataPacket & {
  id: number;
  password_hash: string;
};

export async function POST(req: Request) {
  try {
    const blocked = await ipRateLimitedPeek(
      req,
      "delete-account-web",
      DELETE_LIMIT,
    );
    if (blocked) {
      return jsonError("rate_limited", 429, { code: ErrorCode.RATE_LIMITED });
    }

    const body = schema.parse(await req.json());
    const identifier = body.username.trim().toLowerCase();
    if (!identifier || !body.password) {
      return jsonError("invalid_credentials", 400, {
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    }

    await ensureUserEmailColumn();
    const byEmail = isValidEmail(identifier);
    const rows = await query<UserAuthRow[]>(
      `SELECT id, password_hash
       FROM users
       WHERE ${byEmail ? "email = :identifier" : "username = :identifier"}
       LIMIT 1`,
      { identifier },
    );
    const user = rows[0];
    const ok =
      Boolean(user) &&
      (await verifyPassword(body.password, user!.password_hash));
    if (!ok || !user) {
      await consumeIpRateLimit(req, "delete-account-web", DELETE_LIMIT);
      return jsonError("invalid_credentials", 401, {
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    }

    await deleteAccountForUser(user.id);
    await clearSessionCookie();
    return jsonOk({ code: ErrorCode.DELETED });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError("invalid_credentials", 400, {
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    }
    console.error(err);
    return jsonError("failed", 500, { code: ErrorCode.FAILED });
  }
}
