/**
 * Seeds the production database with jobs specifically from ATS platforms
 * (Greenhouse, Lever, Workday) using the active-ats-6m endpoint.
 * These are jobs we can reliably auto-apply to.
 */
import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_EqtTCd2m8xzL@ep-soft-sea-ani0ci91-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const RAPIDAPI_KEY = "5b33da7f0emsh6f347551b360da6p1ac762jsn640fc9165a54";

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();
console.log("Connected to Neon PostgreSQL");

const queries = [
  "customer service",
  "patient access",
  "healthcare",
  "insurance verification",
  "receptionist",
  "data entry",
  "administrative assistant",
  "call center",
  "medical billing",
  "customer support",
  "help desk",
];

const ATS_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
  "workday.com",
  "smartrecruiters.com",
  "icims.com",
];

let totalAdded = 0;
let totalATS = 0;

for (const query of queries) {
  console.log(`\nSearching ATS for: ${query}`);
  try {
    const params = new URLSearchParams({
      description_type: "text",
      page_size: "100",
      title_filter: `"${query}"`,
    });

    const res = await fetch(
      `https://job-posting-feed-api.p.rapidapi.com/active-ats-6m?${params}`,
      {
        headers: {
          "x-rapidapi-host": "job-posting-feed-api.p.rapidapi.com",
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
      }
    );

    if (!res.ok) {
      console.log(`  API error: ${res.status}`);
      continue;
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      console.log("  Unexpected response shape");
      continue;
    }

    const atsJobs = data.filter((j) => {
      const url = (j.url || "").toLowerCase();
      return ATS_DOMAINS.some((d) => url.includes(d));
    });

    console.log(`  Got ${data.length} jobs, ${atsJobs.length} on supported ATS`);

    for (const j of atsJobs) {
      if (!j.title || !j.organization || !j.url) continue;

      const id = "c" + Math.random().toString(36).substring(2, 26);
      const externalId = `ats-${j.id}`;
      const location =
        (j.locations_derived && j.locations_derived[0]) ||
        (j.cities_derived && j.cities_derived[0]) ||
        null;
      const desc = (j.description_text || "No description").substring(0, 5000);

      try {
        const insertResult = await client.query(
          `INSERT INTO "Job" (id, "externalId", source, title, company, "companyLogo", location, remote, "jobType", description, "applyUrl", "postedAt", skills, "isActive", "scrapedAt", "salaryCurrency")
           VALUES ($1, $2, 'ACTIVEJOBS', $3, $4, $5, $6, $7, 'FULL_TIME', $8, $9, $10, '[]', true, NOW(), 'USD')
           ON CONFLICT ("externalId", source) DO NOTHING
           RETURNING id`,
          [
            id,
            externalId,
            j.title,
            j.organization,
            j.organization_logo || null,
            location,
            j.remote_derived || false,
            desc,
            j.url,
            j.date_posted || new Date().toISOString(),
          ]
        );
        if (insertResult.rowCount > 0) {
          totalAdded++;
          totalATS++;
        }
      } catch (e) {
        // skip
      }
    }

    // Avoid hitting rate limits
    await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    console.error(`  Error: ${e.message}`);
  }
}

console.log(`\n========================================`);
console.log(`Total new jobs added: ${totalAdded}`);
console.log(`All from supported ATS: ${totalATS}`);

const countResult = await client.query(
  `SELECT COUNT(*) FROM "Job" WHERE "isActive" = true`
);
console.log(`Total active jobs in database: ${countResult.rows[0].count}`);

const atsCountResult = await client.query(`
  SELECT COUNT(*) FROM "Job"
  WHERE "isActive" = true
  AND ("applyUrl" LIKE '%greenhouse.io%'
    OR "applyUrl" LIKE '%lever.co%'
    OR "applyUrl" LIKE '%myworkdayjobs.com%'
    OR "applyUrl" LIKE '%workday.com%'
    OR "applyUrl" LIKE '%smartrecruiters.com%'
    OR "applyUrl" LIKE '%icims.com%')
`);
console.log(`ATS-supported jobs in database: ${atsCountResult.rows[0].count}`);

await client.end();
