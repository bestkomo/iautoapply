import type { Job, JobPreference } from "@prisma/client";
import { fromJsonArray } from "@/lib/db/json-array";

export interface MatchBreakdown {
  titleScore: number;
  skillsScore: number;
  locationScore: number;
  salaryScore: number;
}

export interface MatchResult {
  score: number;
  breakdown: MatchBreakdown;
}

export function computeMatchScore(
  job: Job,
  preferences: JobPreference
): MatchResult {
  const jobSkills = fromJsonArray(job.skills as string);
  const prefDesiredTitles = fromJsonArray(preferences.desiredTitles as string);
  const prefSkills = fromJsonArray(preferences.skills as string);
  const prefDesiredLocations = fromJsonArray(preferences.desiredLocations as string);

  const breakdown: MatchBreakdown = {
    titleScore: computeTitleScore(job.title, prefDesiredTitles),
    skillsScore: computeSkillsScore(jobSkills, prefSkills),
    locationScore: computeLocationScore(
      job.location,
      job.remote,
      prefDesiredLocations,
      preferences.remoteOnly
    ),
    salaryScore: computeSalaryScore(
      job.salaryMin,
      job.salaryMax,
      preferences.salaryMin
    ),
  };

  // Weighted score: title 30%, skills 30%, location 20%, salary 20%
  let score = Math.round(
    breakdown.titleScore * 0.3 +
      breakdown.skillsScore * 0.3 +
      breakdown.locationScore * 0.2 +
      breakdown.salaryScore * 0.2
  );

  // Boost jobs hosted on supported ATS platforms (we can reliably auto-apply)
  if (isAutoApplySupported(job)) {
    score += 10;
  }

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

/**
 * Returns true if this job's apply URL is on a platform we have a robust
 * auto-apply handler for (Greenhouse, Lever, Workday, etc.).
 */
export function isAutoApplySupported(job: { applyUrl?: string | null }): boolean {
  const url = (job.applyUrl || "").toLowerCase();
  if (!url) return false;
  return (
    url.includes("greenhouse.io") ||
    url.includes("job-boards.greenhouse.io") ||
    url.includes("lever.co") ||
    url.includes("myworkdayjobs.com") ||
    url.includes("workday.com") ||
    url.includes("smartrecruiters.com") ||
    url.includes("icims.com")
  );
}

function computeTitleScore(
  jobTitle: string,
  desiredTitles: string[]
): number {
  if (desiredTitles.length === 0) return 50; // Neutral if no preference

  const normalizedJobTitle = jobTitle.toLowerCase().trim();

  let bestScore = 0;
  for (const desired of desiredTitles) {
    const normalizedDesired = desired.toLowerCase().trim();

    // Exact match
    if (normalizedJobTitle === normalizedDesired) return 100;

    // Contains full desired title
    if (normalizedJobTitle.includes(normalizedDesired)) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }

    // Check word overlap (fuzzy matching)
    const jobWords = normalizedJobTitle.split(/\s+/);
    const desiredWords = normalizedDesired.split(/\s+/);
    const matchingWords = desiredWords.filter((w) =>
      jobWords.some(
        (jw) => jw === w || jw.includes(w) || w.includes(jw)
      )
    );
    const overlapRatio =
      desiredWords.length > 0 ? matchingWords.length / desiredWords.length : 0;
    bestScore = Math.max(bestScore, Math.round(overlapRatio * 80));
  }

  return bestScore;
}

function computeSkillsScore(
  jobSkills: string[],
  preferredSkills: string[]
): number {
  if (preferredSkills.length === 0 || jobSkills.length === 0) return 50;

  const normalizedJobSkills = jobSkills.map((s) => s.toLowerCase().trim());
  const normalizedPreferred = preferredSkills.map((s) =>
    s.toLowerCase().trim()
  );

  const matchCount = normalizedPreferred.filter((skill) =>
    normalizedJobSkills.some(
      (js) => js === skill || js.includes(skill) || skill.includes(js)
    )
  ).length;

  const ratio = matchCount / normalizedPreferred.length;
  return Math.round(ratio * 100);
}

function computeLocationScore(
  jobLocation: string | null,
  jobRemote: boolean,
  desiredLocations: string[],
  remoteOnly: boolean
): number {
  // If user wants remote only
  if (remoteOnly) {
    return jobRemote ? 100 : 0;
  }

  // If job is remote, it's always a good match
  if (jobRemote) return 100;

  // No location preference
  if (desiredLocations.length === 0) return 50;

  if (!jobLocation) return 30;

  const normalizedJobLocation = jobLocation.toLowerCase().trim();

  for (const desired of desiredLocations) {
    const normalizedDesired = desired.toLowerCase().trim();
    if (
      normalizedJobLocation.includes(normalizedDesired) ||
      normalizedDesired.includes(normalizedJobLocation)
    ) {
      return 100;
    }
  }

  return 20;
}

function computeSalaryScore(
  jobSalaryMin: number | null,
  jobSalaryMax: number | null,
  preferredMin: number | null
): number {
  // No salary info or no preference - neutral
  if (!preferredMin) return 50;
  if (!jobSalaryMin && !jobSalaryMax) return 40;

  const jobMax = jobSalaryMax || jobSalaryMin || 0;
  const jobMin = jobSalaryMin || jobSalaryMax || 0;

  // Job pays above minimum
  if (jobMax >= preferredMin) return 100;
  if (jobMin >= preferredMin) return 90;

  // Job pays close to minimum (within 20%)
  const ratio = jobMax / preferredMin;
  if (ratio >= 0.8) return Math.round(ratio * 80);

  return Math.round(ratio * 50);
}
