import { execute } from "@/lib/db";
import { VIP_PLANS } from "@/lib/vip";
import { ensureUserPaidVipColumns } from "@/lib/user-schema";

/**
 * Paid-membership tracking (充值会员), kept apart from `vip_expires_at`.
 *
 * - `users.vip_expires_at` stays the overall access window (paid + gifts).
 * - `users.paid_vip_expires_at` is the end of time the user actually paid for.
 * - `users.is_paid_vip` = has at least one successful, non-refunded paid
 *   membership purchase (stays 1 after the paid time runs out).
 *
 * Gift paths (爱吃 nickname promo, redeem / promoter / gift codes, promo
 * rewards, admin scripts) must never call these helpers.
 *
 * Call `ensureUserPaidVipColumns()` before opening a transaction: the ensure
 * step may run DDL, which would implicitly commit an open transaction.
 */

const VIP_PLAN_IDS_SQL = Object.keys(VIP_PLANS)
  .map((id) => `'${id}'`)
  .join(", ");

/** Add paid days from max(now, current paid expiry) and mark as paid. */
export async function extendPaidVip(userId: number, days: number) {
  if (!Number.isFinite(days) || days <= 0) return;
  await ensureUserPaidVipColumns();
  await execute(
    `UPDATE users
     SET is_paid_vip = 1,
         paid_vip_expires_at = DATE_ADD(
           CASE
             WHEN paid_vip_expires_at IS NULL OR paid_vip_expires_at < NOW()
               THEN NOW()
             ELSE paid_vip_expires_at
           END,
           INTERVAL :days DAY
         )
     WHERE id = :userId`,
    { userId, days },
  );
}

/** Apple subscription: paid expiry is at least Apple's period end (no stacking). */
export async function setPaidVipExpiresAtLeast(userId: number, expiresAt: Date) {
  if (Number.isNaN(expiresAt.getTime())) return;
  await ensureUserPaidVipColumns();
  await execute(
    `UPDATE users
     SET is_paid_vip = 1,
         paid_vip_expires_at = CASE
           WHEN paid_vip_expires_at IS NULL OR paid_vip_expires_at < :expiresAt
             THEN :expiresAt
           ELSE paid_vip_expires_at
         END
     WHERE id = :userId`,
    { userId, expiresAt },
  );
}

/**
 * Take back paid days granted by one refunded purchase.
 * Never moves the expiry earlier than now (already-elapsed paid time stays as-is).
 */
export async function shortenPaidVip(userId: number, days: number) {
  if (!Number.isFinite(days) || days <= 0) return;
  await ensureUserPaidVipColumns();
  await execute(
    `UPDATE users
     SET paid_vip_expires_at = CASE
       WHEN paid_vip_expires_at IS NULL OR paid_vip_expires_at <= NOW()
         THEN paid_vip_expires_at
       WHEN DATE_SUB(paid_vip_expires_at, INTERVAL :days DAY) <= NOW()
         THEN NOW()
       ELSE DATE_SUB(paid_vip_expires_at, INTERVAL :days DAY)
     END
     WHERE id = :userId`,
    { userId, days },
  );
}

/** Refunded subscription: paid expiry goes back to the refund time (never later). */
export async function setPaidVipExpiresAtMost(userId: number, at: Date) {
  if (Number.isNaN(at.getTime())) return;
  await ensureUserPaidVipColumns();
  await execute(
    `UPDATE users
     SET paid_vip_expires_at = CASE
       WHEN paid_vip_expires_at IS NULL THEN NULL
       WHEN paid_vip_expires_at > :at THEN :at
       ELSE paid_vip_expires_at
     END
     WHERE id = :userId`,
    { userId, at },
  );
}

/**
 * After a refund: is_paid_vip = 1 only if another successful, non-refunded paid
 * membership purchase remains (Alipay paid, Apple Production, Google non-test).
 * When none remain, the paid expiry is cleared too.
 */
export async function recomputePaidVipFlag(userId: number) {
  await ensureUserPaidVipColumns();
  await execute(
    `UPDATE users u
     JOIN (
       SELECT (
         EXISTS (
           SELECT 1 FROM payment_orders
           WHERE user_id = :userId AND status = 'paid'
             AND plan_id IN (${VIP_PLAN_IDS_SQL})
         )
         OR EXISTS (
           SELECT 1 FROM apple_transactions
           WHERE user_id = :userId AND kind = 'vip'
             AND environment = 'Production'
             AND refunded_at IS NULL AND diamonds_refunded = 0
         )
         OR EXISTS (
           SELECT 1 FROM google_transactions
           WHERE user_id = :userId AND kind = 'vip'
             AND environment <> 'Test'
         )
       ) AS has_paid
     ) p
     SET u.is_paid_vip = IF(p.has_paid, 1, 0),
         u.paid_vip_expires_at = IF(p.has_paid, u.paid_vip_expires_at, NULL)
     WHERE u.id = :userId`,
    { userId },
  );
}
