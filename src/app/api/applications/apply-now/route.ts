export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { applyToJobReal, ApplicantProfile } from "@/lib/automation/playwright-apply";
import { getResumeFilePath } from "@/lib/automation/resume-file";
import { getApplyEmail } from "@/lib/email/apply-email";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { jobId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId } = body;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // Fetch the job
  const job = await prisma.job.findFirst({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Check for duplicate application
  const existing = await prisma.application.findFirst({
    where: { userId: session.user.id, jobId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already applied", applicationId: existing.id },
      { status: 409 }
    );
  }

  // Create Application record immediately (PENDING status while browser automation runs)
  const application = await prisma.application.create({
    data: {
      userId: session.user.id,
      jobId,
      status: "PENDING",
      autoApplied: true,
      notes: job.applyUrl
        ? `Apply at: ${job.applyUrl}`
        : "Application tracked",
    },
  });

  // Create initial timeline event
  await prisma.applicationEvent.create({
    data: {
      applicationId: application.id,
      type: "AUTO_APPLY_STARTED",
      description: `Auto-apply started for ${job.title} at ${job.company}`,
    },
  });

  // If there's an apply URL, launch Playwright automation in the background
  if (job.applyUrl) {
    // Fetch user profile data for form filling
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

    // Fetch generated apply email for ATS account creation (Workday, etc.)
    const applyEmailCreds = await getApplyEmail(session.user.id);

    const profile: ApplicantProfile = {
      name: user?.name || "",
      firstName,
      lastName,
      email: applicationEmail,
      phone: userProfile?.phone || undefined,
      location: userProfile?.location || undefined,
      linkedinUrl: userProfile?.linkedinUrl || undefined,
      portfolioUrl: userProfile?.portfolioUrl || undefined,
      resumePath: resumePath || undefined,
      applyEmail: applyEmailCreds?.address,
      applyEmailPassword: applyEmailCreds?.password,
    };

    // Run automation in the background (don't block the API response)
    runAutomationInBackground(application.id, job.applyUrl, profile, job.title, job.company);
  } else {
    // No URL — just mark as applied (manual tracking)
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "APPLIED" },
    });
    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        type: "AUTO_APPLIED",
        description: `Application tracked for ${job.title} at ${job.company} (no apply URL)`,
      },
    });
  }

  return NextResponse.json(
    {
      success: true,
      applicationId: application.id,
      applyUrl: job.applyUrl,
      message: job.applyUrl
        ? `Browser automation started for ${job.title} at ${job.company}`
        : `Applied to ${job.title} at ${job.company}`,
    },
    { status: 201 }
  );
}

/**
 * Runs the Playwright browser automation in the background.
 * Updates the Application record based on the result.
 */
async function runAutomationInBackground(
  applicationId: string,
  applyUrl: string,
  profile: ApplicantProfile,
  jobTitle: string,
  company: string
) {
  try {
    console.log(`[ApplyNow] Starting Playwright automation for application ${applicationId}`);

    const result = await applyToJobReal(applyUrl, profile);

    console.log(`[ApplyNow] Automation result for ${applicationId}:`, result);

    // Update application status based on result
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: result.success ? "APPLIED" : "PENDING",
        notes: `${result.platform}: ${result.message}${result.screenshotPath ? ` | Screenshot: ${result.screenshotPath}` : ""}`,
      },
    });

    // Create timeline event for the result
    await prisma.applicationEvent.create({
      data: {
        applicationId,
        type: result.success ? "AUTO_APPLIED" : "AUTO_APPLY_FAILED",
        description: result.success
          ? `Successfully applied to ${jobTitle} at ${company} via ${result.platform}`
          : `Auto-apply failed for ${jobTitle} at ${company}: ${result.message}`,
      },
    });
  } catch (error) {
    console.error(`[ApplyNow] Background automation error for ${applicationId}:`, error);

    // Update as failed
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "PENDING",
        notes: `Automation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    }).catch(() => {});

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        type: "AUTO_APPLY_FAILED",
        description: `Auto-apply crashed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    }).catch(() => {});
  }
}
