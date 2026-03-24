export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { computeMatchScore } from "@/lib/matching/job-matcher";
import { applyToJobReal, ApplicantProfile } from "@/lib/automation/playwright-apply";
import { getResumeFilePath } from "@/lib/automation/resume-file";
import { canAutoApply } from "@/lib/stripe/check-subscription";

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

  // Check subscription limits
  const { allowed, remaining: subRemaining, plan } = await canAutoApply(session.user.id);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Daily limit reached. Upgrade to Pro for more.",
        remaining: 0,
        plan,
      },
      { status: 429 }
    );
  }

  const preferences = await prisma.jobPreference.findFirst({
    where: { userId: session.user.id },
  });

  if (!preferences) {
    return NextResponse.json(
      { error: "Please set up job preferences first" },
      { status: 400 }
    );
  }

  // Use the lower of subscription limit remaining and preference limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const appliedToday = await prisma.application.count({
    where: {
      userId: session.user.id,
      autoApplied: true,
      appliedAt: { gte: todayStart },
    },
  });

  const prefRemaining = preferences.maxAutoApplyDay - appliedToday;
  const remaining = Math.min(subRemaining, Math.max(0, prefRemaining));
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "Daily auto-apply limit reached", remaining: 0, plan },
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
      id: { notIn: existingApplicationJobIds.length > 0 ? existingApplicationJobIds : ["none"] },
      applyUrl: { not: null },
      ...(preferences.remoteOnly ? { remote: true } : {}),
      ...(excludeCompanies.length > 0
        ? { company: { notIn: excludeCompanies } }
        : {}),
    },
    take: 200,
  });

  // Only keep jobs with DIRECT ATS apply URLs (not aggregator redirects)
  const ATS_DOMAINS = [
    "greenhouse.io", "lever.co", "myworkdayjobs.com", "workday.com",
    "smartrecruiters.com", "icims.com", "paylocity.com", "jobvite.com",
    "ultipro.com", "successfactors.com", "taleo.net", "breezy.hr",
    "ashbyhq.com", "bamboohr.com", "jazz.co", "recruiterbox.com",
    "apply.workable.com", "jobs.lever.co", "boards.greenhouse.io",
  ];

  const directATSJobs = jobs.filter((job) => {
    if (!job.applyUrl) return false;
    const url = job.applyUrl.toLowerCase();
    return ATS_DOMAINS.some((domain) => url.includes(domain));
  });

  console.log(`[AutoApply] Found ${directATSJobs.length} jobs with direct ATS URLs out of ${jobs.length} total`);

  // Score and sort jobs
  const scoredJobs = directATSJobs
    .map((job) => {
      try {
        const result = computeMatchScore(job, preferences);
        return { job, score: result.score };
      } catch (err) {
        console.error("[AutoApply] Score error for job", job.id, err);
        return { job, score: 0 };
      }
    })
    .filter((item) => item.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, remaining);
  console.log("[AutoApply] Found", scoredJobs.length, "matching jobs, top scores:", scoredJobs.slice(0, 5).map(j => `${j.job.title}: ${j.score}%`));

  // Fetch user profile for Playwright automation
  const [user, userProfile] = await Promise.all([
    prisma.user.findFirst({ where: { id: session.user.id } }),
    prisma.userProfile.findFirst({ where: { userId: session.user.id } }),
  ]);

  const nameParts = (user?.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const resumePath = getResumeFilePath(session.user.id);

  // Prefer resume/profile email over OAuth email for job applications
  // The OAuth email (e.g. Google account) may differ from the contact email on the resume
  const applicationEmail = userProfile?.email || user?.email || "";

  const applicantProfile: ApplicantProfile = {
    name: user?.name || "",
    firstName,
    lastName,
    email: applicationEmail,
    phone: userProfile?.phone || undefined,
    location: userProfile?.location || undefined,
    linkedinUrl: userProfile?.linkedinUrl || undefined,
    portfolioUrl: userProfile?.portfolioUrl || undefined,
    resumePath: resumePath || undefined,
  };

  // Create Application records and trigger automation
  let applied = 0;
  const automationPromises: Promise<void>[] = [];

  for (const { job, score } of scoredJobs) {
    try {
      const application = await prisma.application.create({
        data: {
          userId: session.user.id,
          jobId: job.id,
          status: "PENDING",
          autoApplied: true,
          matchScore: score,
          appliedAt: new Date(),
          notes: `Auto-apply queued with ${score}% match score`,
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          type: "AUTO_APPLY_STARTED",
          description: `Auto-apply started for ${job.title} at ${job.company} (${score}% match)`,
        },
      });

      applied++;

      // If the job has an apply URL, queue the Playwright automation
      if (job.applyUrl) {
        const automationTask = runAutomation(
          application.id,
          job.applyUrl,
          applicantProfile,
          job.title,
          job.company
        );
        automationPromises.push(automationTask);
      } else {
        // No URL — just mark as applied (tracked only)
        await prisma.application.update({
          where: { id: application.id },
          data: {
            status: "APPLIED",
            notes: `Auto-applied with ${score}% match score (no apply URL - tracked only)`,
          },
        });
      }
    } catch (error) {
      console.error(`Failed to auto-apply for job ${job.id}:`, error);
    }
  }

  // Run up to 3 Playwright automations in parallel (don't block the response)
  if (automationPromises.length > 0) {
    runBatchAutomation(automationPromises);
  }

  // Enable auto-apply preference
  try {
    await prisma.jobPreference.updateMany({
      where: { userId: session.user.id },
      data: { autoApplyEnabled: true },
    });
  } catch (e) {
    console.error("[AutoApply] Failed to enable preference:", e);
  }

  return NextResponse.json({
    success: true,
    applied,
    message: `Queued ${applied} job${applied !== 1 ? "s" : ""} for auto-apply`,
  });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Disable auto-apply preference
  try {
    await prisma.jobPreference.updateMany({
      where: { userId: session.user.id },
      data: { autoApplyEnabled: false },
    });
  } catch (e) {
    console.error("[AutoApply] Failed to disable preference:", e);
  }

  return NextResponse.json({ success: true, message: "Auto-apply disabled" });
}

/* ------------------------------------------------------------------ */
/*  Background automation helpers                                      */
/* ------------------------------------------------------------------ */

/**
 * Run a single Playwright automation and update the DB with the result.
 */
async function runAutomation(
  applicationId: string,
  applyUrl: string,
  profile: ApplicantProfile,
  jobTitle: string,
  company: string
): Promise<void> {
  try {
    console.log(`[AutoApply] Running Playwright for application ${applicationId}: ${applyUrl}`);

    const result = await applyToJobReal(applyUrl, profile);

    console.log(`[AutoApply] Result for ${applicationId}:`, {
      success: result.success,
      platform: result.platform,
      message: result.message,
    });

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: result.success ? "APPLIED" : "PENDING",
        notes: `${result.platform}: ${result.message}`,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        type: result.success ? "AUTO_APPLIED" : "AUTO_APPLY_FAILED",
        description: result.success
          ? `Applied to ${jobTitle} at ${company} via ${result.platform}`
          : `Auto-apply failed for ${jobTitle} at ${company}: ${result.message}`,
      },
    });
  } catch (error) {
    console.error(`[AutoApply] Automation error for ${applicationId}:`, error);
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "PENDING",
        notes: `Automation error: ${error instanceof Error ? error.message : "Unknown"}`,
      },
    }).catch(() => {});
  }
}

/**
 * Run batches of 3 automations in parallel from the full list.
 * This runs in the background and does not block the API response.
 */
async function runBatchAutomation(tasks: Promise<void>[]) {
  const BATCH_SIZE = 1; // Run 1 at a time for easier debugging

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch);
  }

  console.log(`[AutoApply] All ${tasks.length} automation tasks completed`);
}
