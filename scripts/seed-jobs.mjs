import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Use pg directly since Prisma generated client has ESM issues
import pg from "pg";
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EqtTCd2m8xzL@ep-soft-sea-ani0ci91-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const RAPIDAPI_KEY = "5b33da7f0emsh6f347551b360da6p1ac762jsn640fc9165a54";

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();
console.log("Connected to Neon PostgreSQL");

const queries = [
  "customer service", "patient access", "healthcare",
  "insurance verification", "receptionist", "data entry",
  "administrative assistant", "call center", "medical billing",
  "customer support", "help desk", "front desk",
];

let totalAdded = 0;

for (const query of queries) {
  console.log("Searching:", query);
  try {
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query + " jobs in united states")}&page=1&num_pages=2&country=us&date_posted=week`;
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
        "x-rapidapi-key": RAPIDAPI_KEY,
      },
    });
    if (!res.ok) { console.log("  API error:", res.status); continue; }
    const data = await res.json();
    const jobs = data.data || [];
    console.log("  Found", jobs.length, "jobs");

    for (const j of jobs) {
      const id = "c" + Math.random().toString(36).substring(2, 26);
      const externalId = "jsearch-" + j.job_id;
      const location = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || null;
      const skills = JSON.stringify(j.job_required_skills || []);
      const desc = (j.job_description || "No description").substring(0, 5000);
      const postedAt = j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc).toISOString() : new Date().toISOString();

      try {
        await client.query(
          `INSERT INTO "Job" (id, "externalId", source, title, company, "companyLogo", location, remote, "jobType", description, "applyUrl", "postedAt", skills, "isActive", "scrapedAt", "salaryCurrency")
           VALUES ($1, $2, 'JSEARCH', $3, $4, $5, $6, $7, 'FULL_TIME', $8, $9, $10, $11, true, NOW(), 'USD')
           ON CONFLICT ("externalId", source) DO NOTHING`,
          [id, externalId, j.job_title, j.employer_name, j.employer_logo || null, location, j.job_is_remote || false, desc, j.job_apply_link || null, postedAt, skills]
        );
        totalAdded++;
      } catch (e) {
        // skip duplicates
      }
    }
  } catch (e) {
    console.error("  Error:", e.message);
  }
}

// Also seed from Active ATS API
const atsQueries = ["customer service", "patient access", "receptionist", "healthcare"];
for (const query of atsQueries) {
  console.log("ATS Searching:", query);
  try {
    const params = new URLSearchParams({ description_type: "text", page_size: "50", title_filter: `"${query}"` });
    const res = await fetch(`https://job-posting-feed-api.p.rapidapi.com/active-ats-6m?${params}`, {
      headers: {
        "x-rapidapi-host": "job-posting-feed-api.p.rapidapi.com",
        "x-rapidapi-key": RAPIDAPI_KEY,
      },
    });
    if (!res.ok) { console.log("  ATS API error:", res.status); continue; }
    const data = await res.json();
    if (!Array.isArray(data)) continue;
    console.log("  Found", data.length, "ATS jobs");

    for (const j of data) {
      if (!j.title || !j.organization || !j.url) continue;
      const id = "c" + Math.random().toString(36).substring(2, 26);
      const externalId = "ats-" + j.id;
      const location = (j.locations_derived && j.locations_derived[0]) || null;
      const desc = (j.description_text || "No description").substring(0, 5000);

      try {
        await client.query(
          `INSERT INTO "Job" (id, "externalId", source, title, company, "companyLogo", location, remote, "jobType", description, "applyUrl", "postedAt", skills, "isActive", "scrapedAt", "salaryCurrency")
           VALUES ($1, $2, 'ACTIVEJOBS', $3, $4, $5, $6, $7, 'FULL_TIME', $8, $9, $10, '[]', true, NOW(), 'USD')
           ON CONFLICT ("externalId", source) DO NOTHING`,
          [id, externalId, j.title, j.organization, j.organization_logo || null, location, j.remote_derived || false, desc, j.url, j.date_posted || new Date().toISOString()]
        );
        totalAdded++;
      } catch (e) {
        // skip
      }
    }
  } catch (e) {
    console.error("  ATS Error:", e.message);
  }
}

console.log("\nTotal jobs added:", totalAdded);

const countResult = await client.query('SELECT COUNT(*) FROM "Job"');
console.log("Total jobs in database:", countResult.rows[0].count);

await client.end();
