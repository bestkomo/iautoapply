"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
  Briefcase,
  GraduationCap,
  Wrench,
  ArrowRight,
  Search,
  Zap,
  User,
  AlertCircle,
  ShieldCheck,
  Building2,
  MapPin,
  TrendingUp,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParsedResult = {
  name: string;
  headline: string;
  experienceCount: number;
  educationCount: number;
  skillCount: number;
  desiredTitles: string[];
};

type StepDef = {
  label: string;
  activeLabel: string;
  doneLabel: string;
  icon: typeof Upload;
};

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS: StepDef[] = [
  {
    label: "Upload resume",
    activeLabel: "Uploading your resume...",
    doneLabel: "Resume uploaded",
    icon: Upload,
  },
  {
    label: "AI parsing",
    activeLabel: "AI is reading your resume...",
    doneLabel: "Resume parsed",
    icon: FileText,
  },
  {
    label: "Extract details",
    activeLabel: "Extracting skills & experience...",
    doneLabel: "Details extracted",
    icon: Sparkles,
  },
  {
    label: "Find jobs",
    activeLabel: "Searching for matching jobs...",
    doneLabel: "Matching jobs found",
    icon: Search,
  },
  {
    label: "Ready",
    activeLabel: "Finalizing...",
    doneLabel: "Ready to auto-apply!",
    icon: CheckCircle2,
  },
];

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useAnimatedCount(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    let start = 0;
    const increment = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepCard({
  step,
  index,
  currentStep,
  jobsFound,
}: {
  step: StepDef;
  index: number;
  currentStep: number;
  jobsFound: number | null;
}) {
  const isActive = index === currentStep;
  const isComplete = index < currentStep;
  const isPending = index > currentStep;
  const Icon = step.icon;

  return (
    <div
      className={`
        flex items-center gap-4 rounded-xl border px-4 py-3
        transition-all duration-500 ease-out
        ${
          isActive
            ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10 scale-[1.02]"
            : isComplete
            ? "border-green-500/30 bg-green-500/5"
            : "border-transparent bg-muted/30"
        }
      `}
      style={{
        opacity: isPending ? 0.4 : 1,
        transitionDelay: `${index * 60}ms`,
      }}
    >
      {/* Icon circle */}
      <div
        className={`
          flex h-9 w-9 shrink-0 items-center justify-center rounded-full
          transition-all duration-500
          ${
            isActive
              ? "bg-primary/20 text-primary"
              : isComplete
              ? "bg-green-500/20 text-green-500"
              : "bg-muted text-muted-foreground/50"
          }
        `}
      >
        {isComplete ? (
          <CheckCircle2 className="h-4.5 w-4.5" />
        ) : isActive ? (
          <Loader2 className="h-4.5 w-4.5 animate-spin" />
        ) : (
          <Icon className="h-4.5 w-4.5" />
        )}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium transition-colors duration-300 ${
            isActive
              ? "text-foreground"
              : isComplete
              ? "text-green-600 dark:text-green-400"
              : "text-muted-foreground/60"
          }`}
        >
          {isComplete
            ? step.doneLabel
            : isActive
            ? step.activeLabel
            : step.label}
        </p>
        {/* Sub-info for the jobs step */}
        {index === 3 && isComplete && jobsFound !== null && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            {jobsFound} job{jobsFound !== 1 ? "s" : ""} found
          </p>
        )}
      </div>

      {/* Status badge */}
      {isComplete && (
        <Badge
          variant="secondary"
          className="bg-green-500/10 text-green-600 dark:text-green-400 border-0 text-xs"
        >
          Done
        </Badge>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  delay,
}: {
  icon: typeof User;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

function JobPreviewCard({
  title,
  index,
}: {
  title: string;
  index: number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-card p-4 animate-in fade-in slide-in-from-bottom-3 duration-500"
      style={{
        animationDelay: `${200 + index * 120}ms`,
        animationFillMode: "both",
      }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
        <Building2 className="h-5 w-5 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Jobs scraped for this title
        </p>
      </div>
      <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UploadResumePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [jobsFound, setJobsFound] = useState<number | null>(null);

  const animatedJobCount = useAnimatedCount(jobsFound ?? 0);

  // -------------------------------------------------------------------------
  // Job scraping
  // -------------------------------------------------------------------------

  const scrapeJobsForTitles = useCallback(
    async (titles: string[]): Promise<number> => {
      if (!titles || titles.length === 0) return 0;

      let totalFound = 0;

      try {
        const titleQueries = titles.slice(0, 3);
        const results = await Promise.allSettled(
          titleQueries.map((title) =>
            fetch("/api/jobs/scrape", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: title }),
            }).then((res) => res.json())
          )
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value.scraped) {
            totalFound += result.value.scraped;
          }
        }
      } catch (err) {
        console.error("Job scraping after upload failed:", err);
      }

      return totalFound;
    },
    []
  );

  // -------------------------------------------------------------------------
  // File processing
  // -------------------------------------------------------------------------

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      setFileName(file.name);
      setIsUploading(true);
      setCurrentStep(0);
      setJobsFound(null);

      const formData = new FormData();
      formData.append("resume", file);

      // Animate through initial steps
      const stepTimer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < 2) return prev + 1;
          return prev;
        });
      }, 1500);

      try {
        const res = await fetch("/api/resume/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(stepTimer);

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Upload failed. Please try again.");
          setIsUploading(false);
          setCurrentStep(-1);
          return;
        }

        const parsed = data.parsed as ParsedResult;

        // Move to "Searching for matching jobs..." step
        setCurrentStep(3);

        // Trigger job scraping (non-blocking - don't fail upload if scraping fails)
        try {
          const found = await scrapeJobsForTitles(parsed.desiredTitles);
          setJobsFound(found);
        } catch {
          // Scraping failed but upload succeeded - show existing job count
          setJobsFound(0);
        }

        // Complete
        setCurrentStep(4);
        setResult(parsed);
        setIsUploading(false);
      } catch (err) {
        clearInterval(stepTimer);
        console.error("Upload error:", err);
        setError("Something went wrong. Please try again.");
        setIsUploading(false);
        setCurrentStep(-1);
      }
    },
    [scrapeJobsForTitles]
  );

  // -------------------------------------------------------------------------
  // Drag & drop / file input handlers
  // -------------------------------------------------------------------------

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const showInitial = !result && !isUploading && !error;
  const showProgress = isUploading && !result;
  const showResults = !!result;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* -------------------------------------------------------------- */}
        {/* Header                                                         */}
        {/* -------------------------------------------------------------- */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            AI-Powered Resume Parsing
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            {showResults ? "Your Profile is Ready" : "Upload Your Resume"}
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            {showResults
              ? "Here's what we found. Review your profile and start applying."
              : "Our AI will extract your skills, experience, and education, then find matching jobs automatically."}
          </p>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Initial state  -- drop zone                                    */}
        {/* -------------------------------------------------------------- */}
        {(showInitial || showProgress) && (
          <>
            {/* Upload / drag-drop card */}
            {!isUploading && (
              <Card
                className={`
                  relative overflow-hidden cursor-pointer
                  transition-all duration-300 ease-out
                  border-dashed border-2
                  ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[1.02] shadow-lg shadow-primary/10"
                      : "hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
                  }
                `}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <CardContent className="flex flex-col items-center justify-center py-20 px-8">
                  <div
                    className={`
                      h-20 w-20 rounded-2xl flex items-center justify-center mb-6
                      transition-all duration-300
                      ${
                        isDragging
                          ? "bg-primary/20 scale-110"
                          : "bg-primary/10"
                      }
                    `}
                  >
                    <Upload
                      className={`h-10 w-10 text-primary transition-transform duration-300 ${
                        isDragging ? "-translate-y-1" : ""
                      }`}
                    />
                  </div>

                  <h3 className="text-xl font-semibold mb-1">
                    {isDragging
                      ? "Drop your resume here"
                      : "Drag & drop your resume"}
                  </h3>
                  <p className="text-muted-foreground mb-5">
                    or{" "}
                    <span className="text-primary font-medium underline underline-offset-2">
                      click to browse
                    </span>{" "}
                    files
                  </p>

                  {/* Supported formats */}
                  <div className="flex items-center gap-2 mb-6">
                    <Badge
                      variant="secondary"
                      className="px-3 py-1 text-xs font-medium"
                    >
                      PDF
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="px-3 py-1 text-xs font-medium"
                    >
                      DOCX
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="px-3 py-1 text-xs font-medium"
                    >
                      TXT
                    </Badge>
                  </div>

                  {/* Security note */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Your data is secure and encrypted
                  </div>

                  {fileName && !error && (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Selected: {fileName}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Progress steps */}
            {showProgress && (
              <Card className="overflow-hidden border-primary/20">
                <CardContent className="py-6 px-5 space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Processing your resume</h3>
                      <p className="text-xs text-muted-foreground">
                        {fileName}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Step cards */}
                  <div className="space-y-2 pt-2">
                    {STEPS.map((step, i) => (
                      <StepCard
                        key={i}
                        step={step}
                        index={i}
                        currentStep={currentStep}
                        jobsFound={jobsFound}
                      />
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="pt-3">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.max(
                            ((currentStep + 1) / STEPS.length) * 100,
                            5
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Step {Math.min(currentStep + 1, STEPS.length)} of{" "}
                      {STEPS.length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* -------------------------------------------------------------- */}
        {/* Error state                                                     */}
        {/* -------------------------------------------------------------- */}
        {error && (
          <Card className="border-destructive/40 bg-destructive/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardContent className="flex items-start gap-4 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  Upload failed
                </p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setError(null);
                    setCurrentStep(-1);
                    fileInputRef.current?.click();
                  }}
                >
                  Try Again
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setError(null);
                    router.push("/onboarding");
                  }}
                >
                  Build manually
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Results                                                        */}
        {/* -------------------------------------------------------------- */}
        {showResults && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ---- Profile summary card ---- */}
            <Card className="overflow-hidden border-green-500/30">
              <CardContent className="py-0 px-0">
                {/* Green banner */}
                <div className="bg-green-500/10 px-6 py-4 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5.5 w-5.5 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg">
                      {result.name || "Profile Parsed"}
                    </h3>
                    {result.headline && (
                      <p className="text-sm text-muted-foreground truncate">
                        {result.headline}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-green-500/15 text-green-600 dark:text-green-400 border-0"
                  >
                    Complete
                  </Badge>
                </div>

                <Separator />

                {/* Stat grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
                  <StatCard
                    icon={User}
                    label="Name"
                    value={result.name || "N/A"}
                    delay={0}
                  />
                  <StatCard
                    icon={Briefcase}
                    label="Experience"
                    value={`${result.experienceCount} role${result.experienceCount !== 1 ? "s" : ""}`}
                    delay={80}
                  />
                  <StatCard
                    icon={Wrench}
                    label="Skills"
                    value={`${result.skillCount} found`}
                    delay={160}
                  />
                  <StatCard
                    icon={GraduationCap}
                    label="Education"
                    value={`${result.educationCount} entr${result.educationCount !== 1 ? "ies" : "y"}`}
                    delay={240}
                  />
                </div>

                {/* Desired job titles */}
                {result.desiredTitles?.length > 0 && (
                  <>
                    <Separator />
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Matched Job Titles
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.desiredTitles.map((title) => (
                          <Badge
                            key={title}
                            variant="secondary"
                            className="px-3 py-1"
                          >
                            {title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ---- Jobs found section ---- */}
            {jobsFound !== null && jobsFound > 0 && (
              <Card className="overflow-hidden border-blue-500/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardContent className="py-0 px-0">
                  <div className="px-6 py-4 flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Search className="h-5.5 w-5.5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        Found{" "}
                        <span className="text-blue-500 tabular-nums">
                          {animatedJobCount}
                        </span>{" "}
                        matching job{jobsFound !== 1 ? "s" : ""} for you
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Based on your experience and skills
                      </p>
                    </div>
                  </div>

                  {/* Job title previews */}
                  {result.desiredTitles?.length > 0 && (
                    <>
                      <Separator />
                      <div className="p-5 space-y-2">
                        {result.desiredTitles.slice(0, 3).map((title, i) => (
                          <JobPreviewCard key={title} title={title} index={i} />
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ---- CTA Buttons ---- */}
            <div className="space-y-3 pt-2">
              {/* Primary CTA */}
              <Button
                size="lg"
                className="w-full gap-2.5 h-13 text-base font-semibold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 hover:shadow-green-600/30 transition-all duration-200"
                onClick={() => router.push("/auto-apply")}
              >
                <Zap className="h-5 w-5" />
                Start Auto-Applying
                {jobsFound !== null && jobsFound > 0 && (
                  <span className="ml-0.5">
                    to {jobsFound} Job{jobsFound !== 1 ? "s" : ""}
                  </span>
                )}
                <ArrowRight className="h-5 w-5 ml-auto" />
              </Button>

              {/* Secondary CTAs */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const titles = result.desiredTitles?.[0] || "";
                    router.push(`/jobs?q=${encodeURIComponent(titles)}`);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Browse{" "}
                  {jobsFound !== null && jobsFound > 0
                    ? `${jobsFound} `
                    : ""}
                  Jobs
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => router.push("/onboarding")}
                >
                  <User className="h-4 w-4" />
                  Review Your Profile
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Manual profile link (initial state only)                        */}
        {/* -------------------------------------------------------------- */}
        {showInitial && (
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have a resume file?{" "}
            <button
              onClick={() => router.push("/onboarding")}
              className="text-primary hover:underline font-medium"
            >
              Build your profile manually
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
