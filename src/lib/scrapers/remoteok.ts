import { BaseScraper, type RawJob } from "./base-scraper";

interface RemoteOKJob {
  id: string;
  epoch: number;
  date: string;
  company: string;
  company_logo?: string;
  position: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url: string;
}

export class RemoteOKScraper extends BaseScraper {
  source = "REMOTEOK";

  private lastRequestTime = 0;
  private minRequestInterval = 3000; // 3 seconds between requests

  async scrape(query: string, _location?: string): Promise<RawJob[]> {
    await this.rateLimit();

    try {
      // RemoteOK API: https://remoteok.com/api returns all jobs
      // Adding tag filter narrows results
      const params = query
        ? `?tag=${encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-"))}`
        : "";
      const url = `https://remoteok.com/api${params}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "iAutoApply/1.0 (job-search-aggregator; contact@iautoapply.com)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("RemoteOK rate limited, backing off...");
          await this.delay(10000);
          return [];
        }
        throw new Error(`RemoteOK API error: ${response.status}`);
      }

      const text = await response.text();
      let data: RemoteOKJob[];

      try {
        data = JSON.parse(text);
      } catch {
        console.error("RemoteOK returned invalid JSON");
        return [];
      }

      if (!Array.isArray(data)) {
        console.error("RemoteOK returned non-array response");
        return [];
      }

      // First element is metadata/legal notice, skip it
      const jobs = data.slice(1);

      return jobs
        .filter(
          (job) =>
            job.position &&
            job.company &&
            typeof job.id !== "undefined"
        )
        .slice(0, 100) // Cap at 100 jobs per scrape
        .map((job) => this.mapToRawJob(job));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("RemoteOK request timed out");
      } else {
        console.error("RemoteOK scraping error:", error);
      }
      return [];
    }
  }

  private mapToRawJob(job: RemoteOKJob): RawJob {
    const description = job.description || "";
    const cleanDescription = this.stripHtml(description);

    return {
      externalId: `remoteok-${job.id}`,
      title: job.position,
      company: job.company,
      companyLogo: job.company_logo || undefined,
      location: job.location || "Remote",
      remote: true, // All RemoteOK jobs are remote
      jobType: "FULL_TIME",
      description: cleanDescription,
      skills:
        job.tags && job.tags.length > 0
          ? job.tags
          : this.extractSkills(cleanDescription),
      salaryMin: job.salary_min || undefined,
      salaryMax: job.salary_max || undefined,
      applyUrl: job.url || `https://remoteok.com/l/${job.id}`,
      postedAt: job.epoch
        ? new Date(job.epoch * 1000)
        : job.date
        ? new Date(job.date)
        : undefined,
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
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
