import { BaseScraper, type RawJob } from "./base-scraper";

interface ArbeitNowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  tags: string[];
  job_types: string[];
  location: string;
  remote: boolean;
  url: string;
  created_at: string;
}

interface ArbeitNowResponse {
  data: ArbeitNowJob[];
  links?: {
    next?: string;
  };
  meta?: {
    total?: number;
  };
}

const JOB_TYPE_MAP: Record<string, string> = {
  "Full-Time": "FULL_TIME",
  "Full Time": "FULL_TIME",
  "Part-Time": "PART_TIME",
  "Part Time": "PART_TIME",
  Contract: "CONTRACT",
  Freelance: "FREELANCE",
  Internship: "INTERNSHIP",
};

export class ArbeitNowScraper extends BaseScraper {
  source = "ARBEITNOW";

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    try {
      const url = "https://www.arbeitnow.com/api/job-board-api";

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "iAutoApply/1.0 (job-search-aggregator; contact@iautoapply.com)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("ArbeitNow rate limited, backing off...");
          await this.delay(5000);
          return [];
        }
        throw new Error(`ArbeitNow API error: ${response.status}`);
      }

      const data: ArbeitNowResponse = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        console.error("ArbeitNow returned unexpected data format");
        return [];
      }

      let jobs = data.data;

      // Filter by query if provided
      if (query) {
        const lowerQuery = query.toLowerCase();
        jobs = jobs.filter(
          (job) =>
            job.title.toLowerCase().includes(lowerQuery) ||
            job.description.toLowerCase().includes(lowerQuery) ||
            job.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
      }

      return jobs
        .filter((job) => job.title && job.company_name)
        .slice(0, 100)
        .map((job) => this.mapToRawJob(job));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("ArbeitNow request timed out");
      } else {
        console.error("ArbeitNow scraping error:", error);
      }
      return [];
    }
  }

  private mapToRawJob(job: ArbeitNowJob): RawJob {
    const cleanDescription = this.stripHtml(job.description || "");

    // Map job types
    const jobType =
      job.job_types
        .map((t) => JOB_TYPE_MAP[t])
        .find((t) => t) || "FULL_TIME";

    return {
      externalId: `arbeitnow-${job.slug}`,
      title: job.title,
      company: job.company_name,
      location: job.location || (job.remote ? "Remote" : undefined),
      remote: job.remote,
      jobType,
      description: cleanDescription,
      skills:
        job.tags && job.tags.length > 0
          ? job.tags
          : this.extractSkills(cleanDescription),
      applyUrl: job.url,
      postedAt: job.created_at ? new Date(job.created_at) : undefined,
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }
}
