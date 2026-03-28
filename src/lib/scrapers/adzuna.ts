import { BaseScraper, type RawJob } from "./base-scraper";

interface AdzunaJob {
  id: string;
  title: string;
  company: {
    display_name: string;
  };
  location: {
    display_name: string;
    area?: string[];
  };
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  description: string;
  created: string;
  category?: {
    label: string;
    tag: string;
  };
  contract_type?: string;
  contract_time?: string;
  latitude?: number;
  longitude?: number;
}

interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
  mean: number;
}

/**
 * Adzuna Job Search API Scraper
 *
 * Free tier: 2,500 requests/month, 250/day, 25/minute
 * Endpoint: https://api.adzuna.com/v1/api/jobs/us/search/{page}
 * Requires ADZUNA_APP_ID and ADZUNA_APP_KEY env vars
 */
export class AdzunaScraper extends BaseScraper {
  source = "ADZUNA";

  async scrape(query: string, location?: string): Promise<RawJob[]> {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      console.log("[Adzuna] Skipping - ADZUNA_APP_ID or ADZUNA_APP_KEY not set");
      return [];
    }

    const allJobs: RawJob[] = [];
    const maxPages = 2; // 2 pages × 50 results = 100 jobs max

    for (let page = 1; page <= maxPages; page++) {
      try {
        const jobs = await this.fetchPage(query, location, page, appId, appKey);
        allJobs.push(...jobs);

        if (jobs.length < 50) break; // No more results
        if (page < maxPages) await this.delay(1000); // Rate limit: 25/minute
      } catch (err) {
        console.error(`[Adzuna] Page ${page} error:`, err);
        break;
      }
    }

    console.log(`[Adzuna] Total: ${allJobs.length} jobs for "${query}"`);
    return allJobs;
  }

  private async fetchPage(
    query: string,
    location: string | undefined,
    page: number,
    appId: string,
    appKey: string,
  ): Promise<RawJob[]> {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: "50",
      what: query,
      sort_by: "date",
      max_days_old: "14", // Only jobs from last 2 weeks
      content_type: "application/json",
    });

    if (location) {
      params.set("where", location);
    }

    const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (res.status === 429) {
        console.warn("[Adzuna] Rate limited (429)");
        return [];
      }

      if (!res.ok) {
        console.error(`[Adzuna] HTTP ${res.status}`);
        return [];
      }

      const data: AdzunaResponse = await res.json();
      const jobs: RawJob[] = [];

      for (const job of data.results || []) {
        if (!job.title || !job.company?.display_name) continue;

        const locationStr = job.location?.display_name || "";
        const isRemote =
          locationStr.toLowerCase().includes("remote") ||
          job.title.toLowerCase().includes("remote") ||
          job.description?.toLowerCase().includes("fully remote") ||
          false;

        const salary = this.extractSalary(job);

        jobs.push({
          externalId: `adzuna-${job.id}`,
          title: job.title,
          company: job.company.display_name,
          location: locationStr || undefined,
          remote: isRemote,
          jobType: this.mapJobType(job.contract_time, job.contract_type),
          description: this.stripHtml(job.description || ""),
          salaryMin: salary.min,
          salaryMax: salary.max,
          skills: this.extractHealthcareSkills(job.description || ""),
          applyUrl: job.redirect_url,
          postedAt: job.created ? new Date(job.created) : undefined,
        });
      }

      console.log(`[Adzuna] Page ${page}: ${jobs.length} jobs`);
      return jobs;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractSalary(job: AdzunaJob): { min?: number; max?: number } {
    // Skip predicted salaries - only use actual salary data
    if (job.salary_is_predicted === "1") return {};

    const min = job.salary_min ? Math.round(job.salary_min) : undefined;
    const max = job.salary_max ? Math.round(job.salary_max) : undefined;

    // Sanity check: skip unreasonable values
    if (min && min < 15000) return {};
    if (max && max > 500000) return {};

    return { min, max };
  }

  private mapJobType(contractTime?: string, contractType?: string): string {
    if (contractTime === "full_time") return "FULL_TIME";
    if (contractTime === "part_time") return "PART_TIME";
    if (contractType === "contract") return "CONTRACT";
    if (contractType === "permanent") return "FULL_TIME";
    return "FULL_TIME";
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract both tech and healthcare-specific skills from job description
   */
  private extractHealthcareSkills(text: string): string[] {
    const healthcareSkills = [
      "Epic", "Cerner", "MEDITECH", "Athenahealth", "eClinicalWorks",
      "ICD-10", "CPT", "HCPCS", "ICD-9",
      "HIPAA", "PHI", "EMR", "EHR", "HIS",
      "Medical Coding", "Medical Billing", "Revenue Cycle",
      "Insurance Verification", "Prior Authorization", "Benefits Verification",
      "Patient Access", "Patient Registration", "Scheduling",
      "Claims Processing", "Denial Management", "Appeals",
      "Medicare", "Medicaid", "Commercial Insurance",
      "Managed Care", "HMO", "PPO",
      "Medical Terminology", "Anatomy", "Physiology",
      "FHIR", "HL7", "CMS",
      "Customer Service", "Data Entry", "Microsoft Office",
      "Excel", "Word", "Outlook",
    ];

    const lowerText = text.toLowerCase();
    const found = healthcareSkills.filter((skill) =>
      lowerText.includes(skill.toLowerCase())
    );

    // Also include base tech skills
    const baseSkills = this.extractSkills(text);
    return [...new Set([...found, ...baseSkills])];
  }
}
