import type { RowDataPacket } from "mysql2";
import {
  formatAlipayAmount,
  getAlipayAppId,
  isAlipayTradeSuccess,
  queryAlipayTrade,
  refundAlipayTrade,
  resolveAlipayMerchantByAppId,
  yuanToFen,
} from "@/lib/alipay";
import { getSessionUserById } from "@/lib/auth";
import { shortenVip } from "@/lib/courses";
import { execute, query, withTransaction } from "@/lib/db";
import { formatPayUser, notifyPayment } from "@/lib/payment-notify";
import { ensureDiamondTransactionsTable } from "@/lib/diamond-transactions";
import {
  getDiamondPack,
  isDiamondPackId,
  purchaseDiamondPack,
  type DiamondPackId,
} from "@/lib/diamond-packs";
import type { ClientAppFilter, ClientAppId } from "@/lib/client-app";
import { sqlOrderAppPredicate } from "@/lib/client-app";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserPaidVipColumns,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";
import { ensureAppleTransactionsTable } from "@/lib/apple-transactions";
import { ensureGoogleTransactionsTable } from "@/lib/google-transactions";
import {
  extendPaidVip,
  recomputePaidVipFlag,
  shortenPaidVip,
} from "@/lib/paid-vip";
import {
  deductDiamondsFloorZero,
  getVipPlan,
  isAppleSubscriptionPlanId,
  isVipPlanId,
  purchaseVipPlan,
  type PurchaseVipResult,
  type VipPlanId,
} from "@/lib/vip";

export type PaymentOrderStatus = "pending" | "paid" | "closed" | "refunded";

export type PaymentPlanId = VipPlanId | DiamondPackId;

export type PaymentOrder = {
  id: number;
  outTradeNo: string;
  userId: number;
  appId: string | null;
  planId: PaymentPlanId;
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
  app_id: string | null;
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
      status ENUM('pending', 'paid', 'closed', 'refunded') NOT NULL DEFAULT 'pending',
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
  type ColRow = RowDataPacket & { Field: string };
  const appCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM payment_orders LIKE 'app_id'`,
  );
  if (appCols.length === 0) {
    await execute(
      `ALTER TABLE payment_orders
       ADD COLUMN app_id VARCHAR(16) NULL AFTER user_id`,
    );
  }
  const statusCols = await query<(RowDataPacket & { Type: string })[]>(
    `SHOW COLUMNS FROM payment_orders LIKE 'status'`,
  );
  const statusType = String(statusCols[0]?.Type ?? "");
  if (!statusType.includes("refunded")) {
    await execute(
      `ALTER TABLE payment_orders
       MODIFY COLUMN status ENUM('pending', 'paid', 'closed', 'refunded') NOT NULL DEFAULT 'pending'`,
    );
  }
  tableEnsured = true;
}

function mapOrder(row: OrderRow): PaymentOrder {
  return {
    id: row.id,
    outTradeNo: row.out_trade_no,
    userId: Number(row.user_id),
    appId: row.app_id ?? null,
    planId: row.plan_id as PaymentPlanId,
    amountFen: Number(row.amount_fen),
    status: row.status,
    alipayTradeNo: row.alipay_trade_no,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Generate a unique merchant order no (≤64 chars). */
export function createOutTradeNo(
  userId: number,
  prefix: "VIP" | "DIA" = "VIP",
): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${userId}_${ts}${rand}`.slice(0, 64);
}

export function paymentPlanTitle(planId: string): string {
  if (isVipPlanId(planId)) return getVipPlan(planId).title;
  if (isDiamondPackId(planId)) return getDiamondPack(planId).title;
  return planId;
}

/** Days and diamonds granted when this plan was paid. */
export function paymentPlanGrant(planId: string): {
  days: number;
  diamonds: number;
} | null {
  if (isVipPlanId(planId)) {
    const plan = getVipPlan(planId);
    return { days: plan.days, diamonds: plan.diamonds };
  }
  if (isDiamondPackId(planId)) {
    const pack = getDiamondPack(planId);
    return { days: 0, diamonds: pack.diamonds };
  }
  return null;
}

export async function createPendingVipOrder(
  userId: number,
  planId: VipPlanId,
  clientApp: ClientAppId,
): Promise<PaymentOrder> {
  await ensurePaymentOrdersTable();
  if (isAppleSubscriptionPlanId(planId)) {
    throw new Error("该方案仅支持 App Store 订阅");
  }
  const plan = getVipPlan(planId);
  const outTradeNo = createOutTradeNo(userId);
  const amountFen = yuanToFen(plan.price);

  await execute(
    `INSERT INTO payment_orders
       (out_trade_no, user_id, app_id, plan_id, amount_fen, status)
     VALUES
       (:outTradeNo, :userId, :appId, :planId, :amountFen, 'pending')`,
    { outTradeNo, userId, appId: clientApp, planId, amountFen },
  );

  const order = await getOrderByOutTradeNo(outTradeNo);
  if (!order) {
    throw new Error("创建订单失败");
  }
  return order;
}

export async function createPendingDiamondOrder(
  userId: number,
  packId: DiamondPackId,
  clientApp: ClientAppId,
): Promise<PaymentOrder> {
  await ensurePaymentOrdersTable();
  const pack = getDiamondPack(packId);
  const outTradeNo = createOutTradeNo(userId, "DIA");
  const amountFen = yuanToFen(pack.price);

  await execute(
    `INSERT INTO payment_orders
       (out_trade_no, user_id, app_id, plan_id, amount_fen, status)
     VALUES
       (:outTradeNo, :userId, :appId, :planId, :amountFen, 'pending')`,
    { outTradeNo, userId, appId: clientApp, planId: packId, amountFen },
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
    `SELECT id, out_trade_no, user_id, app_id, plan_id, amount_fen, status,
            alipay_trade_no, paid_at, created_at, updated_at
     FROM payment_orders
     WHERE out_trade_no = :outTradeNo
     LIMIT 1`,
    { outTradeNo },
  );
  return rows[0] ? mapOrder(rows[0]) : null;
}

export type AdminPaymentOrder = PaymentOrder & {
  username: string | null;
  nickname: string | null;
};

export type AdminPaymentOrderSummary = {
  total: number;
  paidCount: number;
  pendingCount: number;
  closedCount: number;
  paidFen: number;
};

export type AdminPaymentOrderListResult = {
  orders: AdminPaymentOrder[];
  total: number;
  page: number;
  pageSize: number;
  summary: AdminPaymentOrderSummary;
};

type AdminOrderRow = OrderRow & {
  username: string | null;
  nickname: string | null;
};

function toIso(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function mapAdminOrder(row: AdminOrderRow): AdminPaymentOrder {
  return {
    ...mapOrder(row),
    username: row.username,
    nickname: row.nickname,
    paidAt: toIso(row.paid_at),
    createdAt: toIso(row.created_at) ?? String(row.created_at),
    updatedAt: toIso(row.updated_at) ?? String(row.updated_at),
  };
}

function buildAdminOrderFilters(options: {
  status?: PaymentOrderStatus;
  q?: string;
  /** When set, only orders from users bound to this promoter. */
  promoterId?: number;
  app?: ClientAppFilter;
}): { whereSql: string; params: Record<string, string | number> } {
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};

  if (options.promoterId != null) {
    clauses.push("u.promoter_id = :promoterId");
    params.promoterId = options.promoterId;
  }

  const appSql = sqlOrderAppPredicate(
    "o.app_id",
    "u.register_app_id",
    options.app ?? "all",
    params,
  );
  if (appSql) clauses.push(appSql);

  if (options.status) {
    clauses.push("o.status = :status");
    params.status = options.status;
  }

  const q = options.q?.trim();
  if (q) {
    params.qLike = `%${q}%`;
    const userId = Number(q);
    if (Number.isInteger(userId) && userId > 0) {
      params.qUserId = userId;
      clauses.push(
        `(o.out_trade_no LIKE :qLike
          OR o.alipay_trade_no LIKE :qLike
          OR u.username LIKE :qLike
          OR u.nickname LIKE :qLike
          OR o.plan_id LIKE :qLike
          OR o.user_id = :qUserId)`,
      );
    } else {
      clauses.push(
        `(o.out_trade_no LIKE :qLike
          OR o.alipay_trade_no LIKE :qLike
          OR u.username LIKE :qLike
          OR u.nickname LIKE :qLike
          OR o.plan_id LIKE :qLike)`,
      );
    }
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

async function listPaymentOrdersWithFilters(
  filterOptions: {
    status?: PaymentOrderStatus;
    q?: string;
    promoterId?: number;
    app?: ClientAppFilter;
  },
  pageOptions?: {
    page?: number;
    pageSize?: number;
  },
): Promise<AdminPaymentOrderListResult> {
  await ensurePaymentOrdersTable();
  const page = Math.max(Math.floor(pageOptions?.page ?? 1), 1);
  const pageSize = Math.min(
    Math.max(Math.floor(pageOptions?.pageSize ?? 20), 1),
    100,
  );
  const offset = (page - 1) * pageSize;
  const { whereSql, params } = buildAdminOrderFilters({
    status: filterOptions.status,
    q: filterOptions.q,
    promoterId: filterOptions.promoterId,
    app: filterOptions.app,
  });

  const countRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
     FROM payment_orders o
     LEFT JOIN users u ON u.id = o.user_id
     ${whereSql}`,
    params,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const summaryRows = await query<
    (RowDataPacket & {
      paid_count: number;
      pending_count: number;
      closed_count: number;
      paid_fen: number | string;
    })[]
  >(
    `SELECT
       SUM(o.status = 'paid') AS paid_count,
       SUM(o.status = 'pending') AS pending_count,
       SUM(o.status = 'closed') AS closed_count,
       COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.amount_fen ELSE 0 END), 0) AS paid_fen
     FROM payment_orders o
     LEFT JOIN users u ON u.id = o.user_id
     ${whereSql}`,
    params,
  );
  const summaryRow = summaryRows[0];
  const summary: AdminPaymentOrderSummary = {
    total,
    paidCount: Number(summaryRow?.paid_count ?? 0),
    pendingCount: Number(summaryRow?.pending_count ?? 0),
    closedCount: Number(summaryRow?.closed_count ?? 0),
    paidFen: Number(summaryRow?.paid_fen ?? 0),
  };

  const rows = await query<AdminOrderRow[]>(
    `SELECT o.id, o.out_trade_no, o.user_id, o.app_id, o.plan_id, o.amount_fen, o.status,
            o.alipay_trade_no, o.paid_at, o.created_at, o.updated_at,
            u.username, u.nickname
     FROM payment_orders o
     LEFT JOIN users u ON u.id = o.user_id
     ${whereSql}
     ORDER BY o.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );

  return {
    orders: rows.map(mapAdminOrder),
    total,
    page,
    pageSize,
    summary,
  };
}

/** List payment orders for admin console with server-side pagination. */
export async function listAdminPaymentOrders(options?: {
  status?: PaymentOrderStatus;
  q?: string;
  page?: number;
  pageSize?: number;
  app?: ClientAppFilter;
}): Promise<AdminPaymentOrderListResult> {
  return listPaymentOrdersWithFilters(
    { status: options?.status, q: options?.q, app: options?.app },
    { page: options?.page, pageSize: options?.pageSize },
  );
}

/** List VIP payment orders from users bound to a promoter. */
export async function listPromoterReferredOrders(
  promoterId: number,
  options?: {
    status?: PaymentOrderStatus;
    q?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<AdminPaymentOrderListResult> {
  return listPaymentOrdersWithFilters(
    {
      status: options?.status,
      q: options?.q,
      promoterId,
    },
    { page: options?.page, pageSize: options?.pageSize },
  );
}

export function orderAmountYuan(order: PaymentOrder): string {
  return formatAlipayAmount(order.amountFen / 100);
}

/**
 * Mark order paid and fulfill VIP once. Idempotent on retries.
 * Returns fulfillment result when this call performed the grant;
 * returns null when already paid / not applicable.
 */
export type OrderFulfillResult =
  | (PurchaseVipResult & { kind: "vip" })
  | {
      kind: "diamonds";
      pack: ReturnType<typeof getDiamondPack>;
      diamondsGranted: number;
      user: PurchaseVipResult["user"];
    };

export async function markOrderPaidAndFulfill(input: {
  outTradeNo: string;
  alipayTradeNo: string;
  totalAmountYuan: string;
  appId: string;
  expectedAppId: string;
}): Promise<OrderFulfillResult | null> {
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

  const updated = await execute(
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
  if (updated.affectedRows === 0) {
    return null;
  }

  try {
    await notifyPayment({
      event: "paid",
      app: await resolvePaymentOrderApp(order),
      channel: "支付宝",
      product: paymentPlanTitle(order.planId),
      amount: `¥${expectedAmount}`,
      userLabel: await payUserLabel(order.userId),
      orderNo: order.outTradeNo,
      details: [`支付宝单号：${input.alipayTradeNo}`],
    });
  } catch (err) {
    console.warn("[payment-notify] alipay paid", err);
  }

  if (isDiamondPackId(order.planId)) {
    const granted = await purchaseDiamondPack(order.userId, order.planId);
    return { kind: "diamonds", ...granted };
  }
  if (!isVipPlanId(order.planId)) {
    throw new Error("未知商品类型");
  }
  const vipPlanId: VipPlanId = order.planId;
  // Run schema ensures before the transaction (DDL would implicitly commit).
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();
  await ensureUserPaidVipColumns();
  await ensureDiamondTransactionsTable();
  // Real Alipay payment: paid fields + overall VIP + diamonds in one transaction.
  // (Not inside purchaseVipPlan, so gated test purchases never count as paid.)
  const granted = await withTransaction(async () => {
    await extendPaidVip(order.userId, getVipPlan(vipPlanId).days);
    return purchaseVipPlan(order.userId, vipPlanId);
  });
  return { kind: "vip", ...granted };
}

/**
 * If order is still pending, ask Alipay whether it was paid and fulfill.
 * Idempotent; safe to call from client polling.
 */
export async function syncPendingOrderFromAlipay(
  outTradeNo: string,
  clientApp?: ClientAppId,
): Promise<PaymentOrder | null> {
  const order = await getOrderByOutTradeNo(outTradeNo);
  if (!order) return null;
  if (order.status !== "pending") return order;

  const trade = await queryAlipayTrade({ outTradeNo, clientApp });
  if (trade.code !== "10000" || !isAlipayTradeSuccess(trade.tradeStatus)) {
    return order;
  }
  if (!trade.tradeNo || !trade.totalAmount) {
    console.error("[alipay/query] missing fields", outTradeNo, trade);
    return order;
  }

  const appId = trade.appId || getAlipayAppId(clientApp);
  const merchant = resolveAlipayMerchantByAppId(appId);

  await markOrderPaidAndFulfill({
    outTradeNo,
    alipayTradeNo: trade.tradeNo,
    totalAmountYuan: trade.totalAmount,
    appId,
    expectedAppId: merchant?.appId ?? "",
  });

  return getOrderByOutTradeNo(outTradeNo);
}

export type AlipayRefundResult = {
  alreadyRefunded: boolean;
  outTradeNo: string;
  amountYuan: string;
  daysRevoked: number;
  diamondsRevoked: number;
};

/** Which Alipay merchant created this order. */
function paymentOrderClientApp(row: {
  app_id: string | null;
  register_app_id: string | null;
}): ClientAppId {
  if (row.app_id === "hamster" || row.app_id === "qiaoqiao") {
    return row.app_id;
  }
  if (row.register_app_id === "hamster") return "hamster";
  return "qiaoqiao";
}

async function resolvePaymentOrderApp(order: PaymentOrder): Promise<ClientAppId> {
  if (order.appId === "hamster" || order.appId === "qiaoqiao") {
    return order.appId;
  }
  const rows = await query<(RowDataPacket & { register_app_id: string | null })[]>(
    `SELECT register_app_id FROM users WHERE id = :userId LIMIT 1`,
    { userId: order.userId },
  );
  return paymentOrderClientApp({
    app_id: order.appId,
    register_app_id: rows[0]?.register_app_id ?? null,
  });
}

async function payUserLabel(userId: number): Promise<string> {
  try {
    const user = await getSessionUserById(userId);
    if (user) return formatPayUser(user);
  } catch (err) {
    console.warn("[payment-notify] user lookup", err);
  }
  return `用户#${userId}`;
}

/** Bank confirmed an Alipay refund (including refunds started outside this admin). */
export async function notifyAlipayDepositback(input: {
  outTradeNo: string;
  tradeNo: string;
  amount?: string;
  status?: string;
}): Promise<void> {
  try {
    const order = await getOrderByOutTradeNo(input.outTradeNo);
    const amountText = input.amount?.trim()
      ? input.amount.trim().startsWith("¥")
        ? input.amount.trim()
        : `¥${input.amount.trim()}`
      : order
        ? `¥${orderAmountYuan(order)}`
        : "未知";
    const status = input.status?.trim();
    const statusText =
      status === "S" ? "成功" : status === "F" ? "失败" : status || "";
    await notifyPayment({
      event: "refunded",
      app: order ? await resolvePaymentOrderApp(order) : "qiaoqiao",
      channel: "支付宝",
      product: order ? paymentPlanTitle(order.planId) : "未知商品",
      amount: amountText,
      userLabel: order ? await payUserLabel(order.userId) : "未知用户",
      orderNo: input.outTradeNo,
      details: [
        `支付宝单号：${input.tradeNo}`,
        statusText ? `银行退回：${statusText}` : "银行已确认退回",
      ],
    });
  } catch (err) {
    console.warn("[payment-notify] alipay depositback", err);
  }
}

/**
 * Refund a paid Alipay order in full, then take back the membership
 * days and diamonds that order granted.
 * Alipay call is idempotent via a stable out_request_no.
 */
export async function refundPaidAlipayOrder(
  orderId: number,
): Promise<AlipayRefundResult> {
  await ensurePaymentOrdersTable();

  type RefundRow = RowDataPacket & {
    id: number;
    out_trade_no: string;
    user_id: number;
    app_id: string | null;
    plan_id: string;
    amount_fen: number;
    status: PaymentOrderStatus;
    alipay_trade_no: string | null;
    register_app_id: string | null;
  };

  const rows = await query<RefundRow[]>(
    `SELECT o.id, o.out_trade_no, o.user_id, o.app_id, o.plan_id, o.amount_fen,
            o.status, o.alipay_trade_no, u.register_app_id
     FROM payment_orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.id = :orderId
     LIMIT 1`,
    { orderId },
  );
  const order = rows[0];
  if (!order) {
    throw new Error("订单不存在");
  }

  const clientApp = paymentOrderClientApp(order);
  const amountYuan = formatAlipayAmount(Number(order.amount_fen) / 100);
  const grant = paymentPlanGrant(order.plan_id);
  if (!grant) {
    throw new Error("未知商品类型");
  }

  if (order.status === "refunded") {
    return {
      alreadyRefunded: true,
      outTradeNo: order.out_trade_no,
      amountYuan,
      daysRevoked: 0,
      diamondsRevoked: 0,
    };
  }
  if (order.status !== "paid") {
    throw new Error("只有已支付订单可以退款");
  }

  await refundAlipayTrade({
    outTradeNo: order.out_trade_no,
    tradeNo: order.alipay_trade_no,
    refundAmount: amountYuan,
    outRequestNo: `RF${order.id}`,
    refundReason: "管理员退款",
    clientApp,
  });

  await ensureUserDiamondsColumn();
  await ensureDiamondTransactionsTable();
  await ensureUserPaidVipColumns();
  await ensureAppleTransactionsTable();
  await ensureGoogleTransactionsTable();

  const applied = await withTransaction(async () => {
    const updated = await execute(
      `UPDATE payment_orders
       SET status = 'refunded'
       WHERE id = :orderId
         AND status = 'paid'`,
      { orderId },
    );
    if (updated.affectedRows === 0) return false;

    const userId = Number(order.user_id);
    if (grant.days > 0) {
      await shortenVip(userId, grant.days);
      await shortenPaidVip(userId, grant.days);
      // is_paid_vip stays 1 only if another non-refunded paid purchase remains.
      await recomputePaidVipFlag(userId);
    }
    if (grant.diamonds > 0) {
      await deductDiamondsFloorZero(userId, grant.diamonds, {
        type: "alipay_refund",
        meta: {
          channel: "alipay",
          outTradeNo: order.out_trade_no,
          planId: order.plan_id,
        },
      });
    }
    return true;
  });

  if (applied) {
    const details: string[] = [];
    if (grant.days > 0) details.push(`收回会员：${grant.days} 天`);
    if (grant.diamonds > 0) details.push(`收回钻石：${grant.diamonds}`);
    if (order.alipay_trade_no) {
      details.push(`支付宝单号：${order.alipay_trade_no}`);
    }
    try {
      await notifyPayment({
        event: "refunded",
        app: clientApp,
        channel: "支付宝",
        product: paymentPlanTitle(order.plan_id),
        amount: `¥${amountYuan}`,
        userLabel: await payUserLabel(Number(order.user_id)),
        orderNo: order.out_trade_no,
        details,
      });
    } catch (err) {
      console.warn("[payment-notify] alipay refund", err);
    }
  }

  return {
    alreadyRefunded: !applied,
    outTradeNo: order.out_trade_no,
    amountYuan,
    daysRevoked: applied ? grant.days : 0,
    diamondsRevoked: applied ? grant.diamonds : 0,
  };
}
