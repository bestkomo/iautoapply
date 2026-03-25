import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { toJsonArray } from "@/lib/db/json-array";
// Enums are stored as plain strings in SQLite
type JobSource = string;
type JobType = string;
import { BaseScraper, type RawJob } from "./base-scraper";
import { RemoteOKScraper } from "./remoteok";
import { ArbeitNowScraper } from "./arbeitnow";
import { JobicyScraper } from "./jobicy";
import { TheMuseScraper } from "./themuse";
import { RemotiveScraper } from "./remotive";
import { HimalayasScraper } from "./himalayas";
import { GreenhouseScraper } from "./greenhouse";
import { LeverScraper } from "./lever";
import { JSearchScraper } from "./jsearch";
import { ActiveJobsScraper } from "./activejobs";
import { RemoteJobsAPIScraper } from "./remote-jobs-api";
import { WorkdayScraper } from "./workday";

const JOB_TYPE_MAP: Record<string, JobType> = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACT",
  FREELANCE: "FREELANCE",
  INTERNSHIP: "INTERNSHIP",
};

const SOURCE_MAP: Record<string, JobSource> = {
  REMOTEOK: "REMOTEOK",
  ARBEITNOW: "ARBEITNOW",
  JOBICY: "JOBICY",
  INDEED: "INDEED",
  LINKEDIN: "LINKEDIN",
  GLASSDOOR: "GLASSDOOR",
  WEWORKREMOTELY: "WEWORKREMOTELY",
  GREENHOUSE: "GREENHOUSE",
  LEVER: "LEVER",
  THEMUSE: "THEMUSE",
  REMOTIVE: "REMOTIVE",
  HIMALAYAS: "HIMALAYAS",
  FINDWORK: "FINDWORK",
  JSEARCH: "JSEARCH",
  ACTIVEJOBS: "ACTIVEJOBS",
  REMOTEJOBS_API: "REMOTEJOBS_API",
  WORKDAY: "WORKDAY",
  MANUAL: "MANUAL",
};

export interface ScrapeResult {
  added: number;
  duplicates: number;
  errors: number;
  sources: string[];
  sourceErrors: string[];
}

export class ScraperManager {
  private scrapers: BaseScraper[];

  constructor() {
    this.scrapers = [
      new WorkdayScraper(), // Workday FIRST - direct healthcare company career sites
      new ActiveJobsScraper(), // Active Jobs DB - real ATS jobs from Workday, Greenhouse, Lever, Paylocity, SmartRecruiters
      new JSearchScraper(), // JSearch - aggregates Indeed, LinkedIn, Glassdoor, ZipRecruiter, Monster
      new RemoteJobsAPIScraper(), // Remote Jobs API - real ATS jobs with direct apply URLs
      new GreenhouseScraper(),
      new LeverScraper(),
      new RemoteOKScraper(),
      new ArbeitNowScraper(),
      new JobicyScraper(),
      new TheMuseScraper(),
      new RemotiveScraper(),
      new HimalayasScraper(),
    ];
  }

  async scrapeAll(
    query: string,
    location?: string
  ): Promise<ScrapeResult> {
    const results: ScrapeResult = {
      added: 0,
      duplicates: 0,
      errors: 0,
      sources: [],
      sourceErrors: [],
    };
    const seenHashes = new Set<string>();

    console.log(
      `[ScraperManager] Starting scrape for query="${query}" location="${location || "any"}"`
    );

    const scraperResults = await Promise.allSettled(
      this.scrapers.map((scraper) => scraper.scrape(query, location))
    );

    const allJobs: { job: RawJob; source: string }[] = [];

    for (let i = 0; i < scraperResults.length; i++) {
      const result = scraperResults[i];
      const scraperName = this.scrapers[i].source;

      if (result.status === "fulfilled") {
        const jobs = result.value;
        console.log(`[ScraperManager] ${scraperName}: fetched ${jobs.length} jobs`);

        if (jobs.length > 0) {
          results.sources.push(scraperName);
        }

        for (const job of jobs) {
          allJobs.push({ job, source: scraperName });
        }
      } else {
        console.error(
          `[ScraperManager] ${scraperName} failed:`,
          result.reason
        );
        results.sourceErrors.push(
          `${scraperName}: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`
        );
        results.errors++;
      }
    }

    // Deduplicate by title+company+location hash
    const uniqueJobs: { job: RawJob; source: string }[] = [];
    for (const entry of allJobs) {
      const hash = this.computeHash(entry.job);
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        uniqueJobs.push(entry);
      } else {
        results.duplicates++;
      }
    }

    console.log(
      `[ScraperManager] ${uniqueJobs.length} unique jobs to save (${results.duplicates} duplicates removed)`
    );

    // Save to database one at a time to avoid connection pool exhaustion
    for (const { job, source } of uniqueJobs) {
      try {
        await this.saveJob(job, source);
        results.added++;
      } catch (err) {
        // Retry once on connection error
        try {
          await new Promise((r) => setTimeout(r, 200));
          await this.saveJob(job, source);
          results.added++;
        } catch {
          results.errors++;
        }
      }
    }

    console.log(
      `[ScraperManager] Scrape complete: ${results.added} added, ${results.duplicates} duplicates, ${results.errors} errors`
    );

    return results;
  }

  private async saveJob(job: RawJob, source: string): Promise<void> {
    const sourceEnum = SOURCE_MAP[source] || "MANUAL";
    const jobTypeEnum = JOB_TYPE_MAP[job.jobType] || "FULL_TIME";

    await prisma.job.upsert({
      where: {
        externalId_source: {
          externalId: job.externalId,
          source: sourceEnum,
        },
      },
      update: {
        title: job.title,
        company: job.company,
        companyLogo: job.companyLogo,
        location: job.location,
        remote: job.remote,
        jobType: jobTypeEnum,
        description: job.description.slice(0, 50000), // Prevent oversized descriptions
        requirements: job.requirements,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        skills: toJsonArray(job.skills),
        applyUrl: job.applyUrl,
        postedAt: job.postedAt,
        isActive: true,
        scrapedAt: new Date(),
      },
      create: {
        externalId: job.externalId,
        source: sourceEnum,
        title: job.title,
        company: job.company,
        companyLogo: job.companyLogo,
        location: job.location,
        remote: job.remote,
        jobType: jobTypeEnum,
        description: job.description.slice(0, 50000),
        requirements: job.requirements,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        skills: toJsonArray(job.skills),
        applyUrl: job.applyUrl,
        postedAt: job.postedAt,
      },
    });
  }

  private computeHash(job: RawJob): string {
    const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}|${(job.location || "").toLowerCase().trim()}`;
    return createHash("md5").update(key).digest("hex");
  }
}

// Singleton instance
let manager: ScraperManager | null = null;

export function getScraperManager(): ScraperManager {
  if (!manager) {
    manager = new ScraperManager();
  }
  return manager;
}
