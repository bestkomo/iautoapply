import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

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

  // Create Application record immediately (don't wait for browser automation)
  const application = await prisma.application.create({
    data: {
      userId: session.user.id,
      jobId,
      status: "APPLIED",
      autoApplied: true,
      notes: job.applyUrl
        ? `Apply at: ${job.applyUrl}`
        : "Application tracked",
    },
  });

  // Create timeline event
  await prisma.applicationEvent.create({
    data: {
      applicationId: application.id,
      type: "AUTO_APPLIED",
      description: `Applied to ${job.title} at ${job.company}${job.applyUrl ? ` - ${job.applyUrl}` : ""}`,
    },
  });

  return NextResponse.json(
    {
      success: true,
      applicationId: application.id,
      applyUrl: job.applyUrl,
      message: `Applied to ${job.title} at ${job.company}`,
    },
    { status: 201 }
  );
}
