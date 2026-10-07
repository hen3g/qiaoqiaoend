/**
 * Backfill users.is_paid_vip + users.paid_vip_expires_at from payment history.
 *
 * Replays, per user and in time order, every successful non-refunded paid
 * membership purchase (same rules as the live code in src/lib/paid-vip.ts):
 *   - Alipay   payment_orders  status='paid', VIP plan       → stack plan days
 *   - Apple    apple_transactions kind='vip', Production, not refunded
 *       one-time (consumable) SKU                              → stack plan days
 *       auto-renewable SKU → paid end ≥ created_at + plan days (no stacking;
 *       Apple's real expiresDate is not stored, so this is an approximation)
 *   - Google   google_transactions kind='vip', environment <> 'Test' → stack
 * "Stack" = new end = max(event time, current paid end) + plan days.
 * Gift sources (爱吃 promo, redeem / promoter / gift codes, promo rewards,
 * scripts) are never counted.
 *
 * Dry-run is the default (read-only transaction, no writes):
 *   node --env-file=.env.local scripts/backfill-paid-vip.mjs
 * Apply (adds the columns if missing, then writes):
 *   node --env-file=.env.local scripts/backfill-paid-vip.mjs --apply
 *
 * Apply is idempotent and merges with live data: is_paid_vip = 1 and
 * paid_vip_expires_at = the later of the stored value and the computed one.
 * Users without a qualifying purchase are not touched.
 */

import mysql from "mysql2/promise";

const APPLY = process.argv.includes("--apply");

/** Mirrors VIP_PLANS days in src/lib/vip.ts. */
const PLAN_DAYS = {
  month6: 31,
  month: 31,
  quarter: 92,
  year: 365,
  quarter18: 92,
  year38: 365,
};

/** Auto-renewable Apple SKUs (mirrors billing in src/lib/apple-products.ts). */
const APPLE_SUBSCRIPTION_SKUS = new Set([
  "com.yancitech.qiaoqiaoenglish.vip.month6",
  "com.yancitech.qiaoqiaoenglish.vip.month",
  "com.yancitech.qiaoqiaoenglish.vip.quarter",
  "com.yancitech.qiaoqiaoenglish.vip.year",
  "com.yancitech.cangshuword.vip.month6",
]);

const DAY_MS = 86_400_000;

const required = [
  "DATABASE_HOST",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
  "DATABASE_NAME",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing env: ${key}`);
}

function fmt(ms) {
  return new Date(ms).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

async function hasColumn(conn, name) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM users LIKE ?`, [name]);
  return rows.length > 0;
}

async function ensureColumns(conn) {
  if (!(await hasColumn(conn, "is_paid_vip"))) {
    await conn.query(
      `ALTER TABLE users
       ADD COLUMN is_paid_vip TINYINT(1) NOT NULL DEFAULT 0 AFTER vip_expires_at`,
    );
    console.log("Added column users.is_paid_vip");
  }
  if (!(await hasColumn(conn, "paid_vip_expires_at"))) {
    await conn.query(
      `ALTER TABLE users
       ADD COLUMN paid_vip_expires_at DATETIME NULL AFTER is_paid_vip`,
    );
    console.log("Added column users.paid_vip_expires_at");
  }
}

async function loadEvents(conn) {
  const planIds = Object.keys(PLAN_DAYS);
  const events = [];

  const [pay] = await conn.query(
    `SELECT o.user_id, o.plan_id, o.paid_at, o.created_at
     FROM payment_orders o
     INNER JOIN users u ON u.id = o.user_id
     WHERE o.status = 'paid' AND o.plan_id IN (?)`,
    [planIds],
  );
  for (const r of pay) {
    events.push({
      userId: Number(r.user_id),
      at: new Date(r.paid_at || r.created_at).getTime(),
      days: PLAN_DAYS[r.plan_id] || 0,
      subscription: false,
      source: "alipay",
    });
  }

  const [apple] = await conn.query(
    `SELECT a.user_id, a.product_id, a.grant_id, a.created_at
     FROM apple_transactions a
     INNER JOIN users u ON u.id = a.user_id
     WHERE a.kind = 'vip'
       AND a.environment = 'Production'
       AND a.refunded_at IS NULL
       AND a.diamonds_refunded = 0`,
  );
  for (const r of apple) {
    events.push({
      userId: Number(r.user_id),
      at: new Date(r.created_at).getTime(),
      days: PLAN_DAYS[r.grant_id] || 0,
      subscription: APPLE_SUBSCRIPTION_SKUS.has(r.product_id),
      source: "apple",
    });
  }

  const [googleTable] = await conn.query(`SHOW TABLES LIKE 'google_transactions'`);
  if (googleTable.length > 0) {
    const [google] = await conn.query(
      `SELECT g.user_id, g.grant_id, g.created_at
       FROM google_transactions g
       INNER JOIN users u ON u.id = g.user_id
       WHERE g.kind = 'vip' AND g.environment <> 'Test'`,
    );
    for (const r of google) {
      events.push({
        userId: Number(r.user_id),
        at: new Date(r.created_at).getTime(),
        days: PLAN_DAYS[r.grant_id] || 0,
        subscription: false,
        source: "google",
      });
    }
  }

  return events.filter((e) => e.days > 0 && Number.isFinite(e.at));
}

function replay(events) {
  const byUser = new Map();
  events.sort((a, b) => a.at - b.at);
  for (const e of events) {
    const cur = byUser.get(e.userId) ?? 0;
    const add = e.days * DAY_MS;
    byUser.set(
      e.userId,
      e.subscription ? Math.max(cur, e.at + add) : Math.max(cur, e.at) + add,
    );
  }
  return byUser;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    timezone: "+08:00",
  });

  try {
    console.log(APPLY ? "Mode: APPLY (will write)" : "Mode: DRY-RUN (read-only)");

    if (!APPLY) {
      await conn.query("SET SESSION TRANSACTION READ ONLY");
      await conn.query("START TRANSACTION READ ONLY");
    }

    const events = await loadEvents(conn);
    const bySource = events.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {});
    const paid = replay(events);
    const now = Date.now();
    const active = [...paid.values()].filter((ms) => ms > now).length;

    console.log("Qualifying paid membership events:", bySource);
    console.log(`Users → is_paid_vip = 1:              ${paid.size}`);
    console.log(`Users → paid_vip_expires_at > now:    ${active}`);
    console.log(`Users → paid time already ended:      ${paid.size - active}`);

    const examples = [...paid.entries()].sort((a, b) => a[0] - b[0]);
    const sample = [
      ...examples.filter(([, ms]) => ms > now).slice(0, 4),
      ...examples.filter(([, ms]) => ms <= now).slice(0, 2),
    ];
    console.log("Examples (user id → computed paid expiry, Asia/Shanghai):");
    for (const [userId, ms] of sample) {
      console.log(`  #${userId} → ${fmt(ms)}${ms > now ? "" : " (ended)"}`);
    }

    if (!APPLY) {
      await conn.query("ROLLBACK");
      console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    await ensureColumns(conn);
    await conn.beginTransaction();
    let updated = 0;
    for (const [userId, ms] of paid) {
      const expiresAt = new Date(ms);
      const [res] = await conn.query(
        `UPDATE users
         SET is_paid_vip = 1,
             paid_vip_expires_at = GREATEST(COALESCE(paid_vip_expires_at, ?), ?)
         WHERE id = ?`,
        [expiresAt, expiresAt, userId],
      );
      updated += res.affectedRows || 0;
    }
    await conn.commit();
    console.log(`Applied. Rows matched: ${updated}`);
  } catch (err) {
    try {
      await conn.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("ERR", err?.code || "", err?.message || err);
  process.exit(1);
});
