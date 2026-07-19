/**
 * Grant 30 days VIP to all non-member users.
 *
 * Usage:
 *   node --env-file=.env.local scripts/grant-vip-non-members.mjs --dry-run
 *   node --env-file=.env.local scripts/grant-vip-non-members.mjs
 */

import mysql from "mysql2/promise";

const DAYS = 30;
const DRY_RUN = process.argv.includes("--dry-run");

const NON_MEMBER_WHERE = `
  (vip_expires_at IS NULL OR vip_expires_at < NOW())
  AND NOT (vip_expires_at IS NOT NULL AND YEAR(vip_expires_at) >= 9999)
`;

async function main() {
  const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    timezone: "+08:00",
  });

  try {
    const [targets] = await pool.query(
      `SELECT id, username, vip_expires_at
       FROM users
       WHERE ${NON_MEMBER_WHERE}
       ORDER BY id`,
    );

    const [vipCountRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM users
       WHERE vip_expires_at IS NOT NULL
         AND vip_expires_at > NOW()
         AND YEAR(vip_expires_at) < 9999`,
    );
    const [permanentCountRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM users
       WHERE vip_expires_at IS NOT NULL AND YEAR(vip_expires_at) >= 9999`,
    );

    console.log(`Non-members to grant: ${targets.length}`);
    console.log(`Active VIP (skipped): ${vipCountRows[0].c}`);
    console.log(`Permanent VIP (skipped): ${permanentCountRows[0].c}`);

    if (targets.length === 0) {
      console.log("Nothing to update.");
      return;
    }

    const preview = targets.slice(0, 20).map((u) => ({
      id: u.id,
      username: u.username,
      vip_expires_at: u.vip_expires_at,
    }));
    console.log("Preview (up to 20):");
    console.table(preview);

    if (DRY_RUN) {
      console.log("Dry run only — no changes written.");
      return;
    }

    const [result] = await pool.query(
      `UPDATE users
       SET vip_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
       WHERE ${NON_MEMBER_WHERE}`,
      [DAYS],
    );

    console.log(`Updated ${result.affectedRows} users with +${DAYS} days VIP.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
