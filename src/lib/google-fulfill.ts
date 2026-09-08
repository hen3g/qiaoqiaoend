import { getSessionUserById, type SessionUser } from "@/lib/auth";
import { extendVip } from "@/lib/courses";
import { withTransaction } from "@/lib/db";
import { getGoogleProduct } from "@/lib/google-products";
import {
  googleAccountIdOf,
  googlePurchaseEnvironment,
  verifyGoogleSignedPurchase,
  type GoogleSignedPurchase,
} from "@/lib/google-play";
import {
  ensureGoogleTransactionsTable,
  getGoogleTransaction,
  insertGoogleTransaction,
} from "@/lib/google-transactions";
import { getDiamondPack, isDiamondPackId } from "@/lib/diamond-packs";
import { ensureDiamondTransactionsTable } from "@/lib/diamond-transactions";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";
import { addDiamonds, getVipPlan, isVipPlanId } from "@/lib/vip";

export type GoogleFulfillResult = {
  alreadyProcessed: boolean;
  kind: "vip" | "diamonds";
  grantId: string;
  productId: string;
  daysGranted: number;
  diamondsGranted: number;
  user: SessionUser;
};

async function alreadyProcessedResult(
  existing: {
    userId: number;
    kind: "vip" | "diamonds";
    grantId: string;
    productId: string;
    diamondsGranted: number;
  },
  userId: number,
): Promise<GoogleFulfillResult> {
  if (existing.userId !== userId) {
    throw new Error("该 Google 购买已绑定其他账号");
  }
  const user = await getSessionUserById(userId);
  if (!user) throw new Error("用户不存在");
  let daysGranted = 0;
  let diamondsGranted = Math.max(0, Number(existing.diamondsGranted) || 0);
  if (existing.kind === "vip" && isVipPlanId(existing.grantId)) {
    const plan = getVipPlan(existing.grantId);
    daysGranted = plan.days;
    if (diamondsGranted <= 0) diamondsGranted = plan.diamonds;
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
    daysGranted: existing.kind === "vip" ? daysGranted : 0,
    diamondsGranted,
    user,
  };
}

export async function fulfillGooglePurchase(input: {
  productId: string;
  purchaseToken: string;
  signedData: string;
  signature: string;
  userId: number;
}): Promise<GoogleFulfillResult> {
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();
  await ensureDiamondTransactionsTable();
  await ensureGoogleTransactionsTable();

  const product = getGoogleProduct(input.productId);
  if (!product) {
    throw new Error("未知的 Google Play 商品");
  }

  const purchase: GoogleSignedPurchase = verifyGoogleSignedPurchase({
    signedData: input.signedData,
    signature: input.signature,
    productId: input.productId,
    purchaseToken: input.purchaseToken,
  });

  const tokenUserId = googleAccountIdOf(purchase);
  if (tokenUserId && tokenUserId !== input.userId) {
    throw new Error("该 Google 购买不属于当前账号");
  }

  const existing = await getGoogleTransaction(input.purchaseToken);
  if (existing) {
    return alreadyProcessedResult(existing, input.userId);
  }

  return withTransaction(async () => {
    const raced = await getGoogleTransaction(input.purchaseToken);
    if (raced) {
      return alreadyProcessedResult(raced, input.userId);
    }

    let daysGranted = 0;
    let diamondsGranted = 0;
    if (product.kind === "vip") {
      if (!isVipPlanId(product.grantId)) {
        throw new Error("未知的会员方案");
      }
      const plan = getVipPlan(product.grantId);
      daysGranted = plan.days;
      diamondsGranted = plan.diamonds;
    } else if (product.kind === "diamonds") {
      if (!isDiamondPackId(product.grantId)) {
        throw new Error("未知的钻石套餐");
      }
      diamondsGranted = getDiamondPack(product.grantId).diamonds;
    }

    const inserted = await insertGoogleTransaction({
      purchaseToken: input.purchaseToken,
      orderId: purchase.orderId,
      userId: input.userId,
      productId: input.productId,
      kind: product.kind,
      grantId: product.grantId,
      environment: googlePurchaseEnvironment(purchase),
      diamondsGranted,
    });
    if (!inserted) {
      const again = await getGoogleTransaction(input.purchaseToken);
      if (again) return alreadyProcessedResult(again, input.userId);
      throw new Error("该 Google 交易已处理");
    }

    if (product.kind === "vip") {
      if (!isVipPlanId(product.grantId)) {
        throw new Error("未知的会员方案");
      }
      const plan = getVipPlan(product.grantId);
      await extendVip(input.userId, plan.days);
      if (diamondsGranted > 0) {
        await addDiamonds(input.userId, diamondsGranted, {
          type: "vip_purchase",
          meta: {
            planId: plan.id,
            days: daysGranted,
            channel: "google",
            orderId: purchase.orderId || null,
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
          channel: "google",
          orderId: purchase.orderId || null,
        },
      });
    }

    const user = await getSessionUserById(input.userId);
    if (!user) throw new Error("用户不存在");
    return {
      alreadyProcessed: false,
      kind: product.kind,
      grantId: product.grantId,
      productId: input.productId,
      daysGranted,
      diamondsGranted,
      user,
    };
  });
}
