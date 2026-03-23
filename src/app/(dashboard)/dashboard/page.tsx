"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Briefcase,
  Zap,
  Send,
  CalendarCheck,
  TrendingUp,
  Target,
  Building2,
  Clock,
  FileText,
  ArrowRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Application {
  id: string;
  status: string;
  matchScore?: number | null;
  appliedAt: string;
  job: {
    id: string;
    title: string;
    company: string;
    companyLogo?: string | null;
    location?: string | null;
  };
}

interface AnalyticsData {
  totalApplications: number;
  statusBreakdown: Record<string, number>;
  responseRate: number;
  interviewRate: number;
}

interface ApplicationEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Status badge colours                                               */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Pending",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  APPLIED: {
    label: "Applied",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  VIEWED: {
    label: "Viewed",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  INTERVIEWED: {
    label: "Interviewed",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  OFFER_RECEIVED: {
    label: "Offer",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  ACCEPTED: {
    label: "Accepted",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ------------------------------------------------------------------ */
/*  Skeleton components                                                */
/* ------------------------------------------------------------------ */

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="h-8 w-16 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
      </TableCell>
      <TableCell>
        <div className="h-4 w-36 rounded bg-muted animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-10 rounded bg-muted animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
      </TableCell>
    </TableRow>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-full rounded bg-muted animate-pulse" />
        <div className="h-3 w-20 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick Action Cards                                                 */
/* ------------------------------------------------------------------ */

const quickActions = [
  {
    label: "Upload Resume",
    description: "Add or update your resume",
    href: "/upload",
    icon: Upload,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    label: "Browse Jobs",
    description: "Explore matching positions",
    href: "/jobs",
    icon: Briefcase,
    gradient: "from-violet-500 to-purple-500",
  },
  {
    label: "Auto Apply",
    description: "Let AI apply for you",
    href: "/auto-apply",
    icon: Zap,
    gradient: "from-amber-500 to-orange-500",
  },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>("");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);
  const [recentEvents, setRecentEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [analyticsRes, applicationsRes, profileRes] = await Promise.all([
          fetch("/api/analytics?period=all").then((r) =>
            r.ok ? r.json() : null
          ),
          fetch("/api/applications?limit=10").then((r) =>
            r.ok ? r.json() : null
          ),
          fetch("/api/profile").then((r) => (r.ok ? r.json() : null)),
        ]);

        if (analyticsRes) {
          setAnalytics(analyticsRes);
        }

        if (applicationsRes?.applications) {
          setApplications(applicationsRes.applications);
          // Derive active jobs from total pagination count
          setActiveJobsCount(applicationsRes.pagination?.total || 0);
        }

        if (profileRes) {
          setUserName(profileRes.name || profileRes.fullName || "");
        }

        // Try to fetch recent events (may not exist)
        try {
          const eventsRes = await fetch("/api/applications?limit=5");
          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            // Map applications as activity events
            if (eventsData.applications) {
              setRecentEvents(
                eventsData.applications.map((app: Application) => ({
                  id: app.id,
                  type: app.status,
                  description: `Applied to ${app.job.title} at ${app.job.company}`,
                  createdAt: app.appliedAt,
                }))
              );
            }
          }
        } catch {
          // Events endpoint may not exist
        }
      } catch {
        // Silently handle errors - show empty state
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const totalApplications = analytics?.totalApplications || 0;
  const interviewCount =
    (analytics?.statusBreakdown?.INTERVIEW_SCHEDULED || 0) +
    (analytics?.statusBreakdown?.INTERVIEWED || 0);
  const responseRate = analytics?.responseRate || 0;

  const stats = [
    {
      label: "Applications Sent",
      value: totalApplications,
      icon: Send,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Interviews Scheduled",
      value: interviewCount,
      icon: CalendarCheck,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      label: "Response Rate",
      value: `${responseRate}%`,
      icon: TrendingUp,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Total Tracked",
      value: activeJobsCount,
      icon: Target,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="space-y-8">
      {/* -------- Welcome + Quick Actions -------- */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome back{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening with your job search
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href} className="group">
            <Card className="relative overflow-hidden transition-all hover:ring-2 hover:ring-primary/20">
              <div
                className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-[0.03] group-hover:opacity-[0.07] transition-opacity`}
              />
              <CardContent className="flex items-center gap-4 pt-6">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${action.gradient} text-white`}
                >
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* -------- Stats Row -------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.iconBg}`}
                    >
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* -------- Main Content: Table + Activity -------- */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Recent Applications Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>
                  Your latest job applications
                </CardDescription>
              </div>
              {applications.length > 0 && (
                <Link href="/analytics">
                  <Button variant="outline" className="text-xs h-8">
                    View All
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </TableBody>
              </Table>
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-base">
                  No applications yet
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Upload your resume and start applying to jobs to see your
                  applications here.
                </p>
                <Link href="/upload" className="mt-4">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Resume
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => {
                    const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                    return (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {app.job.companyLogo ? (
                              <img
                                src={app.job.companyLogo}
                                alt=""
                                className="h-9 w-9 rounded-lg object-contain bg-muted p-1"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium text-sm">
                              {app.job.company}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/jobs/${app.job.id}`}
                            className="hover:underline text-sm"
                          >
                            {app.job.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusCfg.className}
                          >
                            {statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {app.matchScore != null ? (
                            <span
                              className={`text-sm font-medium ${
                                app.matchScore >= 80
                                  ? "text-green-600 dark:text-green-400"
                                  : app.matchScore >= 50
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {app.matchScore}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              --
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {timeAgo(app.appliedAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Timeline */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ActivitySkeleton key={i} />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No activity yet. Start applying to see your timeline.
              </p>
            ) : (
              <div className="space-y-0">
                {recentEvents.map((event, idx) => (
                  <div key={event.id}>
                    <div className="flex gap-3 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug line-clamp-2">
                          {event.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {timeAgo(event.createdAt)}
                        </p>
                      </div>
                    </div>
                    {idx < recentEvents.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
