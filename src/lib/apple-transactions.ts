import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import {
  getAppleProduct,
  type AppleBilling,
} from "@/lib/apple-products";
import {
  getDiamondPack,
  isDiamondPackId,
} from "@/lib/diamond-packs";
import { getVipPlan, isVipPlanId } from "@/lib/vip";

export type AppleTxKind = "vip" | "diamonds";
export type AppleOrderStatus = "paid" | "refunded";

export type AppleTransactionRow = {
  transactionId: string;
  originalTransactionId: string;
  userId: number;
  productId: string;
  kind: AppleTxKind;
  grantId: string;
  environment: string;
  diamondsGranted: number;
  diamondsRefunded: number;
};

type Row = RowDataPacket & {
  transaction_id: string;
  original_transaction_id: string;
  user_id: number;
  product_id: string;
  kind: AppleTxKind;
  grant_id: string;
  environment: string;
  diamonds_granted: number;
  diamonds_refunded?: number;
  price_milliunits?: number | null;
  offer_type?: number | null;
  currency?: string | null;
  created_at?: Date | string;
  username?: string | null;
  nickname?: string | null;
};

export type AdminAppleOrder = {
  transactionId: string;
  originalTransactionId: string;
  userId: number;
  username: string | null;
  nickname: string | null;
  productId: string;
  kind: AppleTxKind;
  grantId: string;
  planTitle: string;
  billing: AppleBilling | null;
  environment: string;
  /** CNY fen when the receipt is RMB; 0 for other currencies. */
  amountFen: number;
  amountYuan: string;
  /** Receipt money with storefront currency, e.g. `$4.99` or `¥38.00`. */
  amountDisplay: string;
  currency: string;
  currencyLabel: string;
  catalogAmountFen: number;
  catalogAmountYuan: string;
  discounted: boolean;
  offerType: number | null;
  status: AppleOrderStatus;
  diamondsGranted: number;
  diamondsRefunded: number;
  createdAt: string;
};

export type AdminAppleOrderSummary = {
  total: number;
  paidCount: number;
  refundedCount: number;
  paidFen: number;
  /** Combined receipt totals, e.g. `¥38.00 + $4.99`. */
  paidDisplay: string;
};

export type AdminAppleOrderListResult = {
  orders: AdminAppleOrder[];
  total: number;
  page: number;
  pageSize: number;
  summary: AdminAppleOrderSummary;
};

let tableEnsured = false;
let refundColumnEnsured = false;
let priceColumnsEnsured = false;

export async function ensureAppleTransactionsTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS apple_transactions (
      transaction_id VARCHAR(64) NOT NULL,
      original_transaction_id VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      product_id VARCHAR(128) NOT NULL,
      kind VARCHAR(16) NOT NULL,
      grant_id VARCHAR(16) NOT NULL,
      environment VARCHAR(16) NOT NULL,
      diamonds_granted INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (transaction_id),
      KEY idx_apple_tx_original (original_transaction_id),
      KEY idx_apple_tx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableEnsured = true;
  await ensureAppleDiamondsRefundedColumn();
  await ensureApplePriceColumns();
}

async function ensureAppleDiamondsRefundedColumn(): Promise<void> {
  if (refundColumnEnsured) return;
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM apple_transactions LIKE 'diamonds_refunded'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE apple_transactions
       ADD COLUMN diamonds_refunded INT NOT NULL DEFAULT 0 AFTER diamonds_granted`,
    );
  }
  refundColumnEnsured = true;
}

async function ensureApplePriceColumns(): Promise<void> {
  if (priceColumnsEnsured) return;
  type ColRow = RowDataPacket & { Field: string };
  const priceCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM apple_transactions LIKE 'price_milliunits'`,
  );
  if (priceCols.length === 0) {
    await execute(
      `ALTER TABLE apple_transactions
       ADD COLUMN price_milliunits INT NULL AFTER diamonds_refunded`,
    );
  }
  const offerCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM apple_transactions LIKE 'offer_type'`,
  );
  if (offerCols.length === 0) {
    await execute(
      `ALTER TABLE apple_transactions
       ADD COLUMN offer_type TINYINT NULL AFTER price_milliunits`,
    );
  }
  const currencyCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM apple_transactions LIKE 'currency'`,
  );
  if (currencyCols.length === 0) {
    await execute(
      `ALTER TABLE apple_transactions
       ADD COLUMN currency CHAR(3) NULL AFTER offer_type`,
    );
    await execute(
      `UPDATE apple_transactions
       SET currency = 'USD'
       WHERE currency IS NULL
         AND price_milliunits IS NOT NULL
         AND MOD(price_milliunits, 1000) <> 0`,
    );
  }
  priceColumnsEnsured = true;
}

function mapRow(row: Row): AppleTransactionRow {
  return {
    transactionId: row.transaction_id,
    originalTransactionId: row.original_transaction_id,
    userId: Number(row.user_id),
    productId: row.product_id,
    kind: row.kind,
    grantId: row.grant_id,
    environment: row.environment,
    diamondsGranted: Number(row.diamonds_granted ?? 0),
    diamondsRefunded: Number(row.diamonds_refunded ?? 0),
  };
}

export async function getAppleTransaction(
  transactionId: string,
): Promise<AppleTransactionRow | null> {
  await ensureAppleTransactionsTable();
  const rows = await query<Row[]>(
    `SELECT transaction_id, original_transaction_id, user_id, product_id, kind,
            grant_id, environment, diamonds_granted, diamonds_refunded
     FROM apple_transactions WHERE transaction_id = :transactionId LIMIT 1`,
    { transactionId },
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getAppleOriginalOwner(
  originalTransactionId: string,
): Promise<AppleTransactionRow | null> {
  await ensureAppleTransactionsTable();
  const rows = await query<Row[]>(
    `SELECT transaction_id, original_transaction_id, user_id, product_id, kind,
            grant_id, environment, diamonds_granted, diamonds_refunded
     FROM apple_transactions
     WHERE original_transaction_id = :originalTransactionId
     ORDER BY created_at ASC
     LIMIT 1`,
    { originalTransactionId },
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insertAppleTransaction(
  row: Omit<AppleTransactionRow, "diamondsRefunded"> & {
    priceMilliunits?: number | null;
    offerType?: number | null;
    currency?: string | null;
  },
): Promise<boolean> {
  await ensureAppleTransactionsTable();
  const result = await execute(
    `INSERT IGNORE INTO apple_transactions
       (transaction_id, original_transaction_id, user_id, product_id, kind,
        grant_id, environment, diamonds_granted, price_milliunits, offer_type,
        currency)
     VALUES
       (:transactionId, :originalTransactionId, :userId, :productId, :kind,
        :grantId, :environment, :diamondsGranted, :priceMilliunits, :offerType,
        :currency)`,
    {
      ...row,
      priceMilliunits: row.priceMilliunits ?? null,
      offerType: row.offerType ?? null,
      currency: normalizeAppleCurrency(row.currency) ?? null,
    },
  );
  return (result.affectedRows ?? 0) > 0;
}

/** Mark this tx's gifted diamonds as refunded. Returns the amount if this caller won the race. */
export async function claimAppleDiamondRefund(
  transactionId: string,
): Promise<{ userId: number; amount: number } | null> {
  await ensureAppleTransactionsTable();
  const result = await execute(
    `UPDATE apple_transactions
     SET diamonds_refunded = diamonds_granted
     WHERE transaction_id = :transactionId
       AND diamonds_granted > 0
       AND diamonds_refunded = 0`,
    { transactionId },
  );
  if ((result.affectedRows ?? 0) === 0) return null;
  const row = await getAppleTransaction(transactionId);
  if (!row) return null;
  return { userId: row.userId, amount: row.diamondsGranted };
}

export function appleGrantTitle(grantId: string): string {
  if (isVipPlanId(grantId)) return getVipPlan(grantId).title;
  if (isDiamondPackId(grantId)) return getDiamondPack(grantId).title;
  return grantId;
}

export function appleCatalogAmountFen(grantId: string): number {
  if (isVipPlanId(grantId)) return Math.round(getVipPlan(grantId).price * 100);
  if (isDiamondPackId(grantId)) return Math.round(getDiamondPack(grantId).price * 100);
  return 0;
}

const APPLE_CURRENCY_META: Record<string, { symbol: string; label: string }> = {
  CNY: { symbol: "¥", label: "人民币" },
  USD: { symbol: "$", label: "美元" },
  HKD: { symbol: "HK$", label: "港币" },
  TWD: { symbol: "NT$", label: "新台币" },
  MOP: { symbol: "MOP$", label: "澳门元" },
  EUR: { symbol: "€", label: "欧元" },
  GBP: { symbol: "£", label: "英镑" },
  JPY: { symbol: "¥", label: "日元" },
  KRW: { symbol: "₩", label: "韩元" },
  SGD: { symbol: "S$", label: "新加坡元" },
  AUD: { symbol: "A$", label: "澳元" },
  CAD: { symbol: "C$", label: "加元" },
};

export function normalizeAppleCurrency(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  return code;
}

/**
 * Receipt currency. China IAP is whole yuan (milliunits % 1000 === 0).
 * Older rows without `currency` that look like $x.99 are treated as USD.
 */
export function inferAppleCurrency(
  stored: string | null | undefined,
  priceMilliunits: number | null | undefined,
): string {
  const normalized = normalizeAppleCurrency(stored);
  if (normalized) return normalized;
  if (
    priceMilliunits == null ||
    !Number.isFinite(Number(priceMilliunits))
  ) {
    return "CNY";
  }
  if (Number(priceMilliunits) % 1000 === 0) return "CNY";
  return "USD";
}

export function appleCurrencyLabel(currency: string): string {
  return APPLE_CURRENCY_META[currency]?.label ?? currency;
}

/** Apple StoreKit `price` is milliunits of the storefront currency (1000 = 1.00). */
export function appleMilliunitsToFen(milliunits: number): number {
  if (!Number.isFinite(milliunits) || milliunits < 0) return 0;
  return Math.round(milliunits / 10);
}

export function formatAppleMoney(
  milliunits: number,
  currency: string,
): string {
  const major = (Math.max(0, milliunits) / 1000).toFixed(2);
  const symbol = APPLE_CURRENCY_META[currency]?.symbol;
  return symbol ? `${symbol}${major}` : `${currency} ${major}`;
}

function isAppleOfferType(offerType: number | null | undefined): boolean {
  return (
    offerType === 1 ||
    offerType === 2 ||
    offerType === 3 ||
    offerType === 4
  );
}

/**
 * Amount the customer actually paid.
 * Prefers Apple receipt price; month6 intro (50 diamonds / ¥1) for older rows.
 * Only valid as CNY fen when the receipt currency is RMB.
 */
export function applePaidAmountFen(input: {
  grantId: string;
  diamondsGranted: number;
  priceMilliunits?: number | null;
}): number {
  if (
    input.priceMilliunits != null &&
    Number.isFinite(Number(input.priceMilliunits))
  ) {
    return appleMilliunitsToFen(Number(input.priceMilliunits));
  }
  if (isVipPlanId(input.grantId)) {
    const plan = getVipPlan(input.grantId);
    if (
      plan.introDiamonds != null &&
      input.diamondsGranted === plan.introDiamonds
    ) {
      return 100;
    }
  }
  return appleCatalogAmountFen(input.grantId);
}

type ApplePaidMoney = {
  currency: string;
  currencyLabel: string;
  milliunits: number;
  /** CNY fen; 0 when the receipt is not RMB. */
  amountFen: number;
  amountYuan: string;
  amountDisplay: string;
  discounted: boolean;
};

function describeApplePaid(input: {
  grantId: string;
  diamondsGranted: number;
  priceMilliunits?: number | null;
  currency?: string | null;
  offerType?: number | null;
}): ApplePaidMoney {
  const catalogFen = appleCatalogAmountFen(input.grantId);
  const hasReceiptPrice =
    input.priceMilliunits != null &&
    Number.isFinite(Number(input.priceMilliunits));
  const milliunits = hasReceiptPrice
    ? Math.max(0, Number(input.priceMilliunits))
    : applePaidAmountFen({
        grantId: input.grantId,
        diamondsGranted: input.diamondsGranted,
        priceMilliunits: null,
      }) * 10;
  const currency = inferAppleCurrency(
    input.currency,
    hasReceiptPrice ? milliunits : null,
  );
  const amountFen = currency === "CNY" ? appleMilliunitsToFen(milliunits) : 0;
  const amountYuan =
    currency === "CNY"
      ? (amountFen / 100).toFixed(2)
      : (milliunits / 1000).toFixed(2);
  const discounted =
    isAppleOfferType(input.offerType) ||
    (currency === "CNY" && amountFen < catalogFen);
  return {
    currency,
    currencyLabel: appleCurrencyLabel(currency),
    milliunits,
    amountFen,
    amountYuan,
    amountDisplay: formatAppleMoney(milliunits, currency),
    discounted,
  };
}

function formatApplePaidDisplay(
  paidFen: number,
  foreignMilliunits: Record<string, number>,
): string {
  const parts: string[] = [];
  const foreignEntries = Object.entries(foreignMilliunits).filter(
    ([, milli]) => milli > 0,
  );
  if (paidFen > 0 || foreignEntries.length === 0) {
    parts.push(`¥${(paidFen / 100).toFixed(2)}`);
  }
  for (const [currency, milli] of foreignEntries) {
    parts.push(formatAppleMoney(milli, currency));
  }
  return parts.join(" + ");
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function mapAdminAppleOrder(row: Row): AdminAppleOrder {
  const grantId = row.grant_id;
  const diamondsGranted = Number(row.diamonds_granted ?? 0);
  const catalogAmountFen = appleCatalogAmountFen(grantId);
  const offerType =
    row.offer_type == null ? null : Number(row.offer_type);
  const paid = describeApplePaid({
    grantId,
    diamondsGranted,
    priceMilliunits: row.price_milliunits,
    currency: row.currency,
    offerType,
  });
  const product = getAppleProduct(row.product_id);
  const diamondsRefunded = Number(row.diamonds_refunded ?? 0);
  return {
    transactionId: row.transaction_id,
    originalTransactionId: row.original_transaction_id,
    userId: Number(row.user_id),
    username: row.username ?? null,
    nickname: row.nickname ?? null,
    productId: row.product_id,
    kind: row.kind,
    grantId,
    planTitle: appleGrantTitle(grantId),
    billing: product?.billing ?? null,
    environment: row.environment,
    amountFen: paid.amountFen,
    amountYuan: paid.amountYuan,
    amountDisplay: paid.amountDisplay,
    currency: paid.currency,
    currencyLabel: paid.currencyLabel,
    catalogAmountFen,
    catalogAmountYuan: (catalogAmountFen / 100).toFixed(2),
    discounted: paid.discounted,
    offerType: offerType != null && Number.isFinite(offerType) ? offerType : null,
    status: diamondsRefunded > 0 ? "refunded" : "paid",
    diamondsGranted,
    diamondsRefunded,
    createdAt: toIso(row.created_at) ?? String(row.created_at ?? ""),
  };
}

function buildAppleOrderFilters(options: {
  status?: AppleOrderStatus;
  kind?: AppleTxKind;
  q?: string;
  promoterId?: number;
}): { whereSql: string; params: Record<string, string | number> } {
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};

  if (options.promoterId != null) {
    clauses.push("u.promoter_id = :promoterId");
    params.promoterId = options.promoterId;
  }

  if (options.status === "paid") {
    clauses.push("t.diamonds_refunded = 0");
  } else if (options.status === "refunded") {
    clauses.push("t.diamonds_refunded > 0");
  }

  if (options.kind) {
    clauses.push("t.kind = :kind");
    params.kind = options.kind;
  }

  const q = options.q?.trim();
  if (q) {
    params.qLike = `%${q}%`;
    const userId = Number(q);
    if (Number.isInteger(userId) && userId > 0) {
      params.qUserId = userId;
      clauses.push(
        `(t.transaction_id LIKE :qLike
          OR t.original_transaction_id LIKE :qLike
          OR t.product_id LIKE :qLike
          OR t.grant_id LIKE :qLike
          OR u.username LIKE :qLike
          OR u.nickname LIKE :qLike
          OR t.user_id = :qUserId)`,
      );
    } else {
      clauses.push(
        `(t.transaction_id LIKE :qLike
          OR t.original_transaction_id LIKE :qLike
          OR t.product_id LIKE :qLike
          OR t.grant_id LIKE :qLike
          OR u.username LIKE :qLike
          OR u.nickname LIKE :qLike)`,
      );
    }
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

async function listAppleOrdersWithFilters(
  filterOptions: {
    status?: AppleOrderStatus;
    kind?: AppleTxKind;
    q?: string;
    promoterId?: number;
  },
  pageOptions?: {
    page?: number;
    pageSize?: number;
  },
): Promise<AdminAppleOrderListResult> {
  await ensureAppleTransactionsTable();
  const page = Math.max(Math.floor(pageOptions?.page ?? 1), 1);
  const pageSize = Math.min(
    Math.max(Math.floor(pageOptions?.pageSize ?? 20), 1),
    100,
  );
  const offset = (page - 1) * pageSize;
  const { whereSql, params } = buildAppleOrderFilters(filterOptions);

  const countRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
     FROM apple_transactions t
     LEFT JOIN users u ON u.id = t.user_id
     ${whereSql}`,
    params,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const summaryRows = await query<
    (RowDataPacket & {
      paid_count: number;
      refunded_count: number;
    })[]
  >(
    `SELECT
       SUM(t.diamonds_refunded = 0) AS paid_count,
       SUM(t.diamonds_refunded > 0) AS refunded_count
     FROM apple_transactions t
     LEFT JOIN users u ON u.id = t.user_id
     ${whereSql}`,
    params,
  );
  const summaryRow = summaryRows[0];

  let paidFen = 0;
  const foreignMilliunits: Record<string, number> = {};
  if (filterOptions.status !== "refunded") {
    const paidFilters = buildAppleOrderFilters({
      ...filterOptions,
      status: "paid",
    });
    const grantRows = await query<
      (RowDataPacket & {
        grant_id: string;
        diamonds_granted: number;
        price_milliunits: number | null;
        currency: string | null;
        offer_type: number | null;
        cnt: number;
      })[]
    >(
      `SELECT t.grant_id, t.diamonds_granted, t.price_milliunits, t.currency,
              t.offer_type, COUNT(*) AS cnt
       FROM apple_transactions t
       LEFT JOIN users u ON u.id = t.user_id
       ${paidFilters.whereSql}
       GROUP BY t.grant_id, t.diamonds_granted, t.price_milliunits, t.currency,
                t.offer_type`,
      paidFilters.params,
    );
    for (const row of grantRows) {
      const cnt = Number(row.cnt ?? 0);
      const paid = describeApplePaid({
        grantId: row.grant_id,
        diamondsGranted: Number(row.diamonds_granted ?? 0),
        priceMilliunits: row.price_milliunits,
        currency: row.currency,
        offerType: row.offer_type == null ? null : Number(row.offer_type),
      });
      if (paid.currency === "CNY") {
        paidFen += cnt * paid.amountFen;
      } else {
        foreignMilliunits[paid.currency] =
          (foreignMilliunits[paid.currency] ?? 0) + cnt * paid.milliunits;
      }
    }
  }

  const rows = await query<Row[]>(
    `SELECT t.transaction_id, t.original_transaction_id, t.user_id, t.product_id,
            t.kind, t.grant_id, t.environment, t.diamonds_granted,
            t.diamonds_refunded, t.price_milliunits, t.offer_type, t.currency,
            t.created_at, u.username, u.nickname
     FROM apple_transactions t
     LEFT JOIN users u ON u.id = t.user_id
     ${whereSql}
     ORDER BY t.created_at DESC, t.transaction_id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );

  return {
    orders: rows.map(mapAdminAppleOrder),
    total,
    page,
    pageSize,
    summary: {
      total,
      paidCount: Number(summaryRow?.paid_count ?? 0),
      refundedCount: Number(summaryRow?.refunded_count ?? 0),
      paidFen,
      paidDisplay: formatApplePaidDisplay(paidFen, foreignMilliunits),
    },
  };
}

export async function listAdminAppleOrders(options?: {
  status?: AppleOrderStatus;
  kind?: AppleTxKind;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminAppleOrderListResult> {
  return listAppleOrdersWithFilters(
    { status: options?.status, kind: options?.kind, q: options?.q },
    { page: options?.page, pageSize: options?.pageSize },
  );
}

export async function listPromoterAppleOrders(
  promoterId: number,
  options?: {
    status?: AppleOrderStatus;
    kind?: AppleTxKind;
    q?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<AdminAppleOrderListResult> {
  return listAppleOrdersWithFilters(
    {
      status: options?.status,
      kind: options?.kind,
      q: options?.q,
      promoterId,
    },
    { page: options?.page, pageSize: options?.pageSize },
  );
}
