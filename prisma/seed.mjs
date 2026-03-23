// Seed script for SQLite database
// Uses dynamic import for Prisma 7 ESM client

const prismaModule = await import("../src/generated/prisma/client.ts").catch(async () => {
  // Fallback: try direct CJS require via node resolution
  return await import("../src/generated/prisma/internal/client.js").catch(() => null);
});

// Try another approach - use the lib/db/prisma module approach
import { pathToFileURL } from "url";
import { resolve } from "path";
import { existsSync } from "fs";
import Database from "better-sqlite3";

// Direct SQLite approach since Prisma client import is tricky in seed scripts
const dbPath = resolve(import.meta.dirname, "..", "dev.db");
if (!existsSync(dbPath)) {
  console.error("❌ Database not found at", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
const bcryptModule = await import("bcryptjs");
const bcrypt = bcryptModule.default;

// Create test user
const passwordHash = await bcrypt.hash("test1234", 10);
const userId = "test-user-001";

db.prepare(`INSERT OR IGNORE INTO User (id, email, name, passwordHash, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).run(
  userId, "test@iautoapply.com", "Test User", passwordHash
);
console.log("✅ Test user: test@iautoapply.com / test1234");

// Fetch real jobs
const RAPIDAPI_KEY = "5b33da7f0emsh6f347551b360da6p1ac762jsn640fc9165a54";

const insertJob = db.prepare(`INSERT OR IGNORE INTO Job
  (id, externalId, source, title, company, companyLogo, location, remote, jobType, description, salaryMin, salaryMax, salaryCurrency, skills, applyUrl, postedAt, scrapedAt, isActive)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)`);

function cuid() {
  return "c" + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function extractSkills(desc) {
  const keywords = [
    "JavaScript", "TypeScript", "Python", "React", "Node.js", "SQL",
    "Excel", "Word", "PowerPoint", "Customer Service", "Data Entry",
    "Communication", "Problem Solving", "Microsoft Office", "Google Suite",
    "Salesforce", "CRM", "ERP", "SAP", "Oracle", "AWS", "Azure",
    "Project Management", "Agile", "Scrum", "Leadership", "Teamwork",
    "Time Management", "Attention to Detail", "Organization",
    "Phone Support", "Email Support", "Chat Support", "Billing",
    "Scheduling", "Filing", "Typing", "Multitasking",
  ];
  return keywords.filter((s) => (desc || "").toLowerCase().includes(s.toLowerCase()));
}

function mapJobType(type) {
  if (!type) return "FULL_TIME";
  const t = type.toUpperCase();
  if (t.includes("FULL")) return "FULL_TIME";
  if (t.includes("PART")) return "PART_TIME";
  if (t.includes("CONTRACT")) return "CONTRACT";
  if (t.includes("INTERN")) return "INTERNSHIP";
  return "FULL_TIME";
}

// JSearch API
console.log("🔍 Fetching jobs from JSearch...");
const queries = ["customer service", "data entry", "administrative assistant", "remote jobs"];
let totalJobs = 0;

for (const q of queries) {
  try {
    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=2&country=us&date_posted=week`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "jsearch.p.rapidapi.com",
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
      }
    );
    const data = await res.json();
    const jobs = data.data || [];

    for (const job of jobs) {
      const externalId = job.job_id || `jsearch-${Date.now()}-${Math.random()}`;
      const location = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ");
      try {
        insertJob.run(
          cuid(),
          externalId,
          "JSEARCH",
          job.job_title || "Unknown",
          job.employer_name || "Unknown",
          job.employer_logo || null,
          location || null,
          job.job_is_remote ? 1 : 0,
          mapJobType(job.job_employment_type),
          (job.job_description || "No description").substring(0, 5000),
          job.job_min_salary ? Math.round(job.job_min_salary) : null,
          job.job_max_salary ? Math.round(job.job_max_salary) : null,
          job.job_salary_currency || "USD",
          JSON.stringify(extractSkills(job.job_description || "")),
          job.job_apply_link || null,
          job.job_posted_at_datetime_utc || new Date().toISOString(),
        );
        totalJobs++;
      } catch (e) { /* skip duplicates */ }
    }
    console.log(`   Found ${jobs.length} jobs for "${q}"`);
    await new Promise((r) => setTimeout(r, 1000));
  } catch (e) {
    console.error(`   Failed for "${q}":`, e.message);
  }
}
console.log(`✅ JSearch jobs saved: ${totalJobs}`);

// Remote Jobs API
console.log("🔍 Fetching remote jobs...");
try {
  const res = await fetch(
    "https://remote-jobs1.p.rapidapi.com/jobs?country=us&employment_type=fulltime&limit=50",
    {
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": "remote-jobs1.p.rapidapi.com",
        "x-rapidapi-key": RAPIDAPI_KEY,
      },
    }
  );
  const data = await res.json();
  const jobs = data.jobs || data || [];
  let count = 0;

  for (const job of (Array.isArray(jobs) ? jobs : [])) {
    const externalId = (job.id || `remote-${Date.now()}-${Math.random()}`).toString();
    try {
      insertJob.run(
        cuid(),
        externalId,
        "REMOTEOK",
        job.title || job.job_title || "Unknown",
        job.company || job.company_name || "Unknown",
        job.company_logo || null,
        job.location || "Remote",
        1,
        "FULL_TIME",
        (job.description || job.job_description || "No description").substring(0, 5000),
        null, null, "USD",
        JSON.stringify(extractSkills(job.description || "")),
        job.url || job.apply_url || null,
        job.date_posted || new Date().toISOString(),
      );
      count++;
    } catch (e) { /* skip */ }
  }
  console.log(`✅ Remote jobs saved: ${count}`);
} catch (e) {
  console.error("❌ Remote jobs fetch failed:", e.message);
}

const total = db.prepare("SELECT COUNT(*) as count FROM Job").get();
console.log(`\n🎉 Database seeded! Total jobs: ${total.count}`);

db.close();
