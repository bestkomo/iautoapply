/**
 * Grants lifetime ENTERPRISE (admin) access to specified users.
 * This creates/updates a Subscription record with plan=ENTERPRISE
 * and a far-future expiration, so canAutoApply() returns true with
 * the highest limits (200/day).
 */
import pg from "pg";
import { randomBytes } from "crypto";

const { Client } = pg;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_EqtTCd2m8xzL@ep-soft-sea-ani0ci91-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Emails to grant admin access to
const ADMIN_EMAILS = [
  "test@iautoaply.com",
  "pskomo123@gmail.com",
  "johnnyjnr474@gmail.com",
  "Oladelekomolafe5@gmail.com",
  "komolafetemitop@gmail.com",
];

function cuid() {
  return "c" + randomBytes(12).toString("hex");
}

const c = new Client({ connectionString: DATABASE_URL });
await c.connect();
console.log("Connected to Neon");

// Set expiration to Jan 1, 2099 (effectively lifetime)
const farFuture = new Date("2099-01-01T00:00:00Z");

for (const email of ADMIN_EMAILS) {
  const userRes = await c.query(
    'SELECT id, name FROM "User" WHERE LOWER(email) = LOWER($1)',
    [email]
  );

  if (userRes.rows.length === 0) {
    console.log(`  ⚠ User not found: ${email}`);
    continue;
  }

  const userId = userRes.rows[0].id;
  const name = userRes.rows[0].name || email;

  // Check if subscription exists
  const existing = await c.query(
    'SELECT id FROM "Subscription" WHERE "userId" = $1',
    [userId]
  );

  if (existing.rows.length > 0) {
    // Update existing to ENTERPRISE
    await c.query(
      `UPDATE "Subscription"
         SET plan = 'ENTERPRISE',
             "currentPeriodEnd" = $1
       WHERE "userId" = $2`,
      [farFuture, userId]
    );
    console.log(`  ✅ Upgraded to ENTERPRISE (lifetime): ${email} (${name})`);
  } else {
    // Create new
    await c.query(
      `INSERT INTO "Subscription" (id, "userId", plan, "currentPeriodEnd", "createdAt")
       VALUES ($1, $2, 'ENTERPRISE', $3, NOW())`,
      [cuid(), userId, farFuture]
    );
    console.log(`  ✅ Granted ENTERPRISE (lifetime): ${email} (${name})`);
  }

  // Also make sure their JobPreference allows high daily cap
  await c.query(
    `UPDATE "JobPreference"
       SET "maxAutoApplyDay" = 200
     WHERE "userId" = $1`,
    [userId]
  );
}

// Show final status
console.log("\n=== Admin Accounts ===");
const result = await c.query(`
  SELECT u.email, u.name, s.plan, s."currentPeriodEnd", jp."maxAutoApplyDay"
  FROM "User" u
  LEFT JOIN "Subscription" s ON s."userId" = u.id
  LEFT JOIN "JobPreference" jp ON jp."userId" = u.id
  WHERE s.plan = 'ENTERPRISE'
  ORDER BY u.email
`);
for (const row of result.rows) {
  console.log(`  ${row.email.padEnd(32)} | ${row.plan} | exp: ${row.currentPeriodEnd?.toISOString().substring(0, 10)} | ${row.maxAutoApplyDay}/day`);
}

await c.end();
console.log("\nDone!");
