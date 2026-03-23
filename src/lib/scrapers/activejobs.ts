import { BaseScraper, type RawJob } from "./base-scraper";

// Active Jobs DB API response types
interface ActiveJobsLocation {
  "@type"?: string;
  address?: {
    "@type"?: string;
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
}

interface ActiveJobsSalary {
  "@type"?: string;
  currency?: string;
  value?: {
    "@type"?: string;
    minValue?: number;
    maxValue?: number;
    unitText?: string;
  };
}

interface ActiveJobsItem {
  id: string;
  date_posted?: string | null;
  date_created?: string | null;
  title: string;
  organization: string;
  organization_url?: string | null;
  locations_raw?: ActiveJobsLocation[] | null;
  location_type?: string | null;
  salary_raw?: ActiveJobsSalary | null;
  employment_type?: string | null;
  url: string;
  source_type?: string | null;
  source?: string | null;
  source_domain?: string | null;
  organization_logo?: string | null;
  cities_derived?: string[] | null;
  regions_derived?: string[] | null;
  countries_derived?: string[] | null;
  locations_derived?: string[] | null;
  remote_derived?: boolean | null;
  description_text?: string | null;
  description_html?: string | null;
}

const MAX_RESULTS = 50;

export class ActiveJobsScraper extends BaseScraper {
  source = "ACTIVEJOBS";

  private readonly apiKey: string | undefined;

  // Two endpoints: 24h for fresh jobs, 6m for broader coverage
  private readonly endpoints = [
    { url: "https://active-jobs-db.p.rapidapi.com/active-ats-24h", host: "active-jobs-db.p.rapidapi.com", label: "24h" },
    { url: "https://job-posting-feed-api.p.rapidapi.com/active-ats-6m", host: "job-posting-feed-api.p.rapidapi.com", label: "6m" },
  ];

  constructor() {
    super();
    this.apiKey = process.env.RAPIDAPI_KEY;
  }

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    if (!this.apiKey) {
      console.log("[ActiveJobs] RAPIDAPI_KEY not set, skipping");
      return [];
    }

    // Query both endpoints in parallel for maximum coverage
    const results = await Promise.allSettled(
      this.endpoints.map((ep) => this.fetchFromEndpoint(ep, query))
    );

    const allJobs: RawJob[] = [];
    const seenIds = new Set<string>();

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const job of result.value) {
          if (!seenIds.has(job.externalId)) {
            seenIds.add(job.externalId);
            allJobs.push(job);
          }
        }
      }
    }

    console.log(`[ActiveJobs] Total fetched: ${allJobs.length} unique jobs from ${this.endpoints.length} endpoints`);
    return allJobs;
  }

  private async fetchFromEndpoint(
    endpoint: { url: string; host: string; label: string },
    query: string
  ): Promise<RawJob[]> {
    try {
      const params = new URLSearchParams({
        description_type: "text",
        page_size: "50",
      });

      // The 24h endpoint uses title_filter + location_filter
      // The 6m endpoint uses title_filter
      if (query) {
        params.set("title_filter", `"${query}"`);
      }
      if (endpoint.label === "24h") {
        params.set("location_filter", `"United States"`);
        params.set("offset", "0");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${endpoint.url}?${params.toString()}`, {
        headers: {
          "x-rapidapi-host": endpoint.host,
          "x-rapidapi-key": this.apiKey!,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`[ActiveJobs-${endpoint.label}] Rate limited`);
          return [];
        }
        if (response.status === 403) {
          console.error(`[ActiveJobs-${endpoint.label}] API key invalid`);
          return [];
        }
        throw new Error(`ActiveJobs-${endpoint.label} API error: ${response.status}`);
      }

      const data: unknown = await response.json();
      if (!Array.isArray(data)) {
        console.error(`[ActiveJobs-${endpoint.label}] Unexpected response`);
        return [];
      }

      const items = data as ActiveJobsItem[];
      const limited = items.slice(0, MAX_RESULTS);

      const jobs = limited
        .filter((item) => item.title && item.organization && item.url)
        .map((item) => this.mapToRawJob(item));

      console.log(`[ActiveJobs-${endpoint.label}] Fetched ${jobs.length} jobs`);
      return jobs;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error(`[ActiveJobs-${endpoint.label}] Request timed out`);
      } else {
        console.error(`[ActiveJobs-${endpoint.label}] Error:`, error);
      }
      return [];
    }
  }

  private mapToRawJob(item: ActiveJobsItem): RawJob {
    // Build location string
    const location = this.buildLocation(item);

    // Parse salary from salary_raw
    const { salaryMin, salaryMax } = this.parseSalaryRaw(item.salary_raw);

    // Map employment type
    const jobType = this.mapJobType(item.employment_type);

    // Parse posted date
    const postedAt = item.date_posted
      ? new Date(item.date_posted)
      : item.date_created
        ? new Date(item.date_created)
        : undefined;

    // Extract skills from description
    const skills = item.description_text
      ? this.extractSkills(item.description_text)
      : [];

    // Add ATS source as a note in description
    const sourceNote = item.source ? `[Source: ${item.source}] ` : "";
    const description = sourceNote + (item.description_text || "");

    return {
      externalId: `activejobs-${item.id}`,
      title: item.title,
      company: item.organization,
      companyLogo: item.organization_logo || undefined,
      location,
      remote: item.remote_derived ?? false,
      jobType,
      description,
      salaryMin,
      salaryMax,
      skills,
      applyUrl: item.url,
      postedAt,
    };
  }

  private buildLocation(item: ActiveJobsItem): string | undefined {
    // Prefer locations_derived which is already formatted
    if (item.locations_derived && item.locations_derived.length > 0) {
      return item.locations_derived[0];
    }

    // Fallback: build from cities + regions
    const parts: string[] = [];
    if (item.cities_derived && item.cities_derived.length > 0) {
      parts.push(item.cities_derived[0]);
    }
    if (item.regions_derived && item.regions_derived.length > 0) {
      parts.push(item.regions_derived[0]);
    }
    if (parts.length === 0 && item.countries_derived && item.countries_derived.length > 0) {
      parts.push(item.countries_derived[0]);
    }

    return parts.length > 0 ? parts.join(", ") : undefined;
  }

  private parseSalaryRaw(
    salary?: ActiveJobsSalary | null
  ): { salaryMin?: number; salaryMax?: number } {
    if (!salary?.value) return {};

    const { minValue, maxValue, unitText } = salary.value;
    if (!minValue && !maxValue) return {};

    // Convert to annual if hourly/weekly/monthly
    let multiplier = 1;
    if (unitText) {
      const unit = unitText.toUpperCase();
      if (unit === "HOUR") multiplier = 2080; // 40 hrs * 52 weeks
      if (unit === "WEEK") multiplier = 52;
      if (unit === "MONTH") multiplier = 12;
    }

    return {
      salaryMin: minValue ? Math.round(minValue * multiplier) : undefined,
      salaryMax: maxValue ? Math.round(maxValue * multiplier) : undefined,
    };
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
}
