"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SourceBreakdownProps {
  data: Array<{ source: string; count: number }>;
}

const COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
];

const SOURCE_LABELS: Record<string, string> = {
  INDEED: "Indeed",
  LINKEDIN: "LinkedIn",
  GLASSDOOR: "Glassdoor",
  REMOTEOK: "RemoteOK",
  WEWORKREMOTELY: "WeWorkRemotely",
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  MANUAL: "Manual",
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { source: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium">
        {SOURCE_LABELS[item.payload.source] || item.payload.source}
      </p>
      <p className="text-sm text-muted-foreground">
        {item.value} application{item.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function SourceBreakdown({ data }: SourceBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Breakdown</CardTitle>
        <CardDescription>
          Where your applications come from
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No application data yet
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="source"
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              {data.map((item, index) => (
                <div
                  key={item.source}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                  <span className="text-muted-foreground">
                    {SOURCE_LABELS[item.source] || item.source}
                  </span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
