import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { isVipPlanId, purchaseVipPlan, VIP_PLANS } from "@/lib/vip";

const schema = z.object({
  planId: z.enum(["month", "quarter", "year", "quarter18", "year38"]),
});

export async function OPTIONS() {
  return authPreflight();
}

/** List plan prices / diamond gifts (no auth required). */
export async function GET() {
  const plans = Object.values(VIP_PLANS).map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    days: p.days,
    diamonds: p.diamonds,
  }));
  return withAuthCors(jsonOk({ plans }));
}

/**
 * Test purchase only when ALLOW_TEST_VIP_PURCHASE=1.
 * Production clients must use POST /api/vip/orders + Alipay notify.
 */
export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_TEST_VIP_PURCHASE !== "1") {
      return withAuthCors(
        jsonError("请使用支付宝支付开通会员", 403),
      );
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录后再开通会员", 401));
    }

    const body = schema.parse(await req.json());
    if (!isVipPlanId(body.planId)) {
      return withAuthCors(jsonError("请选择有效的会员方案"));
    }

    const result = await purchaseVipPlan(user.id, body.planId);

    return withAuthCors(
      jsonOk({
        message: `已开通${result.plan.title}，赠送 ${result.diamondsGranted} 钻石`,
        planId: result.plan.id,
        price: result.plan.price,
        daysGranted: result.daysGranted,
        diamondsGranted: result.diamondsGranted,
        user: result.user,
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
    return withAuthCors(jsonError("开通失败，请稍后重试", 500));
  }
}
