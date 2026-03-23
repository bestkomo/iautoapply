"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatsCards } from "@/components/analytics/stats-cards";
import { ApplicationChart } from "@/components/analytics/application-chart";
import { PipelineFunnel } from "@/components/analytics/pipeline-funnel";
import { SourceBreakdown } from "@/components/analytics/source-breakdown";

interface AnalyticsData {
  totalApplications: number;
  autoApplied: number;
  manual: number;
  statusBreakdown: Record<string, number>;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  applicationsByDay: Array<{ date: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
  avgTimeToResponse: number | null;
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-muted ring-1 ring-foreground/10 ${className || ""}`}
    />
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?period=${p}`);
      const json = await res.json();
      if (!json.error) setData(json);
    } catch {
      console.error("Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your job search progress and metrics
          </p>
        </div>
      </div>

      <Tabs
        defaultValue="30d"
        onValueChange={(val) => setPeriod(val as string)}
      >
        <TabsList>
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
          <TabsTrigger value="90d">90 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>

        {["7d", "30d", "90d", "all"].map((p) => (
          <TabsContent key={p} value={p}>
            {loading ? (
              <div className="space-y-6">
                {/* Stats skeleton */}
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <SkeletonCard key={i} className="h-[106px]" />
                  ))}
                </div>
                {/* Chart skeleton */}
                <SkeletonCard className="h-[380px]" />
                {/* Bottom row skeleton */}
                <div className="grid gap-4 md:grid-cols-2">
                  <SkeletonCard className="h-[340px]" />
                  <SkeletonCard className="h-[340px]" />
                </div>
              </div>
            ) : data ? (
              <div className="space-y-6">
                <StatsCards
                  totalApplications={data.totalApplications}
                  responseRate={data.responseRate}
                  interviewRate={data.interviewRate}
                  offerRate={data.offerRate}
                />

                <ApplicationChart data={data.applicationsByDay} />

                <div className="grid gap-4 md:grid-cols-2">
                  <PipelineFunnel
                    statusBreakdown={data.statusBreakdown}
                    totalApplications={data.totalApplications}
                  />
                  <SourceBreakdown data={data.topSources} />
                </div>

                {data.avgTimeToResponse !== null && (
                  <div className="rounded-xl bg-muted/50 p-4 text-center ring-1 ring-foreground/10">
                    <p className="text-sm text-muted-foreground">
                      Average Time to Response
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {data.avgTimeToResponse} days
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Failed to load analytics data.
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
