"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PipelineFunnelProps {
  statusBreakdown: Record<string, number>;
  totalApplications: number;
}

const stages = [
  { key: "APPLIED", label: "Applied", color: "bg-blue-500" },
  { key: "VIEWED", label: "Viewed", color: "bg-sky-500" },
  { key: "INTERVIEW_SCHEDULED", label: "Interview", color: "bg-teal-500" },
  { key: "OFFER_RECEIVED", label: "Offer", color: "bg-emerald-500" },
  { key: "ACCEPTED", label: "Accepted", color: "bg-green-500" },
];

export function PipelineFunnel({
  statusBreakdown,
  totalApplications,
}: PipelineFunnelProps) {
  // Cumulative: each stage includes all stages at or beyond it
  const stageData = stages.map((stage, idx) => {
    let count = 0;
    for (let i = idx; i < stages.length; i++) {
      count += statusBreakdown[stages[i].key] || 0;
    }
    // Also include INTERVIEWED for interview+ stages
    if (idx <= 2) {
      count += statusBreakdown["INTERVIEWED"] || 0;
    }
    // For the first stage, include PENDING too
    if (idx === 0) {
      count = totalApplications;
    }
    const pct =
      totalApplications > 0
        ? Math.round((count / totalApplications) * 100)
        : 0;
    return { ...stage, count, pct };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Pipeline</CardTitle>
        <CardDescription>
          Funnel from application to acceptance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalApplications === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No application data yet
          </div>
        ) : (
          <div className="space-y-3">
            {stageData.map((stage, i) => {
              const widthPct = Math.max(stage.pct, 8);
              return (
                <div key={stage.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{stage.label}</span>
                    <span className="text-muted-foreground">
                      {stage.count}{" "}
                      <span className="text-xs">({stage.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-8 w-full rounded-lg bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-lg ${stage.color} transition-all duration-700 ease-out flex items-center justify-center`}
                      style={{ width: `${widthPct}%` }}
                    >
                      {stage.pct > 15 && (
                        <span className="text-xs font-medium text-white">
                          {stage.pct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
