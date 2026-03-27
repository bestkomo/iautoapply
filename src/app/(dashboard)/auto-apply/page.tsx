"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Zap,
  Settings,
  Loader2,
  Building2,
  MapPin,
  TrendingUp,
  Clock,
  CheckCircle2,
  BarChart3,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Inbox,
  Send,
  Briefcase,
  ExternalLink,
  Mail,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AutoApplyStatus {
  enabled: boolean;
  stats: {
    appliedToday: number;
    inQueue: number;
    successRate: number;
    totalApplied: number;
  };
  recentApplications: {
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
  }[];
  preferences?: {
    maxPerDay: number;
    titles: string[];
    locations: string[];
    remoteOnly: boolean;
  };
}

/* ------------------------------------------------------------------ */
/*  Status badge config                                                */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Automating...",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  APPLIED: {
    label: "Applied",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
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

function ControlCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3 w-56 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="h-10 w-32 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="h-16 rounded-lg bg-muted animate-pulse" />
          <div className="h-16 rounded-lg bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

function PreferencesSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="h-5 w-36 rounded bg-muted animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 w-20 rounded-full bg-muted animate-pulse" />
          ))}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-6 w-24 rounded-full bg-muted animate-pulse" />
          ))}
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
        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

interface InboxApplication {
  id: string;
  status: string;
  appliedAt: string;
  autoApplied: boolean;
  notes?: string | null;
  job: {
    id: string;
    title: string;
    company: string;
    companyLogo?: string | null;
    location?: string | null;
  };
}

const AUTO_APPLY_TABS = [
  { key: "jobs", label: "Jobs", icon: Briefcase },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "applied", label: "Applied", icon: Send },
] as const;

const ITEMS_PER_PAGE = 10;

export default function AutoApplyPage() {
  const [status, setStatus] = useState<AutoApplyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>("jobs");
  const [inboxApps, setInboxApps] = useState<InboxApplication[]>([]);
  const [appliedApps, setAppliedApps] = useState<InboxApplication[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [appliedLoading, setAppliedLoading] = useState(false);
  const [applyEmail, setApplyEmail] = useState<string | null>(null);
  const [creatingEmail, setCreatingEmail] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/applications/auto-apply");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const res = await fetch("/api/applications?limit=20&status=VIEWED,INTERVIEW_SCHEDULED,INTERVIEWED,OFFER_RECEIVED,REJECTED");
      if (res.ok) {
        const data = await res.json();
        setInboxApps(data.applications || []);
      }
    } catch {
      // handle silently
    } finally {
      setInboxLoading(false);
    }
  }, []);

  const fetchApplied = useCallback(async () => {
    setAppliedLoading(true);
    try {
      const res = await fetch("/api/applications?limit=20&status=APPLIED");
      if (res.ok) {
        const data = await res.json();
        setAppliedApps(data.applications || []);
      }
    } catch {
      // handle silently
    } finally {
      setAppliedLoading(false);
    }
  }, []);

  const fetchApplyEmail = useCallback(async () => {
    try {
      const res = await fetch("/api/apply-email");
      if (res.ok) {
        const data = await res.json();
        setApplyEmail(data.applyEmail || null);
      }
    } catch {
      // handle silently
    }
  }, []);

  async function handleCreateApplyEmail() {
    setCreatingEmail(true);
    try {
      const res = await fetch("/api/apply-email", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setApplyEmail(data.applyEmail);
      }
    } catch {
      // handle silently
    } finally {
      setCreatingEmail(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    fetchApplyEmail();
  }, [fetchStatus, fetchApplyEmail]);

  useEffect(() => {
    if (activeTab === "inbox") fetchInbox();
    if (activeTab === "applied") fetchApplied();
  }, [activeTab, fetchInbox, fetchApplied]);

  async function handleToggle() {
    if (!status) return;
    setToggling(true);
    try {
      if (status.enabled) {
        await fetch("/api/applications/auto-apply", { method: "DELETE" });
      } else {
        const res = await fetch("/api/applications/auto-apply", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data.applied > 0) {
            // Trigger a refresh after a delay to show updated automation results
            setTimeout(() => fetchStatus(), 5000);
            setTimeout(() => fetchStatus(), 15000);
            setTimeout(() => fetchStatus(), 30000);
          }
        }
      }
      await fetchStatus();
    } finally {
      setToggling(false);
    }
  }

  const maxPerDay = status?.preferences?.maxPerDay || 50;
  const appliedToday = status?.stats.appliedToday || 0;
  const remaining = Math.max(0, maxPerDay - appliedToday);
  const usagePercent = Math.round((appliedToday / maxPerDay) * 100);

  const allApps = status?.recentApplications || [];
  const totalPages = Math.max(1, Math.ceil(allApps.length / ITEMS_PER_PAGE));
  const paginatedApps = allApps.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const isActive = status?.enabled || false;

  return (
    <div className="space-y-6">
      {/* -------- Page Header -------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Auto Apply
          </h1>
          <p className="text-muted-foreground mt-1">
            Automatically apply to jobs that match your preferences
          </p>
        </div>
        <Link href="/auto-apply/settings">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </Link>
      </div>

      {/* -------- Tabs -------- */}
      <div className="flex items-center gap-1 border-b">
        {AUTO_APPLY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* -------- Inbox Tab -------- */}
      {activeTab === "inbox" && (
        <Card>
          <CardHeader>
            <CardTitle>Application Responses</CardTitle>
            <CardDescription>
              Recent responses from your applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inboxLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : inboxApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                  <Inbox className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">No responses yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Responses from employers will appear here
                </p>
                <Link href="/inbox" className="mt-4">
                  <Button variant="outline" size="sm">
                    View Full Inbox
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {inboxApps.map((app) => {
                  const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                  return (
                    <div
                      key={app.id}
                      className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {app.job.companyLogo ? (
                          <img
                            src={app.job.companyLogo}
                            alt=""
                            className="h-9 w-9 rounded-lg object-contain bg-muted p-1 shrink-0"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{app.job.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{app.job.company}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className={`text-xs ${cfg.className}`}>
                          {cfg.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(app.appliedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 flex justify-center">
                  <Link href="/inbox">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Full Inbox
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* -------- Applied Tab -------- */}
      {activeTab === "applied" && (
        <Card>
          <CardHeader>
            <CardTitle>Successfully Applied</CardTitle>
            <CardDescription>
              Jobs you have applied to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appliedLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : appliedApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                  <Send className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">No applications yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Enable Auto-Apply to start sending applications
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appliedApps.map((app) => (
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
                          <span className="font-medium text-sm">{app.job.company}</span>
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
                        <span className="text-sm text-muted-foreground">
                          {timeAgo(app.appliedAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {app.autoApplied ? (
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Auto
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Manual
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* -------- Jobs Tab (original content) -------- */}
      {activeTab === "jobs" && <>
      {/* -------- Control Card -------- */}
      {loading ? (
        <ControlCardSkeleton />
      ) : (
        <Card
          className={
            isActive
              ? "ring-2 ring-green-500/20 bg-green-500/[0.02]"
              : ""
          }
        >
          <CardContent className="p-6">
            {/* Toggle Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                      isActive
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-muted"
                    }`}
                  >
                    {isActive ? (
                      <Wifi className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <WifiOff className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-green-500" />
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    Auto-Apply is {isActive ? "ON" : "OFF"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isActive
                      ? "Applying to matching jobs automatically"
                      : "Enable to start applying automatically"}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleToggle}
                disabled={toggling}
                variant={isActive ? "destructive" : "default"}
                size="lg"
                className="gap-2 min-w-[140px]"
              >
                {toggling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {isActive ? "Stop" : "Start"} Auto Apply
              </Button>
            </div>

            {/* Inline Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  Applied Today
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {appliedToday}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {maxPerDay}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Remaining Today
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {remaining}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Daily usage</span>
                <span>{appliedToday} of {maxPerDay}</span>
              </div>
              <Progress value={usagePercent} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* -------- Apply Email Card -------- */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                applyEmail
                  ? "bg-purple-100 dark:bg-purple-900/30"
                  : "bg-muted"
              }`}>
                <Mail className={`h-6 w-6 ${
                  applyEmail
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-muted-foreground"
                }`} />
              </div>
              <div>
                <h3 className="font-semibold">Application Email</h3>
                {applyEmail ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono text-purple-600 dark:text-purple-400">{applyEmail}</span>
                    {" "}&mdash; Used for Workday applications & verification
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Get a dedicated email for job applications. All confirmations land in your inbox.
                  </p>
                )}
              </div>
            </div>
            {!applyEmail && (
              <Button
                onClick={handleCreateApplyEmail}
                disabled={creatingEmail}
                variant="outline"
                className="gap-2"
              >
                {creatingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Create Email
              </Button>
            )}
            {applyEmail && (
              <Link href="/inbox">
                <Button variant="outline" size="sm" className="gap-2">
                  <Inbox className="h-4 w-4" />
                  View Inbox
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* -------- Preferences + Credits Row -------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preferences Summary */}
        {loading ? (
          <PreferencesSkeleton />
        ) : !status?.preferences ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold">No Preferences Set</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Set up your job preferences to start auto-applying to matching
                positions.
              </p>
              <Link href="/auto-apply/settings" className="mt-4">
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Set Up Preferences
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Job Preferences</CardTitle>
                <Link href="/auto-apply/settings">
                  <Button variant="ghost" className="text-xs h-8 gap-1">
                    <Settings className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Target Titles */}
              {status.preferences.titles.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Target Titles
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {status.preferences.titles.map((title) => (
                      <Badge key={title} variant="secondary" className="text-xs">
                        {title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Locations */}
              {status.preferences.locations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Locations
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {status.preferences.locations.map((loc) => (
                      <Badge key={loc} variant="outline" className="text-xs gap-1">
                        <MapPin className="h-3 w-3" />
                        {loc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Remote */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Remote only:</span>
                <Badge
                  variant={
                    status.preferences.remoteOnly ? "default" : "secondary"
                  }
                  className="text-xs"
                >
                  {status.preferences.remoteOnly ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credits / Usage Card */}
        {loading ? (
          <PreferencesSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage & Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Applied
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    {status?.stats.totalApplied || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Success Rate
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    {status?.stats.successRate || 0}%
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    In Queue
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    {status?.stats.inQueue || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Daily Limit
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    {maxPerDay}
                  </p>
                </div>
              </div>

              <Separator />

              <p className="text-xs text-muted-foreground text-center">
                Application counts reset daily at midnight
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* -------- Applications Table -------- */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Applied Jobs</CardTitle>
          <CardDescription>
            Jobs applied to automatically based on your preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fit Score</TableHead>
                  <TableHead>Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </TableBody>
            </Table>
          ) : allApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Zap className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-base">
                No auto-applications yet
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Enable Auto-Apply and set your preferences to get started.
                We&apos;ll find and apply to jobs that match your criteria.
              </p>
              {!isActive && (
                <Button onClick={handleToggle} className="mt-4 gap-2">
                  <Zap className="h-4 w-4" />
                  Start Auto Apply
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fit Score</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedApps.map((app) => {
                    const statusCfg =
                      STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
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
                            <div className="min-w-0">
                              <span className="font-medium text-sm block truncate">
                                {app.job.company}
                              </span>
                              {app.job.location && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {app.job.location}
                                </span>
                              )}
                            </div>
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
                              className={`text-sm font-semibold ${
                                app.matchScore >= 80
                                  ? "text-green-600 dark:text-green-400"
                                  : app.matchScore >= 50
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-red-500"
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    Showing {(page - 1) * ITEMS_PER_PAGE + 1}
                    {" - "}
                    {Math.min(page * ITEMS_PER_PAGE, allApps.length)} of{" "}
                    {allApps.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2 tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
