import { BaseScraper, type RawJob } from "./base-scraper";

interface TheMuseJob {
  id: number;
  name: string;
  company: {
    id: number;
    name: string;
    short_name: string;
  };
  locations: Array<{ name: string }>;
  levels: Array<{ name: string; short_name: string }>;
  refs: {
    landing_page: string;
  };
  publication_date: string;
  categories: Array<{ name: string }>;
  contents: string;
  type?: string;
  model_type?: string;
}

interface TheMuseResponse {
  page: number;
  page_count: number;
  items_per_page: number;
  total: number;
  results: TheMuseJob[];
}

// Map common search terms to Muse category values
const CATEGORY_MAP: Record<string, string> = {
  "customer service": "Customer Service",
  "customer support": "Customer Service",
  "software": "Software Engineering",
  "software engineer": "Software Engineering",
  "software developer": "Software Engineering",
  "developer": "Software Engineering",
  "engineer": "Software Engineering",
  "programming": "Software Engineering",
  "data": "Data Science",
  "data science": "Data Science",
  "data analyst": "Data and Analytics",
  "analytics": "Data and Analytics",
  "marketing": "Marketing",
  "design": "Design",
  "product": "Product",
  "product manager": "Product",
  "project management": "Project Management",
  "finance": "Finance",
  "accounting": "Finance",
  "hr": "Human Resources",
  "human resources": "Human Resources",
  "sales": "Sales",
  "operations": "Operations",
  "legal": "Legal",
  "education": "Education",
  "healthcare": "Healthcare Administration",
  "writing": "Writing and Editing",
  "content": "Writing and Editing",
};

export class TheMuseScraper extends BaseScraper {
  source = "THEMUSE";

  private readonly baseUrl = "https://www.themuse.com/api/public/jobs";
  private readonly maxPages = 3; // 20 jobs per page = 60 jobs max

  async scrape(query: string, location?: string): Promise<RawJob[]> {
    try {
      const allJobs: RawJob[] = [];

      for (let page = 0; page < this.maxPages; page++) {
        const params = new URLSearchParams({
          page: page.toString(),
          descending: "true",
        });

        // Map query to a Muse category if possible
        const category = this.mapQueryToCategory(query);
        if (category) {
          params.set("category", category);
        }

        if (location) {
          params.set("location", location);
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
            console.warn("[TheMuse] Rate limited, stopping pagination");
            break;
          }
          throw new Error(`TheMuse API error: ${response.status}`);
        }

        const data: TheMuseResponse = await response.json();

        if (!data.results || data.results.length === 0) {
          break;
        }

        const jobs = data.results
          .filter((job) => job.name && job.company?.name && job.refs?.landing_page)
          .map((job) => this.mapToRawJob(job));

        allJobs.push(...jobs);

        // If we got fewer than a full page, no more pages
        if (data.results.length < data.items_per_page) {
          break;
        }

        // Small delay between pages to be respectful
        if (page < this.maxPages - 1) {
          await this.delay(500);
        }
      }

      // If we have a query and no category match, filter results client-side
      const filtered = this.filterByQuery(allJobs, query);

      console.log(
        `[TheMuse] Fetched ${allJobs.length} jobs, ${filtered.length} after filtering for "${query}"`
      );

      return filtered.slice(0, 100);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[TheMuse] Request timed out");
      } else {
        console.error("[TheMuse] Scraping error:", error);
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

    // Partial match - check if any key is contained in the query
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
      if (lowerQuery.includes(key)) {
        return value;
      }
    }

    return null;
  }

  private filterByQuery(jobs: RawJob[], query: string): RawJob[] {
    if (!query) return jobs;

    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);

    // If we mapped to a category, the API already filtered, so return all
    if (this.mapQueryToCategory(query)) {
      return jobs;
    }

    // Otherwise filter client-side by title/company/description
    return jobs.filter((job) => {
      const searchText =
        `${job.title} ${job.company} ${job.description}`.toLowerCase();
      return queryWords.some((word) => searchText.includes(word));
    });
  }

  private mapToRawJob(job: TheMuseJob): RawJob {
    const locationName =
      job.locations && job.locations.length > 0
        ? job.locations.map((l) => l.name).join(", ")
        : "Not specified";

    const isRemote = job.locations?.some(
      (l) =>
        l.name.toLowerCase().includes("remote") ||
        l.name.toLowerCase().includes("flexible")
    ) ?? false;

    const level =
      job.levels && job.levels.length > 0 ? job.levels[0].name : undefined;

    const category =
      job.categories && job.categories.length > 0
        ? job.categories[0].name
        : undefined;

    const cleanDescription = this.stripHtml(job.contents || "");

    // Try to determine job type from the contents
    let jobType = "FULL_TIME";
    const lowerDesc = cleanDescription.toLowerCase();
    if (lowerDesc.includes("part-time") || lowerDesc.includes("part time")) {
      jobType = "PART_TIME";
    } else if (lowerDesc.includes("contract")) {
      jobType = "CONTRACT";
    } else if (lowerDesc.includes("internship") || lowerDesc.includes("intern")) {
      jobType = "INTERNSHIP";
    } else if (lowerDesc.includes("freelance")) {
      jobType = "FREELANCE";
    }

    // Build a richer description with metadata
    const descParts: string[] = [];
    if (level) descParts.push(`Level: ${level}`);
    if (category) descParts.push(`Category: ${category}`);
    if (descParts.length > 0) {
      descParts.push("");
    }
    descParts.push(cleanDescription);

    const salary = this.parseSalary(cleanDescription);

    return {
      externalId: `themuse-${job.id}`,
      title: job.name,
      company: job.company.name,
      location: locationName,
      remote: isRemote,
      jobType,
      description: descParts.join("\n"),
      skills: this.extractSkills(cleanDescription),
      salaryMin: salary.min,
      salaryMax: salary.max,
      applyUrl: job.refs.landing_page,
      postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
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
