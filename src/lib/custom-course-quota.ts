import type { RowDataPacket } from "mysql2";
import { execute, query, withTransaction } from "@/lib/db";
import { ensureCustomCourseQuotaColumn } from "@/lib/user-schema";
import {
  getUserDiamonds,
  tryDeductDiamonds,
} from "@/lib/vip";

/** Free custom-course slots for every account. */
export const DEFAULT_CUSTOM_COURSE_QUOTA = 3;
/** Hard cap after diamond unlocks. */
export const MAX_CUSTOM_COURSE_QUOTA = 10;
/** Diamonds to unlock +1 slot. */
export const UNLOCK_CUSTOM_COURSE_COST = 10;

export type CustomCourseQuotaStatus = {
  quota: number;
  maxQuota: number;
  defaultQuota: number;
  unlockCost: number;
  diamonds: number;
  canUnlock: boolean;
};

export class CustomCourseQuotaMaxError extends Error {
  readonly quota: number;
  constructor(quota: number) {
    super("自制词库名额已达上限");
    this.name = "CustomCourseQuotaMaxError";
    this.quota = quota;
  }
}

export class CustomCourseQuotaInsufficientDiamondsError extends Error {
  readonly balance: number;
  constructor(balance: number) {
    super("钻石不足，请充值后再试");
    this.name = "CustomCourseQuotaInsufficientDiamondsError";
    this.balance = balance;
  }
}

function clampQuota(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_CUSTOM_COURSE_QUOTA;
  return Math.min(
    MAX_CUSTOM_COURSE_QUOTA,
    Math.max(DEFAULT_CUSTOM_COURSE_QUOTA, n),
  );
}

export async function getCustomCourseQuota(
  userId: number,
): Promise<CustomCourseQuotaStatus> {
  await ensureCustomCourseQuotaColumn();
  const rows = await query<
    (RowDataPacket & { custom_course_quota: number; diamonds: number })[]
  >(
    `SELECT custom_course_quota, diamonds
     FROM users WHERE id = :userId LIMIT 1`,
    { userId },
  );
  const quota = clampQuota(rows[0]?.custom_course_quota);
  const diamonds = Math.max(0, Number(rows[0]?.diamonds ?? 0) || 0);
  return {
    quota,
    maxQuota: MAX_CUSTOM_COURSE_QUOTA,
    defaultQuota: DEFAULT_CUSTOM_COURSE_QUOTA,
    unlockCost: UNLOCK_CUSTOM_COURSE_COST,
    diamonds,
    canUnlock: quota < MAX_CUSTOM_COURSE_QUOTA,
  };
}

/**
 * Spend diamonds to unlock +1 custom-course slot (atomic transaction).
 * Returns new quota + diamond balance.
 */
export async function unlockCustomCourseSlot(userId: number): Promise<{
  quota: number;
  diamonds: number;
  unlockCost: number;
  maxQuota: number;
}> {
  await ensureCustomCourseQuotaColumn();

  return withTransaction(async () => {
    const status = await getCustomCourseQuota(userId);
    if (status.quota >= MAX_CUSTOM_COURSE_QUOTA) {
      throw new CustomCourseQuotaMaxError(status.quota);
    }

    const deducted = await tryDeductDiamonds(
      userId,
      UNLOCK_CUSTOM_COURSE_COST,
      {
        type: "custom_course_slot",
        meta: { fromQuota: status.quota, toQuota: status.quota + 1 },
      },
    );
    if (!deducted.ok) {
      throw new CustomCourseQuotaInsufficientDiamondsError(deducted.balance);
    }

    const result = await execute(
      `UPDATE users
       SET custom_course_quota = custom_course_quota + 1
       WHERE id = :userId
         AND custom_course_quota < :maxQuota`,
      { userId, maxQuota: MAX_CUSTOM_COURSE_QUOTA },
    );

    if (!result.affectedRows) {
      // Concurrent unlock hit the cap — roll back the whole transaction.
      throw new CustomCourseQuotaMaxError(MAX_CUSTOM_COURSE_QUOTA);
    }

    const diamonds = await getUserDiamonds(userId);
    return {
      quota: clampQuota(status.quota + 1),
      diamonds,
      unlockCost: UNLOCK_CUSTOM_COURSE_COST,
      maxQuota: MAX_CUSTOM_COURSE_QUOTA,
    };
  });
}
