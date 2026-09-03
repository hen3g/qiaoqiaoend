import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser, mapUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { query } from "@/lib/db";
import {
  getOrderByOutTradeNo,
  syncPendingOrderFromAlipay,
} from "@/lib/payment-orders";
import { getVipPlan, isVipPlanId } from "@/lib/vip";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";
import type { RowDataPacket } from "mysql2";

export async function OPTIONS() {
  return authPreflight();
}

type Ctx = { params: { outTradeNo: string } };

/** Poll order status after Alipay SDK returns. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const outTradeNo = decodeURIComponent(ctx.params.outTradeNo || "").trim();
    if (!outTradeNo) {
      return withAuthCors(jsonError("缺少订单号"));
    }

    let order = await getOrderByOutTradeNo(outTradeNo);
    if (!order || order.userId !== user.id) {
      return withAuthCors(jsonError("订单不存在", 404));
    }
    if (!isVipPlanId(order.planId)) {
      return withAuthCors(jsonError("订单不存在", 404));
    }

    // Fallback: client already saw SDK success, but async notify may have failed
    // (e.g. bad ALIPAY_PUBLIC_KEY). Actively query Alipay and fulfill.
    if (order.status === "pending") {
      try {
        order =
          (await syncPendingOrderFromAlipay(
            outTradeNo,
            clientAppFromRequest(req),
          )) ?? order;
      } catch (err) {
        console.error(
          "[vip/orders/:id] alipay query sync failed",
          outTradeNo,
          err,
        );
      }
    }

    if (!isVipPlanId(order.planId)) {
      return withAuthCors(jsonError("订单不存在", 404));
    }

    const plan = getVipPlan(order.planId);
    const payload: Record<string, unknown> = {
      outTradeNo: order.outTradeNo,
      status: order.status,
      planId: order.planId,
      price: plan.price,
      days: plan.days,
      diamonds: plan.diamonds,
      alipayTradeNo: order.alipayTradeNo,
      paidAt: order.paidAt,
    };

    if (order.status === "paid") {
      await ensureUserDiamondsColumn();
      await ensureShareCustomCoursesColumn();
      await ensureUserPromoterColumns();
      const rows = await query<
        (RowDataPacket & {
          id: number;
          username: string;
          nickname: string | null;
          avatar_url: string | null;
          vip_expires_at: Date | string | null;
          diamonds: number;
          share_custom_courses: number | boolean | null;
          is_promoter: number | boolean | null;
          promoter_id: number | null;
          created_at: Date | string | null;
        })[]
      >(
        `SELECT id, username, nickname, avatar_url, vip_expires_at, diamonds,
                share_custom_courses, is_promoter, promoter_id, created_at
         FROM users WHERE id = :id LIMIT 1`,
        { id: user.id },
      );
      if (rows[0]) {
        payload.user = mapUser(rows[0]);
        payload.daysGranted = plan.days;
        payload.diamondsGranted = plan.diamonds;
      }
    }

    return withAuthCors(jsonOk(payload));
  } catch (err) {
    if (err instanceof Error) {
      console.error("[vip/orders/:id]", err.message);
      return withAuthCors(jsonError(err.message));
    }
    console.error(err);
    return withAuthCors(jsonError("查询订单失败", 500));
  }
}
