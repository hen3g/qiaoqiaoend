import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import { mapUser, type SessionUser } from "@/lib/auth";
import { extendVip } from "@/lib/courses";
import {
  insertDiamondTransaction,
  type DiamondTxType,
} from "@/lib/diamond-transactions";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";

export type DiamondChangeOpts = {
  type: DiamondTxType | string;
  meta?: Record<string, unknown> | null;
};

export type VipPlanId = "month" | "quarter" | "year";

export type VipPlan = {
  id: VipPlanId;
  title: string;
  /** Price in CNY yuan */
  price: number;
  /** Membership days granted (stackable) */
  days: number;
  /** Diamonds granted (stackable) */
  diamonds: number;
};

/** Membership plans — prices and diamond gifts. Purchases stack. */
export const VIP_PLANS: Record<VipPlanId, VipPlan> = {
  month: {
    id: "month",
    title: "月会员",
    price: 8,
    days: 31,
    diamonds: 300,
  },
  quarter: {
    id: "quarter",
    title: "季度会员",
    price: 15,
    days: 92,
    diamonds: 800,
  },
  year: {
    id: "year",
    title: "年度会员",
    price: 40,
    days: 365,
    diamonds: 2600,
  },
};

export function isVipPlanId(value: unknown): value is VipPlanId {
  return value === "month" || value === "quarter" || value === "year";
}

export function getVipPlan(planId: VipPlanId): VipPlan {
  return VIP_PLANS[planId];
}

/** 100 diamonds = ¥1 (AI relay cost conversion). */
export const DIAMONDS_PER_YUAN = 100;

export function yuanToDiamonds(yuan: number): number {
  if (!Number.isFinite(yuan) || yuan <= 0) return 0;
  return Math.ceil(yuan * DIAMONDS_PER_YUAN);
}

export async function addDiamonds(
  userId: number,
  amount: number,
  opts?: DiamondChangeOpts,
): Promise<number> {
  if (amount <= 0) return getUserDiamonds(userId);
  await ensureUserDiamondsColumn();
  await execute(
    `UPDATE users SET diamonds = diamonds + :amount WHERE id = :userId`,
    { userId, amount },
  );
  const balance = await getUserDiamonds(userId);
  if (opts?.type) {
    await insertDiamondTransaction({
      userId,
      amount,
      balanceAfter: balance,
      type: opts.type,
      meta: opts.meta,
    });
  }
  return balance;
}

export async function getUserDiamonds(userId: number): Promise<number> {
  await ensureUserDiamondsColumn();
  const rows = await query<(RowDataPacket & { diamonds: number })[]>(
    `SELECT diamonds FROM users WHERE id = :userId LIMIT 1`,
    { userId },
  );
  return Math.max(0, Number(rows[0]?.diamonds ?? 0));
}

/**
 * Post-hoc spend: deduct diamonds, floor at 0 (platform covers shortfall).
 * Returns the new balance. Writes a ledger row when opts.type is set.
 */
export async function deductDiamondsFloorZero(
  userId: number,
  amount: number,
  opts?: DiamondChangeOpts,
): Promise<number> {
  const cost = Math.floor(amount);
  if (cost <= 0) return getUserDiamonds(userId);
  await ensureUserDiamondsColumn();
  await execute(
    `UPDATE users
     SET diamonds = GREATEST(0, CAST(diamonds AS SIGNED) - :amount)
     WHERE id = :userId`,
    { userId, amount: cost },
  );
  const balance = await getUserDiamonds(userId);
  if (opts?.type) {
    await insertDiamondTransaction({
      userId,
      amount: -cost,
      balanceAfter: balance,
      type: opts.type,
      meta: opts.meta,
    });
  }
  return balance;
}

export type PurchaseVipResult = {
  plan: VipPlan;
  diamondsGranted: number;
  daysGranted: number;
  user: SessionUser;
};

/**
 * Fulfill a VIP purchase: extend VIP and add diamonds.
 * Stackable — each call adds more days and diamonds.
 * Call only after payment is confirmed (or from gated test purchase).
 */
export async function purchaseVipPlan(
  userId: number,
  planId: VipPlanId,
): Promise<PurchaseVipResult> {
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();
  const plan = getVipPlan(planId);

  await extendVip(userId, plan.days);
  await addDiamonds(userId, plan.diamonds, {
    type: "vip_purchase",
    meta: { planId: plan.id, days: plan.days },
  });

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
    { id: userId },
  );
  const row = rows[0];
  if (!row) {
    throw new Error("用户不存在");
  }

  return {
    plan,
    diamondsGranted: plan.diamonds,
    daysGranted: plan.days,
    user: mapUser(row),
  };
}
