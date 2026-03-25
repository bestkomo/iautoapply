import { BaseScraper, type RawJob } from "./base-scraper";

interface RemoteJobsItem {
  id: number;
  slug: string;
  url: string;
  title: string;
  description?: string;
  datePosted?: string;
  skills?: string[] | null;
  categories?: string[] | null;
  employmentTypes?: string[] | null;
  locationTypes?: string[] | null;
  countries?: string[] | null;
  company?: number | { name?: string } | null;
}

const MAX_RESULTS = 50;

export class RemoteJobsAPIScraper extends BaseScraper {
  source = "REMOTEJOBS_API";

  private readonly apiKey: string | undefined;

  constructor() {
    super();
    this.apiKey = process.env.RAPIDAPI_KEY;
  }

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    if (!this.apiKey) {
      console.log("[RemoteJobsAPI] RAPIDAPI_KEY not set, skipping");
      return [];
    }

    try {
      const params = new URLSearchParams({
        country: "us",
        employment_type: "fulltime",
        limit: MAX_RESULTS.toString(),
        include_company: "false",
        include_total_count: "false",
      });

      if (query) {
        params.set("keyword", query);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(
        `https://remote-jobs1.p.rapidapi.com/jobs?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-rapidapi-host": "remote-jobs1.p.rapidapi.com",
            "x-rapidapi-key": this.apiKey,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[RemoteJobsAPI] Rate limited");
          return [];
        }
        console.error(`[RemoteJobsAPI] API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const items: RemoteJobsItem[] = data.data || [];

      const jobs = items
        .filter((item) => item.title && item.url)
        .map((item) => this.mapToRawJob(item));

      console.log(`[RemoteJobsAPI] Fetched ${jobs.length} jobs for "${query}"`);
      return jobs;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[RemoteJobsAPI] Request timed out");
      } else {
        console.error("[RemoteJobsAPI] Error:", error);
      }
      return [];
    }
  }

  private mapToRawJob(item: RemoteJobsItem): RawJob {
    // Strip HTML from description
    const description = item.description
      ? item.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
      : "";

    // Extract company name
    const company =
      typeof item.company === "object" && item.company?.name
        ? item.company.name
        : "Unknown";

    // Map employment type
    const jobType = this.mapJobType(item.employmentTypes);

    // Check if remote
    const remote =
      item.locationTypes?.includes("remote") ?? true;

    // Extract skills from description
    const skills = description ? this.extractSkills(description) : [];

    // Parse posted date
    const postedAt = item.datePosted ? new Date(item.datePosted) : undefined;

    // Build location from countries
    const location = item.countries?.length
      ? item.countries.map((c) => c.toUpperCase()).join(", ")
      : "Remote";

    return {
      externalId: `remotejobsapi-${item.id}`,
      title: item.title,
      company,
      location,
      remote,
      jobType,
      description: description.substring(0, 5000),
      skills,
      applyUrl: item.url,
      postedAt,
    };
  }

  private mapJobType(types?: string[] | null): string {
    if (!types || types.length === 0) return "FULL_TIME";

    const typeMap: Record<string, string> = {
      fulltime: "FULL_TIME",
      parttime: "PART_TIME",
      contract: "CONTRACT",
      internship: "INTERNSHIP",
      freelance: "FREELANCE",
    };

    for (const t of types) {
      if (typeof t === "string" && typeMap[t.toLowerCase()]) {
        return typeMap[t.toLowerCase()];
      }
    }

    return "FULL_TIME";
  }
}
