import { getSessionUserById, type SessionUser } from "@/lib/auth";
import {
  ensureAppleTransactionsTable,
  getAppleOriginalOwner,
  getAppleTransaction,
  insertAppleTransaction,
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

function shouldGrantSubscriptionDiamonds(tx: AppleSignedTransaction): boolean {
  const reason = (tx.transactionReason || "PURCHASE").toUpperCase();
  return reason !== "RENEWAL";
}

function isAppleVipExpired(tx: AppleSignedTransaction): boolean {
  return Boolean(tx.expiresDate && tx.expiresDate <= Date.now());
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
    daysGranted = plan.days;
    const product = getAppleProduct(existing.productId);
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
      daysGranted = plan.days;
      if (
        isAppleConsumableProduct(product) ||
        shouldGrantSubscriptionDiamonds(input.tx)
      ) {
        diamondsGranted = plan.diamonds;
      }
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
      if (
        !isAppleConsumableProduct(product) &&
        input.tx.expiresDate
      ) {
        await setVipExpiresAtLeast(input.userId, new Date(input.tx.expiresDate));
      } else {
        await extendVip(input.userId, plan.days);
      }
      if (diamondsGranted > 0) {
        await addDiamonds(input.userId, diamondsGranted, {
          type: "vip_purchase",
          meta: {
            planId: plan.id,
            days: plan.days,
            channel: "apple",
            transactionId: input.tx.transactionId,
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
