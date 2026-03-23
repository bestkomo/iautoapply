import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { computeMatchScore } from "@/lib/matching/job-matcher";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let matchScore: number | null = null;
  let isSaved = false;

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const [preferences, savedJob] = await Promise.all([
      prisma.jobPreference.findFirst({
        where: { userId: session.user.id },
      }),
      prisma.savedJob.findFirst({
        where: { userId: session.user.id, jobId: id },
      }),
    ]);

    if (preferences) {
      matchScore = computeMatchScore(job, preferences).score;
    }
    isSaved = !!savedJob;
  }

  return NextResponse.json({
    ...job,
    skills: fromJsonArray(job.skills as string),
    matchScore,
    isSaved,
  });
}
