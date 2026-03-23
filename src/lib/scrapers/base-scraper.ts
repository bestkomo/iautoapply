export interface RawJob {
  externalId: string;
  title: string;
  company: string;
  companyLogo?: string;
  location?: string;
  remote: boolean;
  jobType: string;
  description: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills: string[];
  applyUrl: string;
  postedAt?: Date;
}

export abstract class BaseScraper {
  abstract source: string;
  abstract scrape(query: string, location?: string): Promise<RawJob[]>;

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected extractSkills(text: string): string[] {
    const commonSkills = [
      "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust",
      "Ruby", "PHP", "Swift", "Kotlin", "React", "Angular", "Vue", "Next.js",
      "Node.js", "Express", "Django", "Flask", "Spring", "Rails",
      "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
      "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
      "Git", "CI/CD", "REST", "GraphQL", "gRPC",
      "Machine Learning", "AI", "Data Science", "Deep Learning",
      "Figma", "CSS", "HTML", "Tailwind", "SASS",
      "Agile", "Scrum", "Jira", "Linux", "DevOps",
    ];

    const lowerText = text.toLowerCase();
    return commonSkills.filter((skill) =>
      lowerText.includes(skill.toLowerCase())
    );
  }

  protected parseSalary(text: string): { min?: number; max?: number } {
    // Match patterns like "$100k-$150k", "$100,000 - $150,000", "100k"
    const rangeMatch = text.match(
      /\$?([\d,]+)\s*k?\s*[-–to]+\s*\$?([\d,]+)\s*k?/i
    );
    if (rangeMatch) {
      let min = parseInt(rangeMatch[1].replace(/,/g, ""));
      let max = parseInt(rangeMatch[2].replace(/,/g, ""));
      // If values are small, they're in thousands
      if (min < 1000) min *= 1000;
      if (max < 1000) max *= 1000;
      return { min, max };
    }

    const singleMatch = text.match(/\$?([\d,]+)\s*k?/i);
    if (singleMatch) {
      let val = parseInt(singleMatch[1].replace(/,/g, ""));
      if (val < 1000) val *= 1000;
      return { min: val, max: val };
    }

    return {};
  }
}
