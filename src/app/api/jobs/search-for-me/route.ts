export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { computeMatchScore } from "@/lib/matching/job-matcher";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const page = parseInt(searchParams.get("page") || "1");

  // Get user preferences
  const preferences = await prisma.jobPreference.findFirst({
    where: { userId: session.user.id },
  });

  const desiredTitles = fromJsonArray(preferences?.desiredTitles as string);
  const prefSkills = fromJsonArray(preferences?.skills as string);

  if (!preferences || desiredTitles.length === 0) {
    return NextResponse.json(
      {
        error: "No job preferences found. Upload your resume first.",
        jobs: [],
      },
      { status: 400 }
    );
  }

  // Build search query from desired titles
  const titleConditions = desiredTitles.map((title) => ({
    title: { contains: title },
  }));

  // Also search by skills (top 5)
  const skillConditions = prefSkills.slice(0, 5).map((skill) => ({
    OR: [
      { title: { contains: skill } },
      { description: { contains: skill } },
    ],
  }));

  const whereClause = {
    isActive: true,
    OR: [...titleConditions, ...skillConditions],
    ...(preferences.remoteOnly ? { remote: true } : {}),
  };

  // Find jobs matching preferences
  const jobs = await prisma.job.findMany({
    where: whereClause,
    orderBy: { scrapedAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });

  // Compute match scores (note: computeMatchScore takes (job, preferences))
  const jobsWithScores = jobs.map((job) => ({
    ...job,
    skills: fromJsonArray(job.skills as string),
    matchScore: computeMatchScore(job, preferences),
  }));

  // Sort by match score
  jobsWithScores.sort((a, b) => b.matchScore.score - a.matchScore.score);

  const total = await prisma.job.count({ where: whereClause });

  return NextResponse.json({
    jobs: jobsWithScores,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    searchedTitles: desiredTitles,
    searchedSkills: prefSkills.slice(0, 5),
  });
}
