// Use the custom output path from prisma schema
const { PrismaClient } = require("../src/generated/prisma") as { PrismaClient: any };
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create test user
  const passwordHash = await bcrypt.hash("test1234", 10);
  const user = await prisma.user.upsert({
    where: { email: "test@iautoapply.com" },
    update: {},
    create: {
      email: "test@iautoapply.com",
      name: "Test User",
      passwordHash,
    },
  });
  console.log("✅ Test user created:", user.email);
  console.log("   Login: test@iautoapply.com / test1234");

  // Fetch real jobs from RapidAPI
  const RAPIDAPI_KEY = "5b33da7f0emsh6f347551b360da6p1ac762jsn640fc9165a54";

  // Fetch from JSearch
  console.log("🔍 Fetching jobs from JSearch...");
  try {
    const queries = ["customer service", "data entry", "administrative assistant", "remote jobs"];
    let totalJobs = 0;

    for (const q of queries) {
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
        try {
          await prisma.job.upsert({
            where: { externalId_source: { externalId, source: "JSEARCH" } },
            update: {},
            create: {
              externalId,
              source: "JSEARCH",
              title: job.job_title || "Unknown",
              company: job.employer_name || "Unknown",
              companyLogo: job.employer_logo || null,
              location: [job.job_city, job.job_state, job.job_country]
                .filter(Boolean)
                .join(", ") || null,
              remote: job.job_is_remote || false,
              jobType: mapJobType(job.job_employment_type),
              description: job.job_description?.substring(0, 5000) || "No description",
              salaryMin: job.job_min_salary ? Math.round(job.job_min_salary) : null,
              salaryMax: job.job_max_salary ? Math.round(job.job_max_salary) : null,
              salaryCurrency: job.job_salary_currency || "USD",
              skills: JSON.stringify(extractSkills(job.job_description || "")),
              applyUrl: job.job_apply_link || null,
              postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : new Date(),
              isActive: true,
            },
          });
          totalJobs++;
        } catch (e) {
          // skip duplicates
        }
      }
      console.log(`   Found ${jobs.length} jobs for "${q}"`);
      // Rate limit
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`✅ Total JSearch jobs saved: ${totalJobs}`);
  } catch (e) {
    console.error("❌ JSearch fetch failed:", e);
  }

  // Fetch from Remote Jobs API
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
      const externalId = job.id?.toString() || `remote-${Date.now()}-${Math.random()}`;
      try {
        await prisma.job.upsert({
          where: { externalId_source: { externalId, source: "REMOTEOK" } },
          update: {},
          create: {
            externalId,
            source: "REMOTEOK",
            title: job.title || job.job_title || "Unknown",
            company: job.company || job.company_name || "Unknown",
            companyLogo: job.company_logo || null,
            location: job.location || "Remote",
            remote: true,
            jobType: "FULL_TIME",
            description: (job.description || job.job_description || "No description").substring(0, 5000),
            skills: JSON.stringify(extractSkills(job.description || job.job_description || "")),
            applyUrl: job.url || job.apply_url || null,
            postedAt: job.date_posted ? new Date(job.date_posted) : new Date(),
            isActive: true,
          },
        });
        count++;
      } catch (e) {
        // skip
      }
    }
    console.log(`✅ Remote jobs saved: ${count}`);
  } catch (e) {
    console.error("❌ Remote jobs fetch failed:", e);
  }

  const totalJobs = await prisma.job.count();
  console.log(`\n🎉 Database seeded! Total jobs: ${totalJobs}`);
}

function mapJobType(type?: string): string {
  if (!type) return "FULL_TIME";
  const t = type.toUpperCase();
  if (t.includes("FULL")) return "FULL_TIME";
  if (t.includes("PART")) return "PART_TIME";
  if (t.includes("CONTRACT") || t.includes("CONTRACTOR")) return "CONTRACT";
  if (t.includes("INTERN")) return "INTERNSHIP";
  return "FULL_TIME";
}

function extractSkills(desc: string): string[] {
  const skillKeywords = [
    "JavaScript", "TypeScript", "Python", "React", "Node.js", "SQL",
    "Excel", "Word", "PowerPoint", "Customer Service", "Data Entry",
    "Communication", "Problem Solving", "Microsoft Office", "Google Suite",
    "Salesforce", "CRM", "ERP", "SAP", "Oracle", "AWS", "Azure",
    "Project Management", "Agile", "Scrum", "Leadership", "Teamwork",
    "Time Management", "Attention to Detail", "Organization",
    "Phone Support", "Email Support", "Chat Support", "Billing",
    "Scheduling", "Filing", "Typing", "Multitasking",
  ];
  return skillKeywords.filter((s) =>
    desc.toLowerCase().includes(s.toLowerCase())
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
