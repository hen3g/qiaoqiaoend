import { getSessionUserById, type SessionUser } from "@/lib/auth";
import {
  getAppleOriginalOwner,
  getAppleTransaction,
  insertAppleTransaction,
} from "@/lib/apple-transactions";
import { getAppleProduct } from "@/lib/apple-products";
import type { AppleSignedTransaction } from "@/lib/apple-jws";
import {
  extendVip,
  setVipExpiresAtLeast,
} from "@/lib/courses";
import {
  addDiamonds,
  getVipPlan,
  isVipPlanId,
} from "@/lib/vip";
import {
  getDiamondPack,
  isDiamondPackId,
} from "@/lib/diamond-packs";
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

export async function fulfillAppleTransaction(input: {
  tx: AppleSignedTransaction;
  userId: number;
}): Promise<AppleFulfillResult> {
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();

  const product = getAppleProduct(input.tx.productId);
  if (!product) {
    throw new Error("未知的 Apple 商品");
  }

  const existing = await getAppleTransaction(input.tx.transactionId);
  if (existing) {
    if (existing.userId !== input.userId) {
      throw new Error("该 Apple 交易已绑定其他账号");
    }
    const user = await getSessionUserById(input.userId);
    if (!user) throw new Error("用户不存在");
    return {
      alreadyProcessed: true,
      kind: existing.kind,
      grantId: existing.grantId,
      productId: existing.productId,
      daysGranted: 0,
      diamondsGranted: 0,
      user,
    };
  }

  const originalOwner = await getAppleOriginalOwner(
    input.tx.originalTransactionId,
  );
  if (originalOwner && originalOwner.userId !== input.userId) {
    throw new Error("该 Apple 订阅已绑定其他账号");
  }

  let daysGranted = 0;
  let diamondsGranted = 0;
  const expired = Boolean(
    input.tx.expiresDate && input.tx.expiresDate <= Date.now(),
  );

  if (product.kind === "vip" && !expired) {
    if (!isVipPlanId(product.grantId)) {
      throw new Error("未知的会员方案");
    }
    const plan = getVipPlan(product.grantId);
    if (input.tx.expiresDate) {
      await setVipExpiresAtLeast(input.userId, new Date(input.tx.expiresDate));
      daysGranted = plan.days;
    } else {
      await extendVip(input.userId, plan.days);
      daysGranted = plan.days;
    }
    if (shouldGrantSubscriptionDiamonds(input.tx)) {
      await addDiamonds(input.userId, plan.diamonds, {
        type: "vip_purchase",
        meta: {
          planId: plan.id,
          days: plan.days,
          channel: "apple",
          transactionId: input.tx.transactionId,
        },
      });
      diamondsGranted = plan.diamonds;
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
    diamondsGranted = pack.diamonds;
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
    if (raced && raced.userId === input.userId) {
      const user = await getSessionUserById(input.userId);
      if (!user) throw new Error("用户不存在");
      return {
        alreadyProcessed: true,
        kind: raced.kind,
        grantId: raced.grantId,
        productId: raced.productId,
        daysGranted: 0,
        diamondsGranted: 0,
        user,
      };
    }
    throw new Error("该 Apple 交易已处理");
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
}

/** Server notification: bind to the original purchaser. */
export async function fulfillAppleNotificationTx(
  tx: AppleSignedTransaction,
): Promise<AppleFulfillResult | null> {
  const owner = await getAppleOriginalOwner(tx.originalTransactionId);
  if (!owner) {
    console.warn(
      "[apple/notify] no owner for originalTransactionId",
      tx.originalTransactionId,
    );
    return null;
  }
  return fulfillAppleTransaction({ tx, userId: owner.userId });
}
