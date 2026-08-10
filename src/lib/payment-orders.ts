import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import {
  formatAlipayAmount,
  yuanToFen,
} from "@/lib/alipay";
import {
  getVipPlan,
  purchaseVipPlan,
  type PurchaseVipResult,
  type VipPlanId,
} from "@/lib/vip";

export type PaymentOrderStatus = "pending" | "paid" | "closed";

export type PaymentOrder = {
  id: number;
  outTradeNo: string;
  userId: number;
  planId: VipPlanId;
  amountFen: number;
  status: PaymentOrderStatus;
  alipayTradeNo: string | null;
  paidAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type OrderRow = RowDataPacket & {
  id: number;
  out_trade_no: string;
  user_id: number;
  plan_id: string;
  amount_fen: number;
  status: PaymentOrderStatus;
  alipay_trade_no: string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

let tableEnsured = false;

export async function ensurePaymentOrdersTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      out_trade_no VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      plan_id VARCHAR(16) NOT NULL,
      amount_fen INT UNSIGNED NOT NULL,
      status ENUM('pending', 'paid', 'closed') NOT NULL DEFAULT 'pending',
      alipay_trade_no VARCHAR(64) NULL,
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_payment_orders_out_trade_no (out_trade_no),
      KEY idx_payment_orders_user_id (user_id),
      KEY idx_payment_orders_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableEnsured = true;
}

function mapOrder(row: OrderRow): PaymentOrder {
  return {
    id: row.id,
    outTradeNo: row.out_trade_no,
    userId: Number(row.user_id),
    planId: row.plan_id as VipPlanId,
    amountFen: Number(row.amount_fen),
    status: row.status,
    alipayTradeNo: row.alipay_trade_no,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Generate a unique merchant order no (≤64 chars). */
export function createOutTradeNo(userId: number): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VIP${userId}_${ts}${rand}`.slice(0, 64);
}

export async function createPendingVipOrder(
  userId: number,
  planId: VipPlanId,
): Promise<PaymentOrder> {
  await ensurePaymentOrdersTable();
  const plan = getVipPlan(planId);
  const outTradeNo = createOutTradeNo(userId);
  const amountFen = yuanToFen(plan.price);

  await execute(
    `INSERT INTO payment_orders
       (out_trade_no, user_id, plan_id, amount_fen, status)
     VALUES
       (:outTradeNo, :userId, :planId, :amountFen, 'pending')`,
    { outTradeNo, userId, planId, amountFen },
  );

  const order = await getOrderByOutTradeNo(outTradeNo);
  if (!order) {
    throw new Error("创建订单失败");
  }
  return order;
}

export async function getOrderByOutTradeNo(
  outTradeNo: string,
): Promise<PaymentOrder | null> {
  await ensurePaymentOrdersTable();
  const rows = await query<OrderRow[]>(
    `SELECT id, out_trade_no, user_id, plan_id, amount_fen, status,
            alipay_trade_no, paid_at, created_at, updated_at
     FROM payment_orders
     WHERE out_trade_no = :outTradeNo
     LIMIT 1`,
    { outTradeNo },
  );
  return rows[0] ? mapOrder(rows[0]) : null;
}

export function orderAmountYuan(order: PaymentOrder): string {
  return formatAlipayAmount(order.amountFen / 100);
}

/**
 * Mark order paid and fulfill VIP once. Idempotent on retries.
 * Returns fulfillment result when this call performed the grant;
 * returns null when already paid / not applicable.
 */
export async function markOrderPaidAndFulfill(input: {
  outTradeNo: string;
  alipayTradeNo: string;
  totalAmountYuan: string;
  appId: string;
  expectedAppId: string;
}): Promise<PurchaseVipResult | null> {
  await ensurePaymentOrdersTable();
  const order = await getOrderByOutTradeNo(input.outTradeNo);
  if (!order) {
    throw new Error("订单不存在");
  }

  if (input.appId !== input.expectedAppId) {
    throw new Error("app_id 不匹配");
  }

  const expectedAmount = orderAmountYuan(order);
  if (input.totalAmountYuan !== expectedAmount) {
    throw new Error("金额不匹配");
  }

  if (order.status === "paid") {
    return null;
  }
  if (order.status !== "pending") {
    throw new Error("订单状态不可支付");
  }

  const result = await execute(
    `UPDATE payment_orders
     SET status = 'paid',
         alipay_trade_no = :alipayTradeNo,
         paid_at = NOW()
     WHERE out_trade_no = :outTradeNo
       AND status = 'pending'`,
    {
      outTradeNo: input.outTradeNo,
      alipayTradeNo: input.alipayTradeNo,
    },
  );

  // Another notify already fulfilled
  if (result.affectedRows === 0) {
    return null;
  }

  return purchaseVipPlan(order.userId, order.planId);
}
