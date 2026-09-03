import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseClientAppFilter } from "@/lib/client-app";
import { requireAdmin } from "@/lib/dev-admin";
import {
  listAdminPaymentOrders,
  type PaymentOrderStatus,
} from "@/lib/payment-orders";
import { VIP_PLANS, type VipPlanId } from "@/lib/vip";
import { paymentPlanTitle } from "@/lib/payment-orders";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["pending", "paid", "closed"]).optional(),
  q: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  app: z.enum(["all", "qiaoqiao", "hamster"]).optional(),
});

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      status: url.searchParams.get("status") || undefined,
      q: url.searchParams.get("q") || undefined,
      page: url.searchParams.get("page") || undefined,
      pageSize: url.searchParams.get("pageSize") || undefined,
      app: url.searchParams.get("app") || undefined,
    });
    if (!parsed.success) {
      return jsonError("参数错误", 400);
    }

    const app = parseClientAppFilter(parsed.data.app);
    const result = await listAdminPaymentOrders({
      status: parsed.data.status as PaymentOrderStatus | undefined,
      q: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      app,
    });

    return jsonOk({
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      summary: {
        total: result.summary.total,
        paidCount: result.summary.paidCount,
        pendingCount: result.summary.pendingCount,
        closedCount: result.summary.closedCount,
        paidYuan: (result.summary.paidFen / 100).toFixed(2),
      },
      orders: result.orders.map((o) => {
        const plan = VIP_PLANS[o.planId as VipPlanId];
        return {
          id: o.id,
          outTradeNo: o.outTradeNo,
          userId: o.userId,
          username: o.username,
          nickname: o.nickname,
          planId: o.planId,
          planTitle: plan?.title ?? paymentPlanTitle(o.planId),
          amountFen: o.amountFen,
          amountYuan: (o.amountFen / 100).toFixed(2),
          status: o.status,
          alipayTradeNo: o.alipayTradeNo,
          paidAt: o.paidAt,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        };
      }),
    });
  } catch (err) {
    return adminError(err) ?? jsonError("加载失败", 500);
  }
}
