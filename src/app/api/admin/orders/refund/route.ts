import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  refundPaidAlipayOrder,
  type AlipayRefundResult,
} from "@/lib/payment-orders";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.number().int().positive(),
});

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

function refundMessage(result: AlipayRefundResult): string {
  if (result.alreadyRefunded) return "该订单已退款";
  const parts = [`已原路退回 ¥${result.amountYuan}`];
  if (result.daysRevoked > 0) {
    parts.push(`已删除会员 ${result.daysRevoked} 天`);
  }
  if (result.diamondsRevoked > 0) {
    parts.push(`已收回钻石 ${result.diamondsRevoked}`);
  }
  return parts.join("，");
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = bodySchema.parse(await request.json());
    const result = await refundPaidAlipayOrder(body.id);
    return jsonOk({
      ...result,
      message: refundMessage(result),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError("参数错误", 400);
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    if (err instanceof Error && err.message) {
      return jsonError(err.message, 400);
    }
    console.error("[admin/orders/refund]", err);
    return jsonError("退款失败", 500);
  }
}
