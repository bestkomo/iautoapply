import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { computeMatchScore } from "@/lib/matching/job-matcher";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preferences = await prisma.jobPreference.findFirst({
    where: { userId: session.user.id },
  });

  if (!preferences) {
    return NextResponse.json({
      enabled: false,
      stats: { appliedToday: 0, inQueue: 0, successRate: 0 },
      recentApplications: [],
    });
  }

  // Count today's auto-applied applications
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [appliedToday, totalAutoApplied, totalResponded, recentApplications] =
    await Promise.all([
      prisma.application.count({
        where: {
          userId: session.user.id,
          autoApplied: true,
          appliedAt: { gte: todayStart },
        },
      }),
      prisma.application.count({
        where: {
          userId: session.user.id,
          autoApplied: true,
        },
      }),
      prisma.application.count({
        where: {
          userId: session.user.id,
          autoApplied: true,
          respondedAt: { not: null },
        },
      }),
      prisma.application.findMany({
        where: {
          userId: session.user.id,
          autoApplied: true,
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              companyLogo: true,
              location: true,
            },
          },
        },
        orderBy: { appliedAt: "desc" },
        take: 10,
      }),
    ]);

  // Count pending applications as "in queue"
  const pendingCount = await prisma.application.count({
    where: {
      userId: session.user.id,
      autoApplied: true,
      status: "PENDING",
    },
  });

  const successRate =
    totalAutoApplied > 0
      ? Math.round((totalResponded / totalAutoApplied) * 100)
      : 0;

  return NextResponse.json({
    enabled: preferences.autoApplyEnabled,
    stats: {
      appliedToday,
      inQueue: pendingCount,
      successRate,
      totalApplied: totalAutoApplied,
    },
    recentApplications,
    preferences: {
      maxPerDay: preferences.maxAutoApplyDay,
      titles: fromJsonArray(preferences.desiredTitles as string),
      locations: fromJsonArray(preferences.desiredLocations as string),
      remoteOnly: preferences.remoteOnly,
    },
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preferences = await prisma.jobPreference.findFirst({
    where: { userId: session.user.id },
  });

  if (!preferences) {
    return NextResponse.json(
      { error: "Please set up job preferences first" },
      { status: 400 }
    );
  }

  // Count today's applications to respect limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const appliedToday = await prisma.application.count({
    where: {
      userId: session.user.id,
      autoApplied: true,
      appliedAt: { gte: todayStart },
    },
  });

  const remaining = preferences.maxAutoApplyDay - appliedToday;
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "Daily auto-apply limit reached" },
      { status: 429 }
    );
  }

  // Find matching jobs that haven't been applied to
  const existingApplicationJobIds = (
    await prisma.application.findMany({
      where: { userId: session.user.id },
      select: { jobId: true },
    })
  ).map((a) => a.jobId);

  // Build job search filters from preferences
  const excludeCompanies = fromJsonArray(preferences.excludeCompanies as string);
  const jobs = await prisma.job.findMany({
    where: {
      isActive: true,
      id: { notIn: existingApplicationJobIds },
      ...(preferences.remoteOnly ? { remote: true } : {}),
      ...(excludeCompanies.length > 0
        ? {
            company: {
              notIn: excludeCompanies,
            },
          }
        : {}),
    },
    take: 100, // Get a batch to score
  });

  // Score and sort jobs
  console.log("[AutoApply] Scoring", jobs.length, "candidate jobs");
  const scoredJobs = jobs
    .map((job) => {
      try {
        const result = computeMatchScore(job, preferences);
        return { job, score: result.score };
      } catch (err) {
        console.error("[AutoApply] Score error for job", job.id, err);
        return { job, score: 0 };
      }
    })
    .filter((item) => item.score >= 15) // Minimum 15% match for broader coverage
    .sort((a, b) => b.score - a.score)
    .slice(0, remaining);
  console.log("[AutoApply] Found", scoredJobs.length, "matching jobs, top scores:", scoredJobs.slice(0, 5).map(j => `${j.job.title}: ${j.score}%`));

  // Get user's default resume
  const defaultResume = await prisma.resume.findFirst({
    where: { userId: session.user.id, isDefault: true },
    select: { id: true },
  });

  // Create Application records directly for matching jobs
  let applied = 0;
  for (const { job, score } of scoredJobs) {
    try {
      await prisma.application.create({
        data: {
          userId: session.user.id,
          jobId: job.id,
          resumeId: defaultResume?.id || null,
          status: "APPLIED",
          autoApplied: true,
          matchScore: score,
          appliedAt: new Date(),
          notes: `Auto-applied with ${score}% match score`,
        },
      });
      applied++;
    } catch (error) {
      // Skip duplicate applications (unique constraint) or other errors
      console.error(`Failed to auto-apply for job ${job.id}:`, error);
    }
  }

  // Enable auto-apply
  await prisma.jobPreference.update({
    where: { userId: session.user.id },
    data: { autoApplyEnabled: true },
  });

  return NextResponse.json({
    success: true,
    applied,
    message: `Applied to ${applied} job${applied !== 1 ? "s" : ""} automatically`,
  });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Disable auto-apply
  await prisma.jobPreference.update({
    where: { userId: session.user.id },
    data: { autoApplyEnabled: false },
  });

  return NextResponse.json({ success: true, message: "Auto-apply disabled" });
}
