import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { createAppPayOrderString, getAlipayAppId } from "@/lib/alipay";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  createPendingVipOrder,
  orderAmountYuan,
} from "@/lib/payment-orders";
import { getVipPlan, isVipPlanId } from "@/lib/vip";

const schema = z.object({
  planId: z.enum(["month", "quarter", "year", "quarter18", "year38"]),
});

export async function OPTIONS() {
  return authPreflight();
}

/** Create a pending VIP order and return Alipay App pay orderString. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录后再开通会员", 401));
    }

    const body = schema.parse(await req.json());
    if (!isVipPlanId(body.planId)) {
      return withAuthCors(jsonError("请选择有效的会员方案"));
    }

    const plan = getVipPlan(body.planId);
    const order = await createPendingVipOrder(user.id, body.planId);
    const totalAmount = orderAmountYuan(order);
    const orderString = createAppPayOrderString({
      outTradeNo: order.outTradeNo,
      subject: `敲敲英语${plan.title}`,
      totalAmount,
      body: `plan=${plan.id}`,
    });

    return withAuthCors(
      jsonOk({
        outTradeNo: order.outTradeNo,
        orderString,
        alipayAppId: getAlipayAppId(),
        plan: {
          id: plan.id,
          title: plan.title,
          price: plan.price,
          days: plan.days,
          diamonds: plan.diamonds,
        },
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    if (err instanceof Error) {
      console.error("[vip/orders]", err.message);
      return withAuthCors(jsonError(err.message));
    }
    console.error(err);
    return withAuthCors(jsonError("创建订单失败，请稍后重试", 500));
  }
}
