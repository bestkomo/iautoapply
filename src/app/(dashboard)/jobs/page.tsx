"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  JobCard,
  JobCardSkeleton,
  type JobCardData,
} from "@/components/jobs/job-card";
import { JobFiltersPanel, type JobFilters } from "@/components/jobs/job-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Loader2,
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  Clock,
  DollarSign,
  Wifi,
  Zap,
  Briefcase,
  ExternalLink,
  Globe,
  ChevronDown,
} from "lucide-react";

const DEFAULT_FILTERS: JobFilters = {
  q: "",
  location: "",
  remote: false,
  sources: [],
  jobTypes: [],
  salaryMin: "",
  salaryMax: "",
};

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function JobBoardPage() {
  const [jobs, setJobs] = useState<JobCardData[]>([]);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{
    scraped: number;
    sources: string[];
    errors: string[];
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobCardData | null>(null);
  const [jobDetail, setJobDetail] = useState<Record<string, unknown> | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const initialLoad = useRef(true);

  const buildParams = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.location) params.set("location", filters.location);
      if (filters.remote) params.set("remote", "true");
      if (filters.sources.length)
        params.set("source", filters.sources.join(","));
      if (filters.jobTypes.length)
        params.set("jobType", filters.jobTypes.join(","));
      if (filters.salaryMin) params.set("salaryMin", filters.salaryMin);
      if (filters.salaryMax) params.set("salaryMax", filters.salaryMax);
      params.set("sort", sort);
      params.set("page", pageNum.toString());
      params.set("limit", "20");
      return params;
    },
    [filters, sort]
  );

  const fetchJobs = useCallback(
    async (pageNum = 1, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params = buildParams(pageNum);
        const res = await fetch(`/api/jobs?${params.toString()}`);
        const data = await res.json();
        const newJobs: JobCardData[] = (data.jobs || []).map((j: Record<string, unknown>) => ({
          ...j,
          url: j.url || j.applyUrl || null,
        }));
        if (append) {
          setJobs((prev) => [...prev, ...newJobs]);
        } else {
          setJobs(newJobs);
        }
        setPagination(data.pagination || null);
        setPage(pageNum);
      } catch {
        if (!append) setJobs([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildParams]
  );

  // Auto-fetch on load
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      fetchJobs(1);
      return;
    }
    const debounce = setTimeout(() => fetchJobs(1), 300);
    return () => clearTimeout(debounce);
  }, [fetchJobs]);

  // Search + scrape flow
  async function handleSearch() {
    if (!searchQuery.trim()) return;

    // 1. Update filter to search existing DB
    setFilters((prev) => ({ ...prev, q: searchQuery }));

    // 2. Trigger scrape in background
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch("/api/jobs/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          location: filters.location || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.scraped > 0) {
        setScrapeResult({
          scraped: data.scraped,
          sources: data.sources || [],
          errors: data.errors || [],
        });
        // Refresh results to include scraped jobs
        fetchJobs(1);
      } else if (res.ok) {
        setScrapeResult(null);
      } else {
        setScrapeResult({
          scraped: 0,
          sources: [],
          errors: [data.error || "Scraping failed"],
        });
      }
    } catch {
      // Silently fail - DB search still works
    } finally {
      setScraping(false);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  function handleLoadMore() {
    if (pagination && page < pagination.totalPages) {
      fetchJobs(page + 1, true);
    }
  }

  async function handleToggleSave(jobId: string) {
    const res = await fetch("/api/jobs/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (res.ok) {
      const { saved } = await res.json();
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, isSaved: saved } : j))
      );
    }
  }

  async function handleQuickApply(jobId: string) {
    setApplyingId(jobId);
    setFailedId(null);
    try {
      const res = await fetch("/api/applications/apply-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, isApplied: true } : j
          )
        );
      } else if (res.status === 409) {
        // Already applied
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, isApplied: true } : j
          )
        );
      } else {
        setFailedId(jobId);
      }
    } catch {
      setFailedId(jobId);
    } finally {
      setApplyingId(null);
    }
  }

  async function handleSelectJob(job: JobCardData) {
    setSelectedJob(job);
    setJobDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (res.ok) {
        const data = await res.json();
        setJobDetail(data);
      }
    } catch {
      // Use what we have from the card
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleFilterChange(newFilters: JobFilters) {
    setFilters(newFilters);
    setPage(1);
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  const hasMore = pagination ? page < pagination.totalPages : false;
  const totalJobs = pagination?.total ?? 0;

  const activeFilterCount =
    (filters.remote ? 1 : 0) +
    filters.sources.length +
    filters.jobTypes.length +
    (filters.salaryMin ? 1 : 0) +
    (filters.salaryMax ? 1 : 0) +
    (filters.location ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Board</h1>
        <p className="text-muted-foreground mt-1">
          Find and apply to jobs from all major platforms
        </p>
      </div>

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs (e.g. React developer, Python engineer)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10 h-11"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={scraping}
          className="h-11 px-6 gap-2 shrink-0"
        >
          {scraping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Search Jobs
        </Button>
      </div>

      {/* Scraping indicator */}
      {scraping && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg px-4 py-2.5">
          <Globe className="h-4 w-4 animate-pulse text-primary" />
          <span>Searching for more jobs online...</span>
        </div>
      )}

      {/* Scrape result banner */}
      {scrapeResult && scrapeResult.scraped > 0 && (
        <div className="flex items-center justify-between bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 rounded-lg px-4 py-2.5 text-sm">
          <p>
            Found <strong>{scrapeResult.scraped}</strong> new job
            {scrapeResult.scraped !== 1 ? "s" : ""} from{" "}
            <strong>{scrapeResult.sources.join(", ")}</strong>
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setScrapeResult(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Toolbar: job count, sort, mobile filter toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden gap-2"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading..."
              : `${totalJobs} job${totalJobs !== 1 ? "s" : ""} found`}
          </p>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v ?? "date")}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Newest first</SelectItem>
            <SelectItem value="relevance">Best match</SelectItem>
            <SelectItem value="salary">Highest salary</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile filters (collapsible) */}
      {showMobileFilters && (
        <div className="lg:hidden">
          <JobFiltersPanel
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Desktop filters sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <JobFiltersPanel
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleReset}
            />
          </div>
        </div>

        {/* Job listings */}
        <div className="space-y-3">
          {loading ? (
            /* Skeleton loading state */
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20 border rounded-lg bg-card">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-lg font-medium mt-4">No jobs found</p>
              <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                Try searching for a different role or adjusting your filters
              </p>
              <Button
                className="mt-6 gap-2"
                onClick={() => {
                  setSearchQuery("software engineer");
                  handleSearch();
                }}
              >
                <Search className="h-4 w-4" />
                Search for Software Engineer jobs
              </Button>
            </div>
          ) : (
            <>
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onToggleSave={handleToggleSave}
                  onQuickApply={handleQuickApply}
                  onSelect={handleSelectJob}
                  applyingId={applyingId}
                  failedId={failedId}
                />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 w-full sm:w-auto"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    {loadingMore
                      ? "Loading more..."
                      : `Load More (${totalJobs - jobs.length} remaining)`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Job detail slide-over Sheet */}
      <Sheet
        open={!!selectedJob}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
            setJobDetail(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto"
        >
          {selectedJob && (
            <>
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-start gap-3 pr-8">
                  {selectedJob.companyLogo ? (
                    <img
                      src={selectedJob.companyLogo}
                      alt={selectedJob.company}
                      className="h-12 w-12 rounded-xl object-contain bg-accent p-1.5 shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-lg">
                      {selectedJob.company.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg leading-tight">
                      {selectedJob.title}
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {selectedJob.company}
                    </SheetDescription>
                  </div>
                </div>

                {/* Match score */}
                {(jobDetail as Record<string, unknown>)?.matchScore != null && (
                  <div className="mt-3">
                    <Badge
                      variant="outline"
                      className="text-sm font-semibold bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                    >
                      {(jobDetail as Record<string, unknown>).matchScore as number}% Match
                    </Badge>
                  </div>
                )}

                {/* Meta info */}
                <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                  {selectedJob.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {selectedJob.location}
                    </span>
                  )}
                  {selectedJob.remote && (
                    <Badge variant="secondary" className="text-xs">
                      <Wifi className="h-3 w-3 mr-1" />
                      Remote
                    </Badge>
                  )}
                  {(selectedJob.salaryMin || selectedJob.salaryMax) && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {formatSalaryDisplay(
                        selectedJob.salaryMin,
                        selectedJob.salaryMax,
                        selectedJob.salaryCurrency
                      )}
                    </span>
                  )}
                  {selectedJob.postedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Posted {formatDateDisplay(selectedJob.postedAt)}
                    </span>
                  )}
                </div>
              </SheetHeader>

              {/* Detail body */}
              <div className="py-6 space-y-6 flex-1">
                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2"
                    disabled={applyingId === selectedJob.id || selectedJob.isApplied}
                    onClick={() => handleQuickApply(selectedJob.id)}
                  >
                    {applyingId === selectedJob.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {selectedJob.isApplied
                      ? "Already Applied"
                      : applyingId === selectedJob.id
                        ? "Applying..."
                        : "Auto Apply"}
                  </Button>
                  {selectedJob.url && (
                    <a
                      href={selectedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Original
                    </a>
                  )}
                </div>

                {/* Skills */}
                {selectedJob.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Required Skills
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.skills.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">
                    Job Description
                  </h3>
                  {loadingDetail ? (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-4 bg-muted animate-pulse rounded"
                          style={{ width: `${70 + Math.random() * 30}%` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {(jobDetail as Record<string, unknown>)?.description
                        ? String((jobDetail as Record<string, unknown>).description)
                        : selectedJob.description ||
                          "No description available. Click 'View Original' to see the full listing."}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Helper functions for the detail panel
function formatSalaryDisplay(
  min?: number | null,
  max?: number | null,
  currency?: string | null
): string {
  const fmt = (n: number) => {
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  };
  const cur = currency || "USD";
  if (min && max && min !== max)
    return `${fmt(min)} - ${fmt(max)} ${cur}`;
  if (min) return `${fmt(min)}+ ${cur}`;
  if (max) return `Up to ${fmt(max)} ${cur}`;
  return "";
}

function formatDateDisplay(dateStr: string): string {
  const posted = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}
