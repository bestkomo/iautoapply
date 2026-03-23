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
  private readonly baseUrl =
    "https://active-jobs-db.p.rapidapi.com/active-ats-24h";

  constructor() {
    super();
    this.apiKey = process.env.RAPIDAPI_KEY;
  }

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    if (!this.apiKey) {
      console.log("[ActiveJobs] RAPIDAPI_KEY not set, skipping");
      return [];
    }

    try {
      const params = new URLSearchParams({
        offset: "0",
        title_filter: `"${query}"`,
        location_filter: `"United States"`,
        description_type: "text",
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          "x-rapidapi-host": "active-jobs-db.p.rapidapi.com",
          "x-rapidapi-key": this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[ActiveJobs] Rate limited");
          return [];
        }
        if (response.status === 403) {
          console.error(
            "[ActiveJobs] API key invalid or subscription expired"
          );
          return [];
        }
        throw new Error(`ActiveJobs API error: ${response.status}`);
      }

      const data: unknown = await response.json();

      // The API returns a direct array; handle error objects gracefully
      if (!Array.isArray(data)) {
        console.error(
          "[ActiveJobs] Unexpected response (not an array):",
          typeof data
        );
        return [];
      }

      const items = data as ActiveJobsItem[];
      const limited = items.slice(0, MAX_RESULTS);

      const jobs = limited
        .filter((item) => item.title && item.organization && item.url)
        .map((item) => this.mapToRawJob(item));

      console.log(`[ActiveJobs] Fetched ${jobs.length} jobs`);
      return jobs;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[ActiveJobs] Request timed out");
      } else {
        console.error("[ActiveJobs] Scraping error:", error);
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
