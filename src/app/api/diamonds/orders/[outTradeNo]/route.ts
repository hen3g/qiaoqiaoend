import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser, mapUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { query } from "@/lib/db";
import {
  getDiamondPack,
  isDiamondPackId,
} from "@/lib/diamond-packs";
import {
  getOrderByOutTradeNo,
  syncPendingOrderFromAlipay,
} from "@/lib/payment-orders";
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

/** Poll diamond order status after Alipay SDK returns. */
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
    if (!order || order.userId !== user.id || !isDiamondPackId(order.planId)) {
      return withAuthCors(jsonError("订单不存在", 404));
    }

    if (order.status === "pending") {
      try {
        order = (await syncPendingOrderFromAlipay(outTradeNo)) ?? order;
      } catch (err) {
        console.error(
          "[diamonds/orders/:id] alipay query sync failed",
          outTradeNo,
          err,
        );
      }
    }

    if (!isDiamondPackId(order.planId)) {
      return withAuthCors(jsonError("订单不存在", 404));
    }

    const pack = getDiamondPack(order.planId);
    const payload: Record<string, unknown> = {
      outTradeNo: order.outTradeNo,
      status: order.status,
      packId: pack.id,
      price: pack.price,
      diamonds: pack.diamonds,
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
        payload.diamondsGranted = pack.diamonds;
      }
    }

    return withAuthCors(jsonOk(payload));
  } catch (err) {
    if (err instanceof Error) {
      console.error("[diamonds/orders/:id]", err.message);
      return withAuthCors(jsonError(err.message));
    }
    console.error(err);
    return withAuthCors(jsonError("查询订单失败", 500));
  }
}
