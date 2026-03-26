import { BaseScraper, type RawJob } from "./base-scraper";

/**
 * Workday Direct Scraper
 *
 * Scrapes jobs directly from major healthcare companies' Workday career sites.
 * Workday has a public JSON API at each company's career site that returns jobs.
 *
 * URL pattern: https://{company}.wd{N}.myworkdayjobs.com/wday/cxs/{company}/{site}/jobs
 */

interface WorkdayJobPosting {
  bulletFields?: string[];
  locationsText?: string;
  postedOn?: string;
  title: string;
  externalPath: string;
  subtitles?: { instances?: { text?: string }[] }[];
}

interface WorkdayResponse {
  total?: number;
  jobPostings?: WorkdayJobPosting[];
}

// Major healthcare companies with VERIFIED Workday career sites (tested March 2026)
// Format: { name, subdomain, wdInstance, site }
// URL pattern: https://{subdomain}.wd{wdInstance}.myworkdayjobs.com/wday/cxs/{subdomain}/{site}/jobs
const HEALTHCARE_WORKDAY_COMPANIES = [
  // === VERIFIED WORKING (tested March 2026, returns 200 + job results) ===
  { name: "Humana", subdomain: "humana", wdInstance: "5", site: "Humana_External_Career_Site" },
  { name: "Cigna / The Cigna Group", subdomain: "cigna", wdInstance: "5", site: "cignacareers" },
  { name: "Jefferson Health", subdomain: "jeffersonhealth", wdInstance: "5", site: "ThomasJeffersonExternal" },
  { name: "Ensemble Health Partners", subdomain: "ensemblehp", wdInstance: "5", site: "EnsembleHealthPartnersCareers" },
  { name: "Nationwide Children's", subdomain: "nationwidechildrens", wdInstance: "5", site: "NCHCareers" },
  { name: "Memorial Hermann", subdomain: "memorialhermann", wdInstance: "5", site: "External" },
  { name: "Workday (itself)", subdomain: "workday", wdInstance: "5", site: "Workday" },
];

const MAX_PER_COMPANY = 10;

export class WorkdayScraper extends BaseScraper {
  source = "WORKDAY";

  async scrape(query: string, location?: string): Promise<RawJob[]> {
    const allJobs: RawJob[] = [];

    // Search healthcare query terms
    const searchTerms = query || "verification specialist";

    // Scrape from multiple companies in parallel (limit concurrency to 5)
    const batchSize = 5;
    for (let i = 0; i < HEALTHCARE_WORKDAY_COMPANIES.length; i += batchSize) {
      const batch = HEALTHCARE_WORKDAY_COMPANIES.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((company) => this.scrapeCompany(company, searchTerms, location))
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          allJobs.push(...result.value);
        }
      }
    }

    console.log(`[Workday] Total fetched: ${allJobs.length} jobs from ${HEALTHCARE_WORKDAY_COMPANIES.length} companies`);
    return allJobs;
  }

  private async scrapeCompany(
    company: { name: string; subdomain: string; wdInstance: string; site: string },
    query: string,
    location?: string
  ): Promise<RawJob[]> {
    try {
      const baseUrl = `https://${company.subdomain}.wd${company.wdInstance}.myworkdayjobs.com`;
      const apiUrl = `${baseUrl}/wday/cxs/${company.subdomain}/${company.site}/jobs`;

      const body: Record<string, unknown> = {
        appliedFacets: {},
        limit: MAX_PER_COMPANY,
        offset: 0,
        searchText: query,
      };

      // Add location filter if provided
      if (location) {
        body.searchText = `${query} ${location}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // Log all errors to help debug URL patterns
        console.warn(`[Workday] ${company.name}: API returned ${response.status} for ${apiUrl}`);
        return [];
      }

      const data: WorkdayResponse = await response.json();
      const postings = data.jobPostings || [];

      const jobs = postings.map((posting) => this.mapToRawJob(posting, company, baseUrl));
      if (jobs.length > 0) {
        console.log(`[Workday] ${company.name}: Found ${jobs.length} jobs`);
      }
      return jobs;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Timeout — skip silently
      } else {
        // Don't spam logs for connection errors
      }
      return [];
    }
  }

  private mapToRawJob(
    posting: WorkdayJobPosting,
    company: { name: string; subdomain: string; wdInstance: string; site: string },
    baseUrl: string
  ): RawJob {
    const location = posting.locationsText || undefined;
    const applyUrl = `${baseUrl}/en-US${posting.externalPath}`;

    // Extract description from bullet fields
    const description = posting.bulletFields?.join("\n") || posting.title;

    // Extract skills from description
    const skills = this.extractHealthcareSkills(description + " " + posting.title);

    // Parse posted date
    const postedAt = posting.postedOn ? new Date(posting.postedOn) : undefined;

    return {
      externalId: `workday-${company.subdomain}-${posting.externalPath.replace(/\//g, "-")}`,
      title: posting.title,
      company: company.name,
      location,
      remote: location?.toLowerCase().includes("remote") ?? false,
      jobType: "FULL_TIME",
      description,
      skills,
      applyUrl,
      postedAt,
    };
  }

  /** Extract healthcare-specific skills from text */
  private extractHealthcareSkills(text: string): string[] {
    const healthcareSkills = [
      "Epic", "Cerner", "MEDITECH", "Allscripts", "athenahealth",
      "ICD-10", "CPT", "HCPCS", "Medical Coding", "Medical Billing",
      "Insurance Verification", "Prior Authorization", "Revenue Cycle",
      "Patient Access", "Benefits Verification", "Claims Processing",
      "HIPAA", "PHI", "EHR", "EMR", "HL7", "FHIR",
      "Microsoft Office", "Excel", "Word", "PowerPoint",
      "Customer Service", "Data Entry", "Medical Terminology",
      "Healthcare", "Clinical", "Pharmacy", "Laboratory",
      "RCM", "Denial Management", "AR Follow-up",
      "Eligibility", "Enrollment", "Credentialing",
    ];

    const lowerText = text.toLowerCase();
    return healthcareSkills.filter((skill) =>
      lowerText.includes(skill.toLowerCase())
    );
  }
}
