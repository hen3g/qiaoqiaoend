import type { RowDataPacket } from "mysql2";

import {
  APPLE_HAMSTER_SKU_PREFIX,
  APPLE_QIAOQIAO_SKU_PREFIX,
  getAppleProduct,
} from "@/lib/apple-products";
import { ensureAppleTransactionsTable } from "@/lib/apple-transactions";
import type { ClientAppId } from "@/lib/client-app";
import { query } from "@/lib/db";
import { ensurePaymentOrdersTable, paymentPlanTitle } from "@/lib/payment-orders";
import { getVipPlan, isVipPlanId } from "@/lib/vip";

export type UserVipRecord = {
  id: string;
  planTitle: string;
  days: number;
  grantedAt: string;
  channel: "alipay" | "apple";
};

type PayRow = RowDataPacket & {
  out_trade_no: string;
  plan_id: string;
  paid_at: Date | string | null;
  created_at: Date | string;
};

type AppleRow = RowDataPacket & {
  transaction_id: string;
  product_id: string;
  grant_id: string;
  diamonds_refunded: number | null;
  created_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export async function listUserVipRecords(
  userId: number,
  clientApp: ClientAppId,
): Promise<UserVipRecord[]> {
  await ensurePaymentOrdersTable();
  await ensureAppleTransactionsTable();

  const skuPrefix =
    clientApp === "hamster"
      ? APPLE_HAMSTER_SKU_PREFIX
      : APPLE_QIAOQIAO_SKU_PREFIX;

  const payRows = await query<PayRow[]>(
    `SELECT out_trade_no, plan_id, paid_at, created_at
     FROM payment_orders
     WHERE user_id = :userId
       AND status = 'paid'
       AND app_id = :appId
     ORDER BY id DESC
     LIMIT 100`,
    { userId, appId: clientApp },
  );

  const appleRows = await query<AppleRow[]>(
    `SELECT transaction_id, product_id, grant_id, diamonds_refunded, created_at
     FROM apple_transactions
     WHERE user_id = :userId
       AND kind = 'vip'
       AND product_id LIKE :skuLike
     ORDER BY created_at DESC
     LIMIT 100`,
    { userId, skuLike: `${skuPrefix}%` },
  );

  const records: UserVipRecord[] = [];

  for (const row of payRows) {
    if (!isVipPlanId(row.plan_id)) continue;
    const plan = getVipPlan(row.plan_id);
    records.push({
      id: `alipay:${row.out_trade_no}`,
      planTitle: paymentPlanTitle(row.plan_id),
      days: plan.days,
      grantedAt: toIso(row.paid_at) || toIso(row.created_at),
      channel: "alipay",
    });
  }

  for (const row of appleRows) {
    if (Number(row.diamonds_refunded ?? 0) > 0) continue;
    const product = getAppleProduct(row.product_id);
    const grantId = product?.grantId || row.grant_id;
    if (!isVipPlanId(grantId)) continue;
    const plan = getVipPlan(grantId);
    records.push({
      id: `apple:${row.transaction_id}`,
      planTitle: plan.title,
      days: plan.days,
      grantedAt: toIso(row.created_at),
      channel: "apple",
    });
  }

  records.sort((a, b) => (a.grantedAt < b.grantedAt ? 1 : -1));
  return records.slice(0, 100);
}
