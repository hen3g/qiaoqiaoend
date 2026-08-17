import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  IP_RATE_HOUR_MS,
  ipRateLimitedAll,
} from "@/lib/ip-rate-limit";
import { redeemCode } from "@/lib/redeem";

const schema = z.object({
  code: z.string().min(1, "请输入兑换码"),
});

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录后再兑换", 401));
    }

    const limited = await ipRateLimitedAll(req, [
      { action: "redeem", max: 5 },
      { action: "redeem-hour", max: 20, windowMs: IP_RATE_HOUR_MS },
    ]);
    if (limited) return withAuthCors(limited);

    const body = schema.parse(await req.json());
    const result = await redeemCode(user.id, body.code);
    const refreshed = await getCurrentUser(req);

    return withAuthCors(
      jsonOk({
        message: result.message,
        type: result.type,
        user: refreshed,
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    if (err instanceof Error) {
      return withAuthCors(jsonError(err.message));
    }
    console.error(err);
    return withAuthCors(jsonError("兑换失败，请稍后重试", 500));
  }
}
