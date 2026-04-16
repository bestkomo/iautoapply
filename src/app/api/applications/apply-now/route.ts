export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { ApplicantProfile } from "@/lib/automation/playwright-apply";
import { getResumeFilePath } from "@/lib/automation/resume-file";
import { getApplyEmail } from "@/lib/email/apply-email";
import { sendApplyRequestToVPS, checkResumeOnVPS, uploadResumeToVPS } from "@/lib/automation/vps-client";
import { generateAndUploadTailoredResume } from "@/lib/automation/tailored-resume";
import { readFile } from "fs/promises";

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
    const [user, userProfile, answers] = await Promise.all([
      prisma.user.findFirst({ where: { id: session.user.id } }),
      prisma.userProfile.findFirst({ where: { userId: session.user.id } }),
      prisma.applicationAnswers.findFirst({ where: { userId: session.user.id } }),
    ]);

    const nameParts = (user?.name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const localResumePath = getResumeFilePath(session.user.id);

    // Make sure the user's resume is on the VPS — Playwright runs there.
    let resumePath: string | null = await checkResumeOnVPS(session.user.id);
    if (!resumePath && localResumePath) {
      try {
        const buffer = await readFile(localResumePath);
        const result = await uploadResumeToVPS(session.user.id, "resume.pdf", buffer);
        if (result.success && result.path) {
          resumePath = result.path;
          console.log("[ApplyNow] Pushed resume to VPS:", result.path);
        }
      } catch (e) {
        console.error("[ApplyNow] Resume push to VPS failed:", e);
      }
    }

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
      qa: answers ? {
        authorizedToWork: answers.authorizedToWork,
        requireSponsorship: answers.requireSponsorship,
        isOver18: answers.isOver18,
        hasDriversLicense: answers.hasDriversLicense,
        hasFelonyConviction: answers.hasFelonyConviction,
        willingToRelocate: answers.willingToRelocate,
        willingToTravel: answers.willingToTravel,
        desiredSalary: answers.desiredSalary ?? undefined,
        availableStartDate: answers.availableStartDate ?? undefined,
        howDidYouHear: answers.howDidYouHear,
        yearsOfExperience: answers.yearsOfExperience,
        highestEducation: answers.highestEducation,
        gender: answers.gender,
        race: answers.race,
        veteranStatus: answers.veteranStatus,
        disabilityStatus: answers.disabilityStatus,
        // Address
        streetAddress: answers.streetAddress ?? undefined,
        city: answers.city ?? undefined,
        state: answers.state ?? undefined,
        zipCode: answers.zipCode ?? undefined,
        country: answers.country,
        // Visa
        visaStatus: answers.visaStatus ?? undefined,
        // Background
        hasBackgroundCheck: answers.hasBackgroundCheck,
        hasDrugTest: answers.hasDrugTest,
        hasMisdemeanor: answers.hasMisdemeanor,
        // Compensation
        currentSalary: answers.currentSalary ?? undefined,
        salaryExpectation: answers.salaryExpectation ?? undefined,
        noticeRequired: answers.noticeRequired,
        // Work prefs
        preferredWorkType: answers.preferredWorkType,
        willingShifts: answers.willingShifts,
        willingOvertime: answers.willingOvertime,
        willingWeekends: answers.willingWeekends,
        remotePreference: answers.remotePreference,
        // Demographics ext
        pronouns: answers.pronouns ?? undefined,
        hispanicLatino: answers.hispanicLatino,
        ageRange: answers.ageRange,
        // Healthcare
        hasNursingLicense: answers.hasNursingLicense,
        nursingLicenseState: answers.nursingLicenseState ?? undefined,
        hasCPR: answers.hasCPR,
        hasBLS: answers.hasBLS,
        hasMedicalExperience: answers.hasMedicalExperience ?? undefined,
        // References
        hasReferences: answers.hasReferences,
        referenceName1: answers.referenceName1 ?? undefined,
        referenceEmail1: answers.referenceEmail1 ?? undefined,
        referencePhone1: answers.referencePhone1 ?? undefined,
      } : undefined,
    };

    // Tailor the resume for this job, then run automation in the background.
    (async () => {
      try {
        const tailoredPath = await generateAndUploadTailoredResume(
          session.user.id,
          job.id,
          job.title,
          job.description || "",
          job.company
        );
        if (tailoredPath) {
          profile.resumePath = tailoredPath;
          await prisma.applicationEvent.create({
            data: {
              applicationId: application.id,
              type: "RESUME_TAILORED",
              description: `AI-tailored resume generated for ${job.title} at ${job.company}`,
            },
          });
        }
      } catch (err) {
        console.error("[ApplyNow] Tailor resume failed (using original):", err);
      }
      runAutomationInBackground(application.id, job.applyUrl!, profile, job.title, job.company);
    })();
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
    console.log(`[ApplyNow] Sending to VPS automation server for application ${applicationId}`);

    // Send request to VPS — Playwright runs THERE, not on Render
    const vpsResult = await sendApplyRequestToVPS({
      applyUrl,
      jobTitle,
      company,
      profile: {
        name: profile.name,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedinUrl: profile.linkedinUrl,
        portfolioUrl: profile.portfolioUrl,
        resumePath: profile.resumePath,
        applyEmail: profile.applyEmail,
        applyEmailPassword: profile.applyEmailPassword,
        qa: profile.qa as unknown as Record<string, unknown>,
      },
    });

    console.log(`[ApplyNow] VPS accepted job ${vpsResult.jobId} for application ${applicationId}`);

    // Mark as APPLIED — VPS will run the actual automation in the background.
    // Status updates could come via webhook from VPS later (not implemented yet).
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "APPLIED",
        notes: `Sent to VPS automation | Job ID: ${vpsResult.jobId}`,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        type: "AUTO_APPLIED",
        description: `Automation dispatched to VPS for ${jobTitle} at ${company}`,
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
