import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const skip = (page - 1) * limit;

  const where: Prisma.ApplicationWhereInput = {
    userId: session.user.id,
  };

  if (status) {
    const statuses = status.split(",");
    where.status = {
      in: statuses,
    };
  }

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            companyLogo: true,
            location: true,
            remote: true,
            source: true,
          },
        },
        resume: {
          select: { id: true, title: true },
        },
        coverLetter: {
          select: { id: true, title: true },
        },
      },
      orderBy: { appliedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.application.count({ where }),
  ]);

  return NextResponse.json({
    applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, resumeId, coverLetterId, notes } = body;

  if (!jobId) {
    return NextResponse.json(
      { error: "jobId is required" },
      { status: 400 }
    );
  }

  // Check job exists
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
      { error: "You have already applied to this job" },
      { status: 409 }
    );
  }

  const application = await prisma.application.create({
    data: {
      userId: session.user.id,
      jobId,
      resumeId: resumeId || null,
      coverLetterId: coverLetterId || null,
      notes: notes || null,
      status: "APPLIED",
    },
  });

  // Create initial timeline event
  await prisma.applicationEvent.create({
    data: {
      applicationId: application.id,
      type: "APPLIED",
      description: `Applied to ${job.title} at ${job.company}`,
    },
  });

  return NextResponse.json(application, { status: 201 });
}
