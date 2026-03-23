import { BaseScraper, type RawJob } from "./base-scraper";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

interface RemotiveResponse {
  "job-count": number;
  "total-job-count": number;
  jobs: RemotiveJob[];
}

// Map common search terms to Remotive category slugs
const CATEGORY_MAP: Record<string, string> = {
  "software": "software-dev",
  "software engineer": "software-dev",
  "software developer": "software-dev",
  "developer": "software-dev",
  "engineer": "software-dev",
  "programming": "software-dev",
  "frontend": "software-dev",
  "backend": "software-dev",
  "fullstack": "software-dev",
  "full stack": "software-dev",
  "customer service": "customer-support",
  "customer support": "customer-support",
  "support": "customer-support",
  "design": "design",
  "designer": "design",
  "ui": "design",
  "ux": "design",
  "marketing": "marketing",
  "sales": "sales",
  "product": "product",
  "product manager": "product",
  "business": "business",
  "data": "data",
  "data science": "data",
  "data analyst": "data",
  "analytics": "data",
  "devops": "devops",
  "sysadmin": "devops",
  "infrastructure": "devops",
  "finance": "finance",
  "accounting": "finance",
  "hr": "hr",
  "human resources": "hr",
  "qa": "qa",
  "testing": "qa",
  "quality assurance": "qa",
  "writing": "writing",
  "content": "writing",
  "copywriting": "writing",
  "technical writer": "writing",
};

// Map Remotive job_type to our JobType
const JOB_TYPE_MAP: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACT",
  freelance: "FREELANCE",
  internship: "INTERNSHIP",
  other: "FULL_TIME",
};

export class RemotiveScraper extends BaseScraper {
  source = "REMOTIVE";

  private readonly baseUrl = "https://remotive.com/api/remote-jobs";

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    try {
      const params = new URLSearchParams({
        limit: "100",
      });

      // Map query to a Remotive category if possible
      const category = this.mapQueryToCategory(query);
      if (category) {
        params.set("category", category);
      }

      // Also use search param for more specific queries
      if (query) {
        params.set("search", query);
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
          console.warn("[Remotive] Rate limited");
          return [];
        }
        throw new Error(`Remotive API error: ${response.status}`);
      }

      const data: RemotiveResponse = await response.json();

      if (!data.jobs || !Array.isArray(data.jobs)) {
        console.error("[Remotive] Invalid response format");
        return [];
      }

      const jobs = data.jobs
        .filter((job) => job.title && job.company_name && job.url)
        .slice(0, 100)
        .map((job) => this.mapToRawJob(job));

      console.log(`[Remotive] Fetched ${jobs.length} jobs for "${query}"`);

      return jobs;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[Remotive] Request timed out");
      } else {
        console.error("[Remotive] Scraping error:", error);
      }
      return [];
    }
  }

  private mapQueryToCategory(query: string): string | null {
    const lowerQuery = query.toLowerCase().trim();

    // Direct match
    if (CATEGORY_MAP[lowerQuery]) {
      return CATEGORY_MAP[lowerQuery];
    }

    // Partial match
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
      if (lowerQuery.includes(key)) {
        return value;
      }
    }

    return null;
  }

  private mapToRawJob(job: RemotiveJob): RawJob {
    const cleanDescription = this.stripHtml(job.description || "");

    const jobType = JOB_TYPE_MAP[job.job_type] || "FULL_TIME";

    const salary = this.parseSalaryFromField(job.salary, cleanDescription);

    // Build skills from tags + extracted from description
    const skills =
      job.tags && job.tags.length > 0
        ? job.tags
        : this.extractSkills(cleanDescription);

    return {
      externalId: `remotive-${job.id}`,
      title: job.title,
      company: job.company_name,
      companyLogo: job.company_logo || undefined,
      location: job.candidate_required_location || "Worldwide",
      remote: true, // All Remotive jobs are remote
      jobType,
      description: cleanDescription,
      skills,
      salaryMin: salary.min,
      salaryMax: salary.max,
      applyUrl: job.url,
      postedAt: job.publication_date
        ? new Date(job.publication_date)
        : undefined,
    };
  }

  private parseSalaryFromField(
    salaryField: string,
    description: string
  ): { min?: number; max?: number } {
    // Try parsing the dedicated salary field first
    if (salaryField) {
      const result = this.parseSalary(salaryField);
      if (result.min || result.max) return result;
    }

    // Fall back to extracting from description
    return this.parseSalary(description);
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
