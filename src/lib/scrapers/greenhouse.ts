import { BaseScraper, type RawJob } from "./base-scraper";

interface GreenhouseJob {
  id: number;
  title: string;
  location: {
    name: string;
  };
  content?: string;
  departments?: { id: number; name: string }[];
  absolute_url: string;
  updated_at: string;
  metadata?: { id: number; name: string; value: string | string[] | null }[];
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

// Healthcare companies using Greenhouse job boards (verified March 2026)
const GREENHOUSE_COMPANIES = [
  // Healthcare - insurance verification, patient access, benefits
  "bouldercare",              // Boulder Care - insurance verification roles
  "recorainc",                // Recora Inc - insurance verification specialist
  "dreemhealth",              // Dreem Health - verification of benefits
  "calahealth",               // Cala Health - insurance verification & appeals
  "blinkhealth",              // Blink Health - insurance verification specialist
  "vitalcaringgroup",         // VitalCaring Group - insurance verification & auth
  "modernizingmedicineinc",   // Modernizing Medicine - patient claims
  "caredxinc",                // CareDx - reimbursement specialist
  "charliehealth",            // Charlie Health - mental health, patient access
  "shieldshealthsolutions",   // Shields Health Solutions - health systems
  "cloverhealth",             // Clover Health - Medicare Advantage
  "cleerlyhealth",            // Cleerly - heart disease diagnostics
  "acuitymd",                 // AcuityMD - medical technology
  "honehealth",               // Hone Health - online medical clinic
  "khealthcareers",           // K Health - partnered with Mayo Clinic, Cedars-Sinai
  "smartertechnologies",      // Smarter Technologies - patient access specialist
  // General tech (keep a few for broader coverage)
  "stripe",
  "figma",
  "gitlab",
];

export class GreenhouseScraper extends BaseScraper {
  source = "GREENHOUSE";

  private readonly baseUrl = "https://boards-api.greenhouse.io/v1/boards";

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    try {
      console.log(
        `[Greenhouse] Fetching jobs from ${GREENHOUSE_COMPANIES.length} companies...`
      );

      const results = await Promise.allSettled(
        GREENHOUSE_COMPANIES.map((company) =>
          this.fetchCompanyJobs(company, query)
        )
      );

      const allJobs: RawJob[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const company = GREENHOUSE_COMPANIES[i];

        if (result.status === "fulfilled") {
          console.log(
            `[Greenhouse] ${company}: ${result.value.length} jobs`
          );
          allJobs.push(...result.value);
        } else {
          console.warn(
            `[Greenhouse] ${company} failed: ${
              result.reason instanceof Error
                ? result.reason.message
                : "Unknown error"
            }`
          );
        }
      }

      console.log(
        `[Greenhouse] Total: ${allJobs.length} jobs for "${query}"`
      );

      return allJobs;
    } catch (error) {
      console.error("[Greenhouse] Scraping error:", error);
      return [];
    }
  }

  private async fetchCompanyJobs(
    company: string,
    query: string
  ): Promise<RawJob[]> {
    const url = `${this.baseUrl}/${company}/jobs?content=true`;

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

    const data: GreenhouseResponse = await response.json();

    if (!data.jobs || !Array.isArray(data.jobs)) {
      return [];
    }

    let jobs = data.jobs.filter((job) => job.title && job.absolute_url);

    // Filter by query keywords (split query into words, match if ANY keyword found)
    if (query) {
      const keywords = query.toLowerCase().split(/\s+/).filter(w =>
        w.length > 2 && !["the", "and", "for", "with", "job", "role", "a", "an"].includes(w)
      );
      if (keywords.length > 0) {
        jobs = jobs.filter((job) => {
          const searchText = [
            job.title,
            job.location?.name,
            job.content,
            ...(job.departments?.map((d) => d.name) || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return keywords.some((kw) => searchText.includes(kw));
        });
      }
    }

    // Cap per company to avoid overwhelming results
    return jobs.slice(0, 50).map((job) => this.mapToRawJob(job, company));
  }

  private mapToRawJob(job: GreenhouseJob, company: string): RawJob {
    const cleanDescription = this.stripHtml(job.content || "");
    const locationName = job.location?.name || "";

    const isRemote =
      locationName.toLowerCase().includes("remote") ||
      cleanDescription.toLowerCase().includes("remote");

    const companyDisplayName = this.formatCompanyName(company);

    const departments = job.departments?.map((d) => d.name) || [];

    return {
      externalId: `greenhouse-${company}-${job.id}`,
      title: job.title,
      company: companyDisplayName,
      location: locationName || "Not specified",
      remote: isRemote,
      jobType: "FULL_TIME",
      description: cleanDescription,
      skills: this.extractSkills(
        `${cleanDescription} ${departments.join(" ")}`
      ),
      applyUrl: job.absolute_url,
      postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
    };
  }

  private formatCompanyName(slug: string): string {
    const nameMap: Record<string, string> = {
      bouldercare: "Boulder Care",
      recorainc: "Recora Inc",
      dreemhealth: "Dreem Health",
      calahealth: "Cala Health",
      blinkhealth: "Blink Health",
      vitalcaringgroup: "VitalCaring Group",
      modernizingmedicineinc: "Modernizing Medicine",
      caredxinc: "CareDx",
      charliehealth: "Charlie Health",
      shieldshealthsolutions: "Shields Health Solutions",
      cloverhealth: "Clover Health",
      cleerlyhealth: "Cleerly",
      acuitymd: "AcuityMD",
      honehealth: "Hone Health",
      khealthcareers: "K Health",
      smartertechnologies: "Smarter Technologies",
      stripe: "Stripe",
      figma: "Figma",
      gitlab: "GitLab",
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
