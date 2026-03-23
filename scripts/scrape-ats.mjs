import Database from "better-sqlite3";
import { resolve } from "path";

const db = new Database(resolve(process.cwd(), "dev.db"));

const RAPIDAPI_KEY = "5b33da7f0emsh6f347551b360da6p1ac762jsn640fc9165a54";
const queries = ["patient access", "customer service", "healthcare", "insurance verification", "receptionist"];

async function scrapeATS() {
  for (const query of queries) {
    console.log("Scraping:", query);
    try {
      const params = new URLSearchParams({
        description_type: "text",
        page_size: "50",
        title_filter: `"${query}"`,
      });

      const res = await fetch(
        `https://job-posting-feed-api.p.rapidapi.com/active-ats-6m?${params.toString()}`,
        {
          headers: {
            "x-rapidapi-host": "job-posting-feed-api.p.rapidapi.com",
            "x-rapidapi-key": RAPIDAPI_KEY,
          },
        }
      );

      if (!res.ok) {
        console.log("  API error:", res.status);
        continue;
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        console.log("  Not array response");
        continue;
      }

      let added = 0;
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO Job (id, externalId, source, title, company, companyLogo, location, remote, jobType, description, applyUrl, postedAt, isActive, scrapedAt, skills, salaryCurrency)
        VALUES (lower(hex(randomblob(12))), ?, 'ACTIVEJOBS', ?, ?, ?, ?, ?, 'FULL_TIME', ?, ?, ?, 1, datetime('now'), '[]', 'USD')
      `);

      for (const job of data) {
        if (!job.title || !job.organization || !job.url) continue;
        const externalId = `activejobs-${job.id}`;
        const location =
          (job.locations_derived && job.locations_derived[0]) ||
          (job.cities_derived && job.cities_derived[0]) ||
          null;

        try {
          stmt.run(
            externalId,
            job.title,
            job.organization,
            job.organization_logo || null,
            location,
            job.remote_derived ? 1 : 0,
            (job.description_text || "No description").substring(0, 5000),
            job.url,
            job.date_posted || null
          );
          added++;
        } catch (e) {
          // duplicate, skip
        }
      }
      console.log(`  Added ${added} jobs from ${data.length} results`);
    } catch (e) {
      console.error("  Error:", e.message);
    }
  }

  // Check ATS URLs
  const atsDomains = [
    "greenhouse.io", "lever.co", "myworkdayjobs.com", "workday.com",
    "smartrecruiters.com", "icims.com", "paylocity.com",
  ];
  const allNew = db.prepare("SELECT applyUrl, title, company FROM Job WHERE source = 'ACTIVEJOBS' AND isActive = 1").all();
  const atsNew = allNew.filter((j) =>
    atsDomains.some((d) => (j.applyUrl || "").includes(d))
  );
  console.log(`\nTotal ACTIVEJOBS: ${allNew.length} | With direct ATS URL: ${atsNew.length}`);
  atsNew.slice(0, 10).forEach((j) =>
    console.log(`  ${j.title} @ ${j.company} -> ${j.applyUrl.substring(0, 80)}`)
  );
}

scrapeATS().then(() => {
  db.close();
  console.log("\nDone!");
});
