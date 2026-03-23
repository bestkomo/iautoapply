import { BaseScraper, type RawJob } from "./base-scraper";

interface HimalayasJob {
  id: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  categories?: string[];
  locations?: string[];
  salary?: string;
  seniority?: string;
  jobType?: string;
  applicationLink?: string;
  description?: string;
  pubDate?: string;
  tags?: string[];
}

interface HimalayasResponse {
  jobs: HimalayasJob[];
  total_count?: number;
}

const JOB_TYPE_MAP: Record<string, string> = {
  full_time: "FULL_TIME",
  "full-time": "FULL_TIME",
  fulltime: "FULL_TIME",
  part_time: "PART_TIME",
  "part-time": "PART_TIME",
  contract: "CONTRACT",
  freelance: "FREELANCE",
  internship: "INTERNSHIP",
};

export class HimalayasScraper extends BaseScraper {
  source = "HIMALAYAS";

  private readonly baseUrl = "https://himalayas.app/jobs/api";

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    try {
      const params = new URLSearchParams({
        limit: "50",
        offset: "0",
      });

      if (query) {
        params.set("q", query);
      }

      const url = `${this.baseUrl}?${params.toString()}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "iAutoApply/1.0 (job-search-aggregator; contact@iautoapply.com)",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[Himalayas] Rate limited");
          return [];
        }
        throw new Error(`Himalayas API error: ${response.status}`);
      }

      const data: HimalayasResponse = await response.json();

      if (!data.jobs || !Array.isArray(data.jobs)) {
        console.error("[Himalayas] Invalid response format");
        return [];
      }

      const jobs = data.jobs
        .filter((job) => job.title && job.companyName)
        .slice(0, 100)
        .map((job) => this.mapToRawJob(job));

      console.log(`[Himalayas] Fetched ${jobs.length} jobs for "${query}"`);

      return jobs;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[Himalayas] Request timed out");
      } else {
        console.error("[Himalayas] Scraping error:", error);
      }
      return [];
    }
  }

  private mapToRawJob(job: HimalayasJob): RawJob {
    const cleanDescription = this.stripHtml(job.description || "");

    const locationStr =
      job.locations && job.locations.length > 0
        ? job.locations.join(", ")
        : "Remote";

    const isRemote =
      locationStr.toLowerCase().includes("remote") ||
      (job.locations?.some((l) => l.toLowerCase().includes("remote")) ??
        false);

    const jobTypeKey = (job.jobType || "full_time").toLowerCase();
    const jobType = JOB_TYPE_MAP[jobTypeKey] || "FULL_TIME";

    const salary = job.salary ? this.parseSalary(job.salary) : {};

    const skills =
      job.tags && job.tags.length > 0
        ? job.tags
        : this.extractSkills(cleanDescription);

    return {
      externalId: `himalayas-${job.id}`,
      title: job.title,
      company: job.companyName,
      companyLogo: job.companyLogo || undefined,
      location: locationStr,
      remote: isRemote,
      jobType,
      description: cleanDescription,
      skills,
      salaryMin: salary.min,
      salaryMax: salary.max,
      applyUrl:
        job.applicationLink ||
        `https://himalayas.app/jobs/${job.id}`,
      postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  }
}
