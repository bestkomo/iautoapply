"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Loader2,
  Building2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Inbox as InboxIcon,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  Send,
  Mail,
  MailOpen,
  LinkIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InboxItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  preview: string;
  status: "confirmed" | "interview" | "rejected" | "pending";
  company: string;
  source: "gmail" | "application" | "apply-email";
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  confirmed: {
    label: "Applied",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: Send,
  },
  interview: {
    label: "Interview",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: CalendarCheck,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: XCircle,
  },
  pending: {
    label: "Pending",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: Clock,
  },
};

const TABS = [
  { key: "all", label: "All" },
  { key: "interview", label: "Interview" },
  { key: "confirmed", label: "Applied" },
  { key: "rejected", label: "Rejected" },
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
/*  Apply-email helpers                                                */
/* ------------------------------------------------------------------ */

function mapCategory(
  cat: string
): "confirmed" | "interview" | "rejected" | "pending" {
  switch (cat) {
    case "confirmation":
      return "confirmed";
    case "interview":
      return "interview";
    case "rejection":
      return "rejected";
    default:
      return "pending";
  }
}

function extractCompany(email: string, name?: string): string {
  if (name && !name.includes("@")) return name;
  // Try to extract company from email domain (e.g. "noreply@myworkday.com" → "Workday")
  const domain = email.split("@")[1] || "";
  const parts = domain.split(".");
  if (parts.length >= 2) {
    const company = parts[parts.length - 2];
    return company.charAt(0).toUpperCase() + company.slice(1);
  }
  return email;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [applyEmail, setApplyEmail] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from both sources in parallel
      const [inboxRes, applyInboxRes] = await Promise.all([
        fetch("/api/inbox"),
        fetch("/api/apply-email/inbox"),
      ]);

      let allItems: InboxItem[] = [];

      if (inboxRes.ok) {
        const data = await inboxRes.json();
        allItems = [...(data.items || [])];
        setGmailConnected(data.gmailConnected || false);
      }

      if (applyInboxRes.ok) {
        const applyData = await applyInboxRes.json();
        setApplyEmail(applyData.applyEmail || null);

        // Map apply-email inbox items to InboxItem format
        if (applyData.emails?.length) {
          const applyItems: InboxItem[] = applyData.emails.map(
            (email: { uid: number; from: string; fromName: string; subject: string; date: string; bodyText: string; category: string }) => ({
              id: `apply-${email.uid}`,
              from: email.from,
              subject: email.subject,
              date: email.date,
              preview: (email.bodyText || "").slice(0, 200),
              status: mapCategory(email.category),
              company: extractCompany(email.from, email.fromName),
              source: "apply-email" as const,
            })
          );
          allItems = [...allItems, ...applyItems];
        }
      }

      // Sort all items by date, newest first
      allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(allItems);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Check for success/error query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      // Could show a toast here
      // Clean up URL
      window.history.replaceState({}, "", "/inbox");
      fetchInbox();
    }
  }, [fetchInbox]);

  // Filter by tab and search
  const filteredItems = items.filter((item) => {
    if (activeTab !== "all" && item.status !== activeTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.subject.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.from.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / limit));
  const paginatedItems = filteredItems.slice(
    (page - 1) * limit,
    page * limit
  );
  const startItem = filteredItems.length > 0 ? (page - 1) * limit + 1 : 0;
  const endItem = Math.min(page * limit, filteredItems.length);

  function getCompanyInitial(company: string): string {
    return company.charAt(0).toUpperCase();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your application responses and status updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {applyEmail && (
            <Badge
              variant="secondary"
              className="gap-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
            >
              <Mail className="h-3.5 w-3.5" />
              {applyEmail}
            </Badge>
          )}
          {!gmailConnected && (
            <a href="/api/auth/gmail">
              <Button className="gap-2" size="sm">
                <Mail className="h-4 w-4" />
                Connect Gmail
              </Button>
            </a>
          )}
          {gmailConnected && (
            <Badge
              variant="secondary"
              className="gap-1.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Gmail Connected
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSelectedItem(null);
              setPage(1);
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

      {/* Search + Count */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company, subject, or sender..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-9"
          />
        </div>
        {filteredItems.length > 0 && (
          <p className="text-sm text-muted-foreground shrink-0">
            {startItem}-{endItem} of {filteredItems.length}
          </p>
        )}
      </div>

      {/* Main Layout: List + Detail */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[400px_1fr]">
        {/* Item List */}
        <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto border rounded-lg bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <InboxIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No messages found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {!gmailConnected && !applyEmail
                  ? "Connect Gmail or upgrade to PRO to get your application inbox"
                  : activeTab !== "all"
                    ? "Try a different filter or check the All tab"
                    : "No application-related emails found yet"}
              </p>
            </div>
          ) : (
            paginatedItems.map((item) => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
              const isSelected = selectedItem?.id === item.id;
              const StatusIcon = cfg.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-accent/50 ${
                    isSelected ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Company initial avatar */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0 text-sm font-semibold text-muted-foreground">
                      {getCompanyInitial(item.company)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {item.company}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {timeAgo(item.date)}
                        </span>
                      </div>
                      <p className="text-sm truncate mt-0.5">{item.subject}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.preview}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-xs gap-1 ${cfg.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        {item.source === "gmail" && (
                          <Badge
                            variant="outline"
                            className="text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            Gmail
                          </Badge>
                        )}
                        {item.source === "apply-email" && (
                          <Badge
                            variant="outline"
                            className="text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            Apply Inbox
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
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <Card className="max-h-[calc(100vh-320px)] overflow-y-auto">
          <CardContent className="p-6">
            {!selectedItem ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MailOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-muted-foreground">
                  Select a message
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on a message to view its details
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted shrink-0 text-lg font-semibold text-muted-foreground">
                    {getCompanyInitial(selectedItem.company)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold">
                      {selectedItem.subject}
                    </h2>
                    <p className="text-muted-foreground">
                      {selectedItem.company}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Mail className="h-3.5 w-3.5" />
                      {selectedItem.from}
                    </p>
                  </div>
                </div>

                {/* Status + Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge
                      variant="secondary"
                      className={`${
                        (
                          STATUS_CONFIG[selectedItem.status] ||
                          STATUS_CONFIG.pending
                        ).className
                      }`}
                    >
                      {(
                        STATUS_CONFIG[selectedItem.status] ||
                        STATUS_CONFIG.pending
                      ).label}
                    </Badge>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Received
                    </p>
                    <p className="text-sm font-medium">
                      {formatDate(selectedItem.date)}
                    </p>
                  </div>
                </div>

                {/* Source badge */}
                <div className="flex gap-3">
                  <Badge variant="outline" className="gap-1.5">
                    {selectedItem.source === "gmail" ? (
                      <>
                        <Mail className="h-3.5 w-3.5" />
                        Via Gmail
                      </>
                    ) : selectedItem.source === "apply-email" ? (
                      <>
                        <Mail className="h-3.5 w-3.5" />
                        Apply Inbox
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-3.5 w-3.5" />
                        Application Tracker
                      </>
                    )}
                  </Badge>
                </div>

                <Separator />

                {/* Email body preview */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Message</h3>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedItem.preview || "No preview available."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
