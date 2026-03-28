import { BaseScraper, type RawJob } from "./base-scraper";

interface LeverJob {
  id: string;
  text: string;
  categories: {
    team?: string;
    location?: string;
    commitment?: string;
    department?: string;
  };
  hostedUrl: string;
  applyUrl: string;
  description?: string;
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additional?: string;
  additionalPlain?: string;
  createdAt: number;
}

// Healthcare + general companies using Lever job boards
const LEVER_COMPANIES = [
  // Healthcare companies
  "pmdsoft",                                // pMD - medical insurance verification
  "ClinicalHealthNetworkForTransformation", // CHN - patient access representatives
  "heyjane",                                // Hey Jane - billing specialist, Medicaid
  "includedhealth",                         // Included Health - healthcare services
  "healthcare",                             // HealthCare.com - health insurance
  "all.health",                             // all.health - health platform
  "nuvancehealth",                          // Nuvance Health - hospital system
  "cityblock",                              // Cityblock Health - community health
  "devoted",                                // Devoted Health - Medicare Advantage
  "hims",                                   // Hims & Hers Health
  // General companies (keep for broader coverage)
  "netflix",
  "shopify",
  "coinbase",
];

const COMMITMENT_MAP: Record<string, string> = {
  "full-time": "FULL_TIME",
  "full time": "FULL_TIME",
  fulltime: "FULL_TIME",
  "part-time": "PART_TIME",
  "part time": "PART_TIME",
  contract: "CONTRACT",
  contractor: "CONTRACT",
  freelance: "FREELANCE",
  intern: "INTERNSHIP",
  internship: "INTERNSHIP",
};

export class LeverScraper extends BaseScraper {
  source = "LEVER";

  private readonly baseUrl = "https://api.lever.co/v0/postings";

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    try {
      console.log(
        `[Lever] Fetching jobs from ${LEVER_COMPANIES.length} companies...`
      );

      const results = await Promise.allSettled(
        LEVER_COMPANIES.map((company) =>
          this.fetchCompanyJobs(company, query)
        )
      );

      const allJobs: RawJob[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const company = LEVER_COMPANIES[i];

        if (result.status === "fulfilled") {
          console.log(
            `[Lever] ${company}: ${result.value.length} jobs`
          );
          allJobs.push(...result.value);
        } else {
          console.warn(
            `[Lever] ${company} failed: ${
              result.reason instanceof Error
                ? result.reason.message
                : "Unknown error"
            }`
          );
        }
      }

      console.log(`[Lever] Total: ${allJobs.length} jobs for "${query}"`);

      return allJobs;
    } catch (error) {
      console.error("[Lever] Scraping error:", error);
      return [];
    }
  }

  private async fetchCompanyJobs(
    company: string,
    query: string
  ): Promise<RawJob[]> {
    const url = `${this.baseUrl}/${company}?mode=json`;

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
      throw new Error(`HTTP ${response.status}`);
    }

    const data: LeverJob[] = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    let jobs = data.filter((job) => job.text && job.hostedUrl);

    // Filter by query keywords (split query into words, match if ANY keyword found)
    if (query) {
      const keywords = query.toLowerCase().split(/\s+/).filter(w =>
        w.length > 2 && !["the", "and", "for", "with", "job", "role", "a", "an"].includes(w)
      );
      if (keywords.length > 0) {
        jobs = jobs.filter((job) => {
          const searchText = [
            job.text,
            job.categories?.team,
            job.categories?.location,
            job.categories?.department,
            job.descriptionPlain,
            job.additionalPlain,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return keywords.some((kw) => searchText.includes(kw));
        });
      }
    }

    // Cap per company
    return jobs.slice(0, 50).map((job) => this.mapToRawJob(job, company));
  }

  private mapToRawJob(job: LeverJob, company: string): RawJob {
    // Build description from available fields
    const descriptionParts: string[] = [];
    if (job.descriptionPlain) {
      descriptionParts.push(job.descriptionPlain);
    }
    if (job.lists) {
      for (const list of job.lists) {
        descriptionParts.push(`${list.text}\n${this.stripHtml(list.content)}`);
      }
    }
    if (job.additionalPlain) {
      descriptionParts.push(job.additionalPlain);
    }

    const cleanDescription =
      descriptionParts.join("\n\n") || this.stripHtml(job.description || "");

    const locationStr = job.categories?.location || "";

    const isRemote =
      locationStr.toLowerCase().includes("remote") ||
      cleanDescription.toLowerCase().includes("remote");

    const commitment = (job.categories?.commitment || "").toLowerCase();
    const jobType = COMMITMENT_MAP[commitment] || "FULL_TIME";

    const companyDisplayName = this.formatCompanyName(company);

    const salary = this.parseSalary(cleanDescription);

    return {
      externalId: `lever-${company}-${job.id}`,
      title: job.text,
      company: companyDisplayName,
      location: locationStr || "Not specified",
      remote: isRemote,
      jobType,
      description: cleanDescription,
      skills: this.extractSkills(cleanDescription),
      salaryMin: salary.min,
      salaryMax: salary.max,
      applyUrl: job.hostedUrl,
      postedAt: job.createdAt ? new Date(job.createdAt) : undefined,
    };
  }

  private formatCompanyName(slug: string): string {
    const nameMap: Record<string, string> = {
      pmdsoft: "pMD",
      ClinicalHealthNetworkForTransformation: "Clinical Health Network",
      heyjane: "Hey Jane",
      includedhealth: "Included Health",
      healthcare: "HealthCare.com",
      "all.health": "all.health",
      nuvancehealth: "Nuvance Health",
      cityblock: "Cityblock Health",
      devoted: "Devoted Health",
      hims: "Hims & Hers Health",
      netflix: "Netflix",
      shopify: "Shopify",
      coinbase: "Coinbase",
    };
    return (
      nameMap[slug] ||
      slug.charAt(0).toUpperCase() + slug.slice(1)
    );
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
