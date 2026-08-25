import { getSessionUserById, type SessionUser } from "@/lib/auth";
import {
  ensureAppleTransactionsTable,
  getAppleOriginalOwner,
  getAppleTransaction,
  insertAppleTransaction,
  claimAppleDiamondRefund,
} from "@/lib/apple-transactions";
import {
  getAppleProduct,
  isAppleConsumableProduct,
  userIdFromAppleAppAccountToken,
} from "@/lib/apple-products";
import type { AppleSignedTransaction } from "@/lib/apple-jws";
import {
  extendVip,
  setVipExpiresAtLeast,
} from "@/lib/courses";
import { withTransaction } from "@/lib/db";
import {
  addDiamonds,
  deductDiamondsFloorZero,
  getVipPlan,
  isVipPlanId,
} from "@/lib/vip";
import {
  getDiamondPack,
  isDiamondPackId,
} from "@/lib/diamond-packs";
import { ensureDiamondTransactionsTable } from "@/lib/diamond-transactions";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";

export type AppleFulfillResult = {
  alreadyProcessed: boolean;
  kind: "vip" | "diamonds";
  grantId: string;
  productId: string;
  daysGranted: number;
  diamondsGranted: number;
  user: SessionUser;
};

function isIntroductoryOffer(tx: AppleSignedTransaction): boolean {
  if (tx.offerType === 1) return true;
  // 1000 milliunits = ¥1.00
  return typeof tx.price === "number" && tx.price > 0 && tx.price <= 1000;
}

function shouldGrantSubscriptionDiamonds(tx: AppleSignedTransaction): boolean {
  const reason = (tx.transactionReason || "PURCHASE").toUpperCase();
  return reason !== "RENEWAL";
}

function diamondsForVipGrant(
  product: ReturnType<typeof getAppleProduct>,
  plan: ReturnType<typeof getVipPlan>,
  tx: AppleSignedTransaction,
): number {
  if (!product) return 0;
  if (isAppleConsumableProduct(product)) return plan.diamonds;
  if (product.grantId === "month6") {
    return isIntroductoryOffer(tx)
      ? (plan.introDiamonds ?? 50)
      : plan.diamonds;
  }
  return shouldGrantSubscriptionDiamonds(tx) ? plan.diamonds : 0;
}

function isRenewalTx(tx: AppleSignedTransaction): boolean {
  return (tx.transactionReason || "PURCHASE").toUpperCase() === "RENEWAL";
}

/** Apple sandbox compresses 1 month to ~5 minutes. */
const SANDBOX_PERIOD_MS = 12 * 60 * 60 * 1000;

function isSandboxAcceleratedPeriod(tx: AppleSignedTransaction): boolean {
  if (!tx.expiresDate) return tx.environment === "Sandbox";
  const start = tx.purchaseDate || Date.now();
  return tx.expiresDate - start < SANDBOX_PERIOD_MS;
}

function isAppleVipExpired(tx: AppleSignedTransaction): boolean {
  if (!tx.expiresDate || tx.expiresDate > Date.now()) return false;
  // Delayed verify of a just-paid sandbox purchase should still grant.
  if (!isRenewalTx(tx) && isSandboxAcceleratedPeriod(tx)) return false;
  return true;
}

function remainingVipDays(expiresAt: string | Date | null | undefined): number {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function subscriptionExpiryDate(
  tx: AppleSignedTransaction,
  planDays: number,
): Date {
  const start = tx.purchaseDate || Date.now();
  const planEnd = new Date(start + planDays * 86_400_000);
  if (tx.expiresDate && !isSandboxAcceleratedPeriod(tx)) {
    return new Date(tx.expiresDate);
  }
  // Sandbox renewals must not stack another 31 days every few minutes.
  if (isRenewalTx(tx) && tx.expiresDate) {
    return new Date(tx.expiresDate);
  }
  return planEnd;
}

function subscriptionDaysGranted(
  tx: AppleSignedTransaction,
  fallback: number,
): number {
  const end = subscriptionExpiryDate(tx, fallback).getTime();
  const start = tx.purchaseDate || Date.now();
  return Math.max(1, Math.ceil((end - start) / 86_400_000));
}

async function alreadyProcessedResult(
  existing: {
    userId: number;
    kind: "vip" | "diamonds";
    grantId: string;
    productId: string;
    diamondsGranted: number;
  },
  userId: number,
): Promise<AppleFulfillResult> {
  const user = await getSessionUserById(userId);
  if (!user) throw new Error("用户不存在");
  let daysGranted = 0;
  let diamondsGranted = Math.max(0, Number(existing.diamondsGranted) || 0);
  if (existing.kind === "vip" && isVipPlanId(existing.grantId)) {
    const plan = getVipPlan(existing.grantId);
    const product = getAppleProduct(existing.productId);
    daysGranted =
      product && !isAppleConsumableProduct(product)
        ? remainingVipDays(user.vipExpiresAt)
        : plan.days;
    if (
      diamondsGranted <= 0 &&
      product &&
      isAppleConsumableProduct(product)
    ) {
      diamondsGranted = plan.diamonds;
    }
  } else if (
    existing.kind === "diamonds" &&
    isDiamondPackId(existing.grantId)
  ) {
    if (diamondsGranted <= 0) {
      diamondsGranted = getDiamondPack(existing.grantId).diamonds;
    }
  }
  return {
    alreadyProcessed: true,
    kind: existing.kind,
    grantId: existing.grantId,
    productId: existing.productId,
    daysGranted,
    diamondsGranted,
    user,
  };
}

export async function fulfillAppleTransaction(input: {
  tx: AppleSignedTransaction;
  userId: number;
}): Promise<AppleFulfillResult> {
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();
  await ensureDiamondTransactionsTable();
  await ensureAppleTransactionsTable();

  const product = getAppleProduct(input.tx.productId);
  if (!product) {
    throw new Error("未知的 Apple 商品");
  }

  if (!isAppleConsumableProduct(product)) {
    const tokenUserId = userIdFromAppleAppAccountToken(
      input.tx.appAccountToken,
    );
    if (tokenUserId && tokenUserId !== input.userId) {
      throw new Error("该 Apple 购买不属于当前账号");
    }
    const owner = await getAppleOriginalOwner(input.tx.originalTransactionId);
    if (owner && owner.userId !== input.userId) {
      throw new Error("该订阅已绑定其他账号，请使用原账号登录后恢复购买");
    }
  }

  if (
    product.kind === "vip" &&
    !isAppleConsumableProduct(product) &&
    isAppleVipExpired(input.tx)
  ) {
    throw new Error("该 Apple 订阅已过期");
  }

  return withTransaction(async () => {
    const existing = await getAppleTransaction(input.tx.transactionId);
    if (existing) {
      return alreadyProcessedResult(existing, input.userId);
    }

    let daysGranted = 0;
    let diamondsGranted = 0;

    if (product.kind === "vip") {
      if (!isVipPlanId(product.grantId)) {
        throw new Error("未知的会员方案");
      }
      const plan = getVipPlan(product.grantId);
      daysGranted = isAppleConsumableProduct(product)
        ? plan.days
        : subscriptionDaysGranted(input.tx, plan.days);
      diamondsGranted = diamondsForVipGrant(product, plan, input.tx);
    } else if (product.kind === "diamonds") {
      if (!isDiamondPackId(product.grantId)) {
        throw new Error("未知的钻石套餐");
      }
      diamondsGranted = getDiamondPack(product.grantId).diamonds;
    }

    const inserted = await insertAppleTransaction({
      transactionId: input.tx.transactionId,
      originalTransactionId: input.tx.originalTransactionId,
      userId: input.userId,
      productId: input.tx.productId,
      kind: product.kind,
      grantId: product.grantId,
      environment: input.tx.environment,
      diamondsGranted,
      priceMilliunits: input.tx.price ?? null,
      offerType: input.tx.offerType ?? null,
    });

    if (!inserted) {
      const raced = await getAppleTransaction(input.tx.transactionId);
      if (raced) {
        return alreadyProcessedResult(raced, input.userId);
      }
      throw new Error("该 Apple 交易已处理");
    }

    if (product.kind === "vip") {
      if (!isVipPlanId(product.grantId)) {
        throw new Error("未知的会员方案");
      }
      const plan = getVipPlan(product.grantId);
      if (!isAppleConsumableProduct(product)) {
        await setVipExpiresAtLeast(
          input.userId,
          subscriptionExpiryDate(input.tx, plan.days),
        );
      } else {
        await extendVip(input.userId, plan.days);
      }
      if (diamondsGranted > 0) {
        await addDiamonds(input.userId, diamondsGranted, {
          type: "vip_purchase",
          meta: {
            planId: plan.id,
            days: daysGranted,
            channel: "apple",
            transactionId: input.tx.transactionId,
            offerType: input.tx.offerType ?? null,
          },
        });
      }
    } else if (product.kind === "diamonds") {
      if (!isDiamondPackId(product.grantId)) {
        throw new Error("未知的钻石套餐");
      }
      const pack = getDiamondPack(product.grantId);
      await addDiamonds(input.userId, pack.diamonds, {
        type: "diamond_purchase",
        meta: {
          packId: pack.id,
          price: pack.price,
          channel: "apple",
          transactionId: input.tx.transactionId,
        },
      });
    }

    const user = await getSessionUserById(input.userId);
    if (!user) throw new Error("用户不存在");
    return {
      alreadyProcessed: false,
      kind: product.kind,
      grantId: product.grantId,
      productId: input.tx.productId,
      daysGranted,
      diamondsGranted,
      user,
    };
  });
}

/** Server notification: original purchaser, or appAccountToken on first buy. */
export async function fulfillAppleNotificationTx(
  tx: AppleSignedTransaction,
): Promise<AppleFulfillResult | null> {
  const owner = await getAppleOriginalOwner(tx.originalTransactionId);
  const tokenUserId = userIdFromAppleAppAccountToken(tx.appAccountToken);
  const userId = owner?.userId ?? tokenUserId;
  if (!userId) {
    console.warn(
      "[apple/notify] no owner for originalTransactionId",
      tx.originalTransactionId,
    );
    return null;
  }
  const user = await getSessionUserById(userId);
  if (!user) {
    console.warn("[apple/notify] user missing", userId);
    return null;
  }
  return fulfillAppleTransaction({ tx, userId });
}

export type AppleRefundResult = {
  alreadyProcessed: boolean;
  diamondsClawed: number;
  userId: number | null;
};

/**
 * Apple refund: claw back diamonds granted by this transaction only.
 * VIP / subscription time is left unchanged.
 */
export async function clawbackAppleRefundDiamonds(
  tx: AppleSignedTransaction,
): Promise<AppleRefundResult> {
  await ensureUserDiamondsColumn();
  await ensureDiamondTransactionsTable();
  await ensureAppleTransactionsTable();

  return withTransaction(async () => {
    const existing = await getAppleTransaction(tx.transactionId);
    if (!existing) {
      return { alreadyProcessed: true, diamondsClawed: 0, userId: null };
    }
    if (existing.diamondsGranted <= 0 || existing.diamondsRefunded > 0) {
      return {
        alreadyProcessed: true,
        diamondsClawed: 0,
        userId: existing.userId,
      };
    }
    const claimed = await claimAppleDiamondRefund(tx.transactionId);
    if (!claimed) {
      return {
        alreadyProcessed: true,
        diamondsClawed: 0,
        userId: existing.userId,
      };
    }
    await deductDiamondsFloorZero(claimed.userId, claimed.amount, {
      type: "apple_refund",
      meta: {
        channel: "apple",
        transactionId: tx.transactionId,
        productId: tx.productId,
      },
    });
    return {
      alreadyProcessed: false,
      diamondsClawed: claimed.amount,
      userId: claimed.userId,
    };
  });
}
