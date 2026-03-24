export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const application = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
    include: {
      job: true,
      resume: { select: { id: true, title: true } },
      coverLetter: { select: { id: true, title: true } },
      timeline: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!application)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(application);
}

export async function PUT(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, notes, followUpDate } = body;

  const existing = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
    include: { job: { select: { title: true, company: true } } },
  });

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (followUpDate !== undefined) {
    updateData.followUpDate = followUpDate ? new Date(followUpDate) : null;
  }

  // Track status change and response
  if (status && status !== existing.status) {
    const statusResponses = [
      "VIEWED",
      "INTERVIEW_SCHEDULED",
      "INTERVIEWED",
      "OFFER_RECEIVED",
      "ACCEPTED",
      "REJECTED",
    ];
    if (
      statusResponses.includes(status) &&
      !existing.respondedAt
    ) {
      updateData.respondedAt = new Date();
    }
  }

  const application = await prisma.application.update({
    where: { id },
    data: updateData,
  });

  // Create timeline event for status change
  if (status && status !== existing.status) {
    await prisma.applicationEvent.create({
      data: {
        applicationId: id,
        type: "STATUS_CHANGE",
        description: `Status changed from ${existing.status} to ${status}`,
      },
    });
  }

  return NextResponse.json(application);
}
