import { BaseScraper, type RawJob } from "./base-scraper";

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  companyLogo?: string;
  jobIndustry: string[];
  jobType: string[];
  jobGeo: string;
  jobLevel: string;
  jobExcerpt: string;
  jobDescription: string;
  pubDate: string;
}

interface JobicyResponse {
  jobs: JobicyJob[];
}

const JOB_TYPE_MAP: Record<string, string> = {
  "full-time": "FULL_TIME",
  "full_time": "FULL_TIME",
  "part-time": "PART_TIME",
  "part_time": "PART_TIME",
  contract: "CONTRACT",
  freelance: "FREELANCE",
  internship: "INTERNSHIP",
  temporary: "CONTRACT",
};

const JOB_LEVEL_MAP: Record<string, string> = {
  "entry-level": "ENTRY",
  junior: "JUNIOR",
  "mid-level": "MID",
  senior: "SENIOR",
  lead: "LEAD",
  manager: "MANAGER",
  director: "DIRECTOR",
  executive: "EXECUTIVE",
};

export class JobicyScraper extends BaseScraper {
  source = "JOBICY";

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    try {
      // Jobicy API allows count parameter and optional tag filter
      let url = "https://jobicy.com/api/v2/remote-jobs?count=50";
      if (query) {
        url += `&tag=${encodeURIComponent(query.toLowerCase())}`;
      }

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
          console.warn("Jobicy rate limited, backing off...");
          await this.delay(5000);
          return [];
        }
        throw new Error(`Jobicy API error: ${response.status}`);
      }

      const data: JobicyResponse = await response.json();

      if (!data.jobs || !Array.isArray(data.jobs)) {
        console.error("Jobicy returned unexpected data format");
        return [];
      }

      return data.jobs
        .filter((job) => job.jobTitle && job.companyName)
        .slice(0, 100)
        .map((job) => this.mapToRawJob(job));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("Jobicy request timed out");
      } else {
        console.error("Jobicy scraping error:", error);
      }
      return [];
    }
  }

  private mapToRawJob(job: JobicyJob): RawJob {
    const cleanDescription = this.stripHtml(job.jobDescription || job.jobExcerpt || "");

    // Map job type from array
    const jobType =
      (job.jobType || [])
        .map((t) => JOB_TYPE_MAP[t.toLowerCase()])
        .find((t) => t) || "FULL_TIME";

    // Extract experience level
    const experienceLevel = job.jobLevel
      ? JOB_LEVEL_MAP[job.jobLevel.toLowerCase()]
      : undefined;

    return {
      externalId: `jobicy-${job.id}`,
      title: job.jobTitle,
      company: job.companyName,
      companyLogo: job.companyLogo || undefined,
      location: job.jobGeo || "Remote",
      remote: true, // Jobicy is a remote job board
      jobType,
      description: cleanDescription,
      requirements: experienceLevel
        ? `Experience Level: ${experienceLevel}`
        : undefined,
      skills: this.extractSkills(cleanDescription),
      applyUrl: job.url,
      postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
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
