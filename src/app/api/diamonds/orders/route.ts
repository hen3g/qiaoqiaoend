import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { createAppPayOrderString, getAlipayAppId } from "@/lib/alipay";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  getDiamondPack,
  isDiamondPackId,
} from "@/lib/diamond-packs";
import { ipRateLimited } from "@/lib/ip-rate-limit";
import {
  createPendingDiamondOrder,
  orderAmountYuan,
} from "@/lib/payment-orders";

const schema = z.object({
  packId: z.enum(["pack6", "pack25", "pack28"]),
});

export async function OPTIONS() {
  return authPreflight();
}

/** Create a pending diamond pack order and return Alipay App pay orderString. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录后再充值钻石", 401));
    }

    const limited = await ipRateLimited(req, "pay-order", { max: 5 });
    if (limited) return withAuthCors(limited);

    const body = schema.parse(await req.json());
    if (!isDiamondPackId(body.packId)) {
      return withAuthCors(jsonError("请选择有效的钻石套餐"));
    }

    const pack = getDiamondPack(body.packId);
    const order = await createPendingDiamondOrder(user.id, body.packId);
    const totalAmount = orderAmountYuan(order);
    const orderString = createAppPayOrderString({
      outTradeNo: order.outTradeNo,
      subject: `敲敲英语${pack.title}`,
      totalAmount,
      body: `pack=${pack.id}`,
    });

    return withAuthCors(
      jsonOk({
        outTradeNo: order.outTradeNo,
        orderString,
        alipayAppId: getAlipayAppId(),
        pack: {
          id: pack.id,
          title: pack.title,
          price: pack.price,
          diamonds: pack.diamonds,
        },
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    if (err instanceof Error) {
      console.error("[diamonds/orders]", err.message);
      return withAuthCors(jsonError(err.message));
    }
    console.error(err);
    return withAuthCors(jsonError("创建订单失败，请稍后重试", 500));
  }
}
