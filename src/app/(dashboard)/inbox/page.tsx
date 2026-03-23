"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Loader2,
  Building2,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Inbox as InboxIcon,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  Eye,
  Send,
  FileText,
  Circle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ApplicationJob {
  id: string;
  title: string;
  company: string;
  companyLogo?: string | null;
  location?: string | null;
  remote: boolean;
  source: string;
}

interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

interface ApplicationItem {
  id: string;
  status: string;
  appliedAt: string;
  respondedAt?: string | null;
  notes?: string | null;
  autoApplied: boolean;
  matchScore?: number | null;
  job: ApplicationJob;
  resume?: { id: string; title: string } | null;
  coverLetter?: { id: string; title: string } | null;
  timeline?: TimelineEvent[];
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: Clock,
  },
  APPLIED: {
    label: "Applied",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: Send,
  },
  VIEWED: {
    label: "Viewed",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    icon: Eye,
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: CalendarCheck,
  },
  INTERVIEWED: {
    label: "Interviewed",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  OFFER_RECEIVED: {
    label: "Offer",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    icon: FileText,
  },
  ACCEPTED: {
    label: "Accepted",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: XCircle,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: XCircle,
  },
};

const TABS = [
  { key: "all", label: "All" },
  { key: "applied", label: "Applied", statuses: "APPLIED" },
  {
    key: "interview",
    label: "Interview",
    statuses: "INTERVIEW_SCHEDULED,INTERVIEWED",
  },
  { key: "rejected", label: "Rejected", statuses: "REJECTED" },
] as const;

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InboxPage() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<ApplicationItem | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const limit = 50;

  const fetchApplications = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", pageNum.toString());
        params.set("limit", limit.toString());

        const tab = TABS.find((t) => t.key === activeTab);
        if (tab && "statuses" in tab && tab.statuses) {
          params.set("status", tab.statuses);
        }

        const res = await fetch(`/api/applications?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setApplications(data.applications || []);
          setTotal(data.pagination?.total || 0);
          setPage(pageNum);
        }
      } catch {
        // handle silently
      } finally {
        setLoading(false);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    fetchApplications(1);
  }, [fetchApplications]);

  // Filter by search locally
  const filteredApps = searchQuery
    ? applications.filter(
        (app) =>
          app.job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          app.job.company.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : applications;

  function handleSelectApp(app: ApplicationItem) {
    setSelectedApp(app);
    setNotesValue(app.notes || "");
  }

  async function handleSaveNotes() {
    if (!selectedApp) return;
    setSavingNotes(true);
    try {
      await fetch(`/api/applications/${selectedApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue }),
      });
      setSelectedApp({ ...selectedApp, notes: notesValue });
      setApplications((prev) =>
        prev.map((a) =>
          a.id === selectedApp.id ? { ...a, notes: notesValue } : a
        )
      );
    } catch {
      // handle silently
    } finally {
      setSavingNotes(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Inbox</h1>
        <p className="text-muted-foreground mt-1">
          Track your application responses and status updates
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSelectedApp(null);
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Pagination Info */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company or job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        {total > 0 && (
          <p className="text-sm text-muted-foreground shrink-0">
            {startItem}-{endItem} of {total}
          </p>
        )}
      </div>

      {/* Main Layout: List + Detail */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[400px_1fr]">
        {/* Application List */}
        <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto border rounded-lg bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <InboxIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No applications found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab !== "all"
                  ? "Try a different filter or check the All tab"
                  : "Start applying to jobs to see them here"}
              </p>
            </div>
          ) : (
            filteredApps.map((app) => {
              const cfg =
                STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
              const isSelected = selectedApp?.id === app.id;

              return (
                <button
                  key={app.id}
                  onClick={() => handleSelectApp(app)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-accent/50 ${
                    isSelected ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Company logo */}
                    {app.job.companyLogo ? (
                      <img
                        src={app.job.companyLogo}
                        alt=""
                        className="h-10 w-10 rounded-lg object-contain bg-muted p-1 shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {app.job.company}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {timeAgo(app.appliedAt)}
                        </span>
                      </div>
                      <p className="text-sm truncate mt-0.5">
                        {app.job.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${cfg.className}`}
                        >
                          {cfg.label}
                        </Badge>
                        {app.autoApplied && (
                          <Badge
                            variant="outline"
                            className="text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                          >
                            Auto
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => fetchApplications(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => fetchApplications(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <Card className="max-h-[calc(100vh-320px)] overflow-y-auto">
          <CardContent className="p-6">
            {!selectedApp ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <InboxIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-muted-foreground">
                  Select an application
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on an application to view its details
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  {selectedApp.job.companyLogo ? (
                    <img
                      src={selectedApp.job.companyLogo}
                      alt=""
                      className="h-14 w-14 rounded-xl object-contain bg-muted p-1.5 shrink-0"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted shrink-0">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold">
                      {selectedApp.job.title}
                    </h2>
                    <p className="text-muted-foreground">
                      {selectedApp.job.company}
                    </p>
                    {selectedApp.job.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {selectedApp.job.location}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status + Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge
                      variant="secondary"
                      className={`${
                        (STATUS_CONFIG[selectedApp.status] || STATUS_CONFIG.PENDING)
                          .className
                      }`}
                    >
                      {(
                        STATUS_CONFIG[selectedApp.status] ||
                        STATUS_CONFIG.PENDING
                      ).label}
                    </Badge>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Applied
                    </p>
                    <p className="text-sm font-medium">
                      {formatDate(selectedApp.appliedAt)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <a
                    href={`/jobs/${selectedApp.job.id}`}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg border bg-background hover:bg-muted text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Original Listing
                  </a>
                </div>

                <Separator />

                {/* Status Timeline */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    Application Timeline
                  </h3>
                  {selectedApp.timeline && selectedApp.timeline.length > 0 ? (
                    <div className="space-y-3">
                      {selectedApp.timeline.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-3"
                        >
                          <div className="mt-1">
                            <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{event.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(event.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
                        </div>
                        <div>
                          <p className="text-sm">
                            Applied to {selectedApp.job.title} at{" "}
                            {selectedApp.job.company}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(selectedApp.appliedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Notes */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Notes</h3>
                  <Textarea
                    placeholder="Add notes about this application..."
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={
                        savingNotes || notesValue === (selectedApp.notes || "")
                      }
                    >
                      {savingNotes ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : null}
                      Save Notes
                    </Button>
                  </div>
                </div>

                {/* Attached documents */}
                {(selectedApp.resume || selectedApp.coverLetter) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-2">
                        Attached Documents
                      </h3>
                      <div className="space-y-2">
                        {selectedApp.resume && (
                          <div className="flex items-center gap-2 text-sm p-2 rounded-lg border">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span>{selectedApp.resume.title}</span>
                          </div>
                        )}
                        {selectedApp.coverLetter && (
                          <div className="flex items-center gap-2 text-sm p-2 rounded-lg border">
                            <FileText className="h-4 w-4 text-green-500" />
                            <span>{selectedApp.coverLetter.title}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
