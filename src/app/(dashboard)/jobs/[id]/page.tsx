"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  FileText,
  Mail,
  MapPin,
  Building2,
  DollarSign,
  Clock,
  Wifi,
  Loader2,
  Briefcase,
} from "lucide-react";

interface JobDetail {
  id: string;
  title: string;
  company: string;
  companyLogo?: string | null;
  location?: string | null;
  remote: boolean;
  jobType: string;
  description: string;
  requirements?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  experienceLevel?: string | null;
  skills: string[];
  source: string;
  applyUrl?: string | null;
  postedAt?: string | null;
  matchScore?: number | null;
  isSaved?: boolean;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  INTERNSHIP: "Internship",
};

function formatSalary(min?: number | null, max?: number | null, currency?: string | null): string {
  const fmt = (n: number) => n.toLocaleString();
  const cur = currency || "USD";
  if (min && max && min !== max) return `$${fmt(min)} - $${fmt(max)} ${cur}`;
  if (min) return `$${fmt(min)}+ ${cur}`;
  if (max) return `Up to $${fmt(max)} ${cur}`;
  return "";
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) {
          router.push("/jobs");
          return;
        }
        setJob(await res.json());
      } finally {
        setLoading(false);
      }
    }
    fetchJob();
  }, [id, router]);

  async function handleToggleSave() {
    if (!job) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jobs/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (res.ok) {
        const { saved } = await res.json();
        setJob((prev) => (prev ? { ...prev, isSaved: saved } : null));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) return null;

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {job.companyLogo ? (
                <img
                  src={job.companyLogo}
                  alt={job.company}
                  className="h-14 w-14 rounded-xl object-contain bg-accent p-2 shrink-0"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <Building2 className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{job.title}</h1>
                <p className="text-lg text-muted-foreground">{job.company}</p>
              </div>
            </div>
            {job.matchScore != null && (
              <Badge
                className={`text-lg px-3 py-1 ${
                  job.matchScore >= 80
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : job.matchScore >= 60
                    ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                    : "bg-red-500/10 text-red-700 dark:text-red-400"
                }`}
              >
                {job.matchScore}% match
              </Badge>
            )}
          </div>

          {/* Meta info row */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
            )}
            {job.remote && (
              <Badge variant="secondary">
                <Wifi className="h-3.5 w-3.5 mr-1" />
                Remote
              </Badge>
            )}
            <Badge variant="secondary">
              <Briefcase className="h-3.5 w-3.5 mr-1" />
              {JOB_TYPE_LABELS[job.jobType] || job.jobType}
            </Badge>
            {salary && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                {salary}
              </span>
            )}
            {job.postedAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Posted {new Date(job.postedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {job.applyUrl && (
          <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
            <Button>
              <ExternalLink className="h-4 w-4 mr-2" />
              Apply Now
            </Button>
          </a>
        )}
        <Link
          href={`/cover-letter/new?jobTitle=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`}
        >
          <Button variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Generate Cover Letter
          </Button>
        </Link>
        <Link href="/resume">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Generate Tailored Resume
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={handleToggleSave}
          disabled={saving}
        >
          <Heart
            className={`h-4 w-4 mr-2 ${
              job.isSaved ? "fill-red-500 text-red-500" : ""
            }`}
          />
          {job.isSaved ? "Saved" : "Save Job"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {job.description}
              </div>
            </CardContent>
          </Card>

          {job.requirements && (
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {job.requirements}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Skills */}
          {job.skills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle>Company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                {job.companyLogo ? (
                  <img
                    src={job.companyLogo}
                    alt={job.company}
                    className="h-10 w-10 rounded-lg object-contain bg-accent p-1"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{job.company}</p>
                  {job.location && (
                    <p className="text-sm text-muted-foreground">
                      {job.location}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {job.experienceLevel && (
            <Card>
              <CardHeader>
                <CardTitle>Experience Level</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge>{job.experienceLevel}</Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
