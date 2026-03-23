"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Clock,
  Heart,
  DollarSign,
  Wifi,
  Zap,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface JobCardData {
  id: string;
  title: string;
  company: string;
  companyLogo?: string | null;
  location?: string | null;
  remote: boolean;
  jobType: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  skills: string[];
  source: string;
  url?: string | null;
  description?: string | null;
  postedAt?: string | null;
  matchScore?: number | null;
  isSaved?: boolean;
  isApplied?: boolean;
}

interface JobCardProps {
  job: JobCardData;
  onToggleSave?: (jobId: string) => void;
  onQuickApply?: (jobId: string) => void;
  onSelect?: (job: JobCardData) => void;
  applyingId?: string | null;
  failedId?: string | null;
}

function formatSalary(
  min?: number | null,
  max?: number | null,
  currency?: string | null
): string {
  const fmt = (n: number) => {
    if (n >= 1000) return `$${Math.round(n / 1000)}K`;
    return `$${n}`;
  };
  if (min && max && min !== max) return `${fmt(min)} - ${fmt(max)}/yr`;
  if (min) return `${fmt(min)}+/yr`;
  if (max) return `Up to ${fmt(max)}/yr`;
  return "";
}

function formatPostedDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const posted = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Posted today";
  if (diffDays === 1) return "Posted yesterday";
  if (diffDays < 7) return `Posted ${diffDays} days ago`;
  if (diffDays < 30) return `Posted ${Math.floor(diffDays / 7)}w ago`;
  // For older posts, show the date
  return `Posted ${posted.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function getMatchScoreColor(score: number): string {
  if (score >= 80)
    return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20";
  if (score >= 60)
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
  return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20";
}

const LOGO_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
];

function getLogoColor(company: string): string {
  let hash = 0;
  for (let i = 0; i < company.length; i++) {
    hash = company.charCodeAt(i) + ((hash << 5) - hash);
  }
  return LOGO_COLORS[Math.abs(hash) % LOGO_COLORS.length];
}

const SOURCE_LABELS: Record<string, string> = {
  INDEED: "Indeed",
  LINKEDIN: "LinkedIn",
  GLASSDOOR: "Glassdoor",
  REMOTEOK: "RemoteOK",
  WEWORKREMOTELY: "WWR",
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  ARBEITNOW: "ArbeitNow",
  JOBICY: "Jobicy",
  THEMUSE: "The Muse",
  REMOTIVE: "Remotive",
  HIMALAYAS: "Himalayas",
  FINDWORK: "Findwork",
  JSEARCH: "JSearch",
  MANUAL: "Manual",
};

// Publisher colors for prominent display of real job board sources
const PUBLISHER_COLORS: Record<string, string> = {
  Indeed: "bg-blue-600 text-white",
  LinkedIn: "bg-[#0A66C2] text-white",
  Glassdoor: "bg-green-600 text-white",
  ZipRecruiter: "bg-emerald-600 text-white",
  Monster: "bg-purple-600 text-white",
};

/**
 * Extract the original publisher from JSearch description prefix.
 * JSearch embeds "[Source: Indeed]" etc. at the start of descriptions.
 */
function extractPublisher(description?: string | null): string | null {
  if (!description) return null;
  const match = description.match(/^\[Source:\s*([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

/**
 * Strip the publisher prefix from description for clean display.
 */
function stripPublisherPrefix(description?: string | null): string {
  if (!description) return "";
  return description.replace(/^\[Source:\s*[^\]]+\]\s*/, "");
}

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  INTERNSHIP: "Internship",
};

export function JobCard({
  job,
  onToggleSave,
  onQuickApply,
  onSelect,
  applyingId,
  failedId,
}: JobCardProps) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const postedDate = formatPostedDate(job.postedAt);
  const isApplying = applyingId === job.id;
  const hasFailed = failedId === job.id;
  const publisher = extractPublisher(job.description);
  const isJSearchJob = job.source === "JSEARCH" || !!publisher;

  return (
    <Card className="group hover:border-primary/50 hover:shadow-md transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left side: logo + info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Company logo / letter avatar */}
            {job.companyLogo ? (
              <img
                src={job.companyLogo}
                alt={job.company}
                className="h-12 w-12 rounded-xl object-contain bg-accent p-1.5 shrink-0"
              />
            ) : (
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-lg ${getLogoColor(job.company)}`}
              >
                {job.company.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {job.url ? (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold hover:text-primary hover:underline transition-colors line-clamp-1 text-left"
                  >
                    {job.title}
                  </a>
                ) : (
                  <button
                    onClick={() => onSelect?.(job)}
                    className="text-base font-semibold hover:text-primary transition-colors line-clamp-1 text-left"
                  >
                    {job.title}
                  </button>
                )}
                {job.matchScore != null && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold shrink-0 ${getMatchScoreColor(job.matchScore)}`}
                  >
                    {job.matchScore}% match
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {job.company}
              </p>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-1">{job.location}</span>
                  </span>
                )}
                {job.remote && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0 h-5"
                  >
                    <Wifi className="h-3 w-3 mr-1" />
                    Remote
                  </Badge>
                )}
                {salary && (
                  <span className="flex items-center gap-1 font-semibold text-green-700 dark:text-green-400">
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    {salary}
                  </span>
                )}
                {postedDate && (
                  <span className="flex items-center gap-1 text-foreground/70">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {postedDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right side: actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {onToggleSave && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(job.id);
                }}
                title={job.isSaved ? "Unsave" : "Save"}
              >
                <Heart
                  className={`h-4 w-4 transition-colors ${
                    job.isSaved
                      ? "fill-red-500 text-red-500"
                      : "text-muted-foreground hover:text-red-400"
                  }`}
                />
              </Button>
            )}
          </div>
        </div>

        {/* Skills */}
        {job.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {job.skills.slice(0, 6).map((skill) => (
              <Badge
                key={skill}
                variant="outline"
                className="text-xs font-normal"
              >
                {skill}
              </Badge>
            ))}
            {job.skills.length > 6 && (
              <Badge variant="outline" className="text-xs font-normal">
                +{job.skills.length - 6}
              </Badge>
            )}
          </div>
        )}

        {/* Footer: source badges + quick apply */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            {publisher ? (
              <Badge
                className={`text-xs font-semibold ${PUBLISHER_COLORS[publisher] || "bg-gray-600 text-white"}`}
              >
                via {publisher}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                {SOURCE_LABELS[job.source] || job.source}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {JOB_TYPE_LABELS[job.jobType] || job.jobType}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center h-8 px-3 text-xs font-medium text-primary border border-primary/30 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Go to Listing
              </a>
            )}
            {onQuickApply && (
              hasFailed ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" />
                    Failed
                  </span>
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center h-8 px-2.5 text-xs text-primary hover:underline"
                    >
                      Try manually
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  className={`h-8 text-xs gap-1.5 ${
                    job.isApplied
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : ""
                  }`}
                  disabled={isApplying || job.isApplied}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickApply(job.id);
                  }}
                >
                  {isApplying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : job.isApplied ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  {job.isApplied
                    ? "Applied!"
                    : isApplying
                      ? "Applying..."
                      : "Auto Apply"}
                </Button>
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* Skeleton loader for job cards */
export function JobCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
            <div className="flex gap-3">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
          </div>
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
