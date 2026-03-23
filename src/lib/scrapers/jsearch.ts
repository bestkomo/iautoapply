import { BaseScraper, type RawJob } from "./base-scraper";

// JSearch API response types
interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo?: string | null;
  employer_website?: string | null;
  job_publisher: string;
  job_employment_type?: string | null;
  job_apply_link: string;
  job_apply_is_direct?: boolean;
  apply_options?: { publisher: string; apply_link: string }[];
  job_description: string;
  job_is_remote: boolean;
  job_posted_at?: string | null;
  job_posted_at_datetime_utc?: string | null;
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_latitude?: number | null;
  job_longitude?: number | null;
  job_required_experience?: {
    no_experience_required?: boolean;
    required_experience_in_months?: number | null;
    experience_mentioned?: boolean;
    experience_preferred?: boolean;
  } | null;
  job_required_skills?: string[] | null;
  job_required_education?: Record<string, boolean> | null;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
  job_highlights?: {
    Qualifications?: string[];
    Responsibilities?: string[];
    Benefits?: string[];
  } | null;
  job_job_title?: string | null;
  job_onet_soc?: string | null;
  job_onet_job_zone?: string | null;
}

interface JSearchResponse {
  status: string;
  request_id?: string;
  data: JSearchJob[];
}

// Map JSearch publisher names to our SOURCE_MAP keys
const PUBLISHER_SOURCE_MAP: Record<string, string> = {
  Indeed: "INDEED",
  LinkedIn: "LINKEDIN",
  Glassdoor: "GLASSDOOR",
  ZipRecruiter: "INDEED", // map to INDEED since we don't have ZIPRECRUITER enum
  Monster: "INDEED", // same reasoning
};

export class JSearchScraper extends BaseScraper {
  source = "JSEARCH";

  private readonly apiKey: string | undefined;
  private readonly baseUrl = "https://jsearch.p.rapidapi.com/search";
  private readonly maxPages = 2;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 2000; // 2 seconds between requests (conservative for 500/month limit)

  constructor() {
    super();
    this.apiKey = process.env.RAPIDAPI_KEY;
  }

  async scrape(query: string, location?: string): Promise<RawJob[]> {
    if (!this.apiKey) {
      console.log("[JSearch] RAPIDAPI_KEY not set, skipping");
      return [];
    }

    const allJobs: RawJob[] = [];

    try {
      for (let page = 1; page <= this.maxPages; page++) {
        await this.rateLimit();

        const jobs = await this.fetchPage(query, location, page);
        if (jobs.length === 0) break; // No more results

        allJobs.push(...jobs);

        console.log(`[JSearch] Page ${page}: fetched ${jobs.length} jobs`);
      }

      console.log(`[JSearch] Total: ${allJobs.length} jobs fetched`);
      return allJobs;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[JSearch] Request timed out");
      } else {
        console.error("[JSearch] Scraping error:", error);
      }
      return allJobs; // Return whatever we got so far
    }
  }

  private async fetchPage(
    query: string,
    location: string | undefined,
    page: number
  ): Promise<RawJob[]> {
    // Build the search query - JSearch supports natural language queries
    let searchQuery = query;
    if (location) {
      searchQuery += ` in ${location}`;
    }

    const params = new URLSearchParams({
      query: searchQuery,
      page: page.toString(),
      num_pages: "1",
      country: "us",
      date_posted: "week", // Focus on recent jobs to get fresh listings
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          "x-rapidapi-host": "jsearch.p.rapidapi.com",
          "x-rapidapi-key": this.apiKey!,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[JSearch] Rate limited, stopping pagination");
          return [];
        }
        if (response.status === 403) {
          console.error("[JSearch] API key invalid or subscription expired");
          return [];
        }
        throw new Error(`JSearch API error: ${response.status}`);
      }

      const data: JSearchResponse = await response.json();

      if (data.status !== "OK" || !Array.isArray(data.data)) {
        console.error("[JSearch] Unexpected response status:", data.status);
        return [];
      }

      return data.data
        .filter((job) => job.job_title && job.employer_name && job.job_apply_link)
        .map((job) => this.mapToRawJob(job));
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  private mapToRawJob(job: JSearchJob): RawJob {
    // Build location string from city/state/country
    const locationParts: string[] = [];
    if (job.job_city) locationParts.push(job.job_city);
    if (job.job_state) locationParts.push(job.job_state);
    if (locationParts.length === 0 && job.job_country) {
      locationParts.push(job.job_country);
    }
    const locationStr = locationParts.join(", ") || undefined;

    // Extract skills from both job_required_skills and qualifications highlights
    const skills = this.extractAllSkills(job);

    // Map employment type to our format
    const jobType = this.mapJobType(job.job_employment_type);

    // Parse salary - normalize to annual if needed
    const { salaryMin, salaryMax } = this.normalizeSalary(
      job.job_min_salary,
      job.job_max_salary,
      job.job_salary_period
    );

    // Build requirements from highlights
    const requirements = this.buildRequirements(job.job_highlights);

    // Determine the posted date
    const postedAt = job.job_posted_at_datetime_utc
      ? new Date(job.job_posted_at_datetime_utc)
      : job.job_posted_at
        ? new Date(job.job_posted_at)
        : undefined;

    // Include the publisher in the description metadata so we can display it
    // The source field on the scraper is JSEARCH, but we embed publisher info
    const publisherNote = job.job_publisher
      ? `[Source: ${job.job_publisher}] `
      : "";

    return {
      externalId: `jsearch-${job.job_id}`,
      title: job.job_title,
      company: job.employer_name,
      companyLogo: job.employer_logo || undefined,
      location: locationStr,
      remote: job.job_is_remote ?? false,
      jobType,
      description: publisherNote + (job.job_description || ""),
      requirements,
      salaryMin,
      salaryMax,
      skills,
      applyUrl: job.job_apply_link,
      postedAt,
    };
  }

  private extractAllSkills(job: JSearchJob): string[] {
    const skillSet = new Set<string>();

    // Add explicit required skills
    if (job.job_required_skills && Array.isArray(job.job_required_skills)) {
      for (const skill of job.job_required_skills) {
        if (skill && skill.trim()) {
          skillSet.add(skill.trim());
        }
      }
    }

    // Extract skills from qualifications highlights
    if (job.job_highlights?.Qualifications) {
      const qualText = job.job_highlights.Qualifications.join(" ");
      const extractedSkills = this.extractSkills(qualText);
      for (const skill of extractedSkills) {
        skillSet.add(skill);
      }
    }

    // If we still have no skills, try extracting from the description
    if (skillSet.size === 0 && job.job_description) {
      const extractedSkills = this.extractSkills(job.job_description);
      for (const skill of extractedSkills) {
        skillSet.add(skill);
      }
    }

    return Array.from(skillSet);
  }

  private mapJobType(employmentType?: string | null): string {
    if (!employmentType) return "FULL_TIME";

    const normalized = employmentType.toUpperCase().replace(/[\s-]+/g, "_");
    const typeMap: Record<string, string> = {
      FULLTIME: "FULL_TIME",
      FULL_TIME: "FULL_TIME",
      PARTTIME: "PART_TIME",
      PART_TIME: "PART_TIME",
      CONTRACTOR: "CONTRACT",
      CONTRACT: "CONTRACT",
      INTERN: "INTERNSHIP",
      INTERNSHIP: "INTERNSHIP",
      FREELANCE: "FREELANCE",
    };

    return typeMap[normalized] || "FULL_TIME";
  }

  private normalizeSalary(
    min?: number | null,
    max?: number | null,
    period?: string | null
  ): { salaryMin?: number; salaryMax?: number } {
    if (!min && !max) return {};

    // Convert to annual if needed
    let multiplier = 1;
    if (period) {
      const p = period.toUpperCase();
      if (p === "HOUR") multiplier = 2080; // 40hrs * 52 weeks
      if (p === "MONTH") multiplier = 12;
      if (p === "WEEK") multiplier = 52;
    }

    return {
      salaryMin: min ? Math.round(min * multiplier) : undefined,
      salaryMax: max ? Math.round(max * multiplier) : undefined,
    };
  }

  private buildRequirements(
    highlights?: JSearchJob["job_highlights"]
  ): string | undefined {
    if (!highlights) return undefined;

    const parts: string[] = [];

    if (highlights.Qualifications && highlights.Qualifications.length > 0) {
      parts.push(
        "Qualifications:\n" +
          highlights.Qualifications.map((q) => `- ${q}`).join("\n")
      );
    }

    if (highlights.Responsibilities && highlights.Responsibilities.length > 0) {
      parts.push(
        "Responsibilities:\n" +
          highlights.Responsibilities.map((r) => `- ${r}`).join("\n")
      );
    }

    if (highlights.Benefits && highlights.Benefits.length > 0) {
      parts.push(
        "Benefits:\n" +
          highlights.Benefits.map((b) => `- ${b}`).join("\n")
      );
    }

    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await this.delay(this.minRequestInterval - elapsed);
    }
    this.lastRequestTime = Date.now();
  }
}
