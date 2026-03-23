import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "30d";

  const now = new Date();
  let startDate: Date | null = null;

  switch (period) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "all":
    default:
      startDate = null;
      break;
  }

  const where = {
    userId: session.user.id,
    ...(startDate ? { appliedAt: { gte: startDate } } : {}),
  };

  const applications = await prisma.application.findMany({
    where,
    include: {
      job: {
        select: { source: true },
      },
    },
    orderBy: { appliedAt: "asc" },
  });

  const totalApplications = applications.length;
  const autoApplied = applications.filter((a) => a.autoApplied).length;
  const manual = totalApplications - autoApplied;

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  for (const app of applications) {
    statusBreakdown[app.status] = (statusBreakdown[app.status] || 0) + 1;
  }

  // Rate calculations
  const pastApplied = applications.filter(
    (a) => a.status !== "PENDING" && a.status !== "APPLIED"
  ).length;
  const interviewReached = applications.filter((a) =>
    [
      "INTERVIEW_SCHEDULED",
      "INTERVIEWED",
      "OFFER_RECEIVED",
      "ACCEPTED",
    ].includes(a.status)
  ).length;
  const offerReached = applications.filter((a) =>
    ["OFFER_RECEIVED", "ACCEPTED"].includes(a.status)
  ).length;

  const responseRate =
    totalApplications > 0
      ? Math.round((pastApplied / totalApplications) * 100)
      : 0;
  const interviewRate =
    totalApplications > 0
      ? Math.round((interviewReached / totalApplications) * 100)
      : 0;
  const offerRate =
    totalApplications > 0
      ? Math.round((offerReached / totalApplications) * 100)
      : 0;

  // Applications by day
  const dayMap = new Map<string, number>();
  for (const app of applications) {
    const day = app.appliedAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }

  // Fill gaps in date range
  const applicationsByDay: Array<{ date: string; count: number }> = [];
  if (applications.length > 0) {
    const start = startDate || applications[0].appliedAt;
    const end = now;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      applicationsByDay.push({
        date: dateStr,
        count: dayMap.get(dateStr) || 0,
      });
      current.setDate(current.getDate() + 1);
    }
  }

  // Top sources
  const sourceMap = new Map<string, number>();
  for (const app of applications) {
    const source = app.job.source;
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  }
  const topSources = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Average time to response
  const responseTimes = applications
    .filter((a) => a.respondedAt)
    .map((a) => {
      const applied = a.appliedAt.getTime();
      const responded = a.respondedAt!.getTime();
      return (responded - applied) / (1000 * 60 * 60 * 24);
    });

  const avgTimeToResponse =
    responseTimes.length > 0
      ? Math.round(
          (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) *
            10
        ) / 10
      : null;

  return Response.json({
    totalApplications,
    autoApplied,
    manual,
    statusBreakdown,
    responseRate,
    interviewRate,
    offerRate,
    applicationsByDay,
    topSources,
    avgTimeToResponse,
  });
}
