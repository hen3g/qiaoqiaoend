import { query } from "@/lib/db";
import {
  mapUser,
  type SessionUser,
  SESSION_USER_COLUMNS,
  type SessionUserRow,
} from "@/lib/auth";
import { addDiamonds } from "@/lib/vip";
import {
  ensureShareCustomCoursesColumn,
  ensureUserDiamondsColumn,
  ensureUserPromoterColumns,
  ensureUserPaidVipColumns,
} from "@/lib/user-schema";

export type DiamondPackId = "pack6" | "pack25" | "pack28";

export type DiamondPack = {
  id: DiamondPackId;
  title: string;
  /** Price in CNY yuan */
  price: number;
  /** Diamonds granted (stackable) */
  diamonds: number;
};

/**
 * Standalone diamond recharge packs.
 * pack25 is kept for older app versions; current clients buy pack28.
 */
export const DIAMOND_PACKS: Record<DiamondPackId, DiamondPack> = {
  pack6: {
    id: "pack6",
    title: "600 钻石",
    price: 6,
    diamonds: 600,
  },
  pack25: {
    id: "pack25",
    title: "3000 钻石",
    price: 25,
    diamonds: 3000,
  },
  pack28: {
    id: "pack28",
    title: "3000 钻石",
    price: 28,
    diamonds: 3000,
  },
};

export function isDiamondPackId(value: unknown): value is DiamondPackId {
  return value === "pack6" || value === "pack25" || value === "pack28";
}

export function getDiamondPack(packId: DiamondPackId): DiamondPack {
  return DIAMOND_PACKS[packId];
}

export type PurchaseDiamondResult = {
  pack: DiamondPack;
  diamondsGranted: number;
  user: SessionUser;
};

/**
 * Fulfill a diamond pack purchase. Stackable.
 * Call only after payment is confirmed.
 */
export async function purchaseDiamondPack(
  userId: number,
  packId: DiamondPackId,
): Promise<PurchaseDiamondResult> {
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPaidVipColumns();
  await ensureUserPromoterColumns();
  const pack = getDiamondPack(packId);

  await addDiamonds(userId, pack.diamonds, {
    type: "diamond_purchase",
    meta: { packId: pack.id, price: pack.price },
  });

  const rows = await query<SessionUserRow[]>(
    `SELECT ${SESSION_USER_COLUMNS}
     FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  const row = rows[0];
  if (!row) {
    throw new Error("用户不存在");
  }

  return {
    pack,
    diamondsGranted: pack.diamonds,
    user: mapUser(row),
  };
}
