export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { computeMatchScore } from "@/lib/matching/job-matcher";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q") || "";
  const location = searchParams.get("location") || "";
  const remote = searchParams.get("remote");
  const source = searchParams.get("source");
  const jobType = searchParams.get("jobType");
  const salaryMin = searchParams.get("salaryMin");
  const salaryMax = searchParams.get("salaryMax");
  const sort = searchParams.get("sort") || "date";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.JobWhereInput = {
    isActive: true,
  };

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { company: { contains: q } },
      { description: { contains: q } },
    ];
  }

  if (location) {
    where.location = { contains: location };
  }

  if (remote === "true") {
    where.remote = true;
  }

  if (source) {
    const sources = source.split(",");
    where.source = { in: sources };
  }

  if (jobType) {
    const types = jobType.split(",");
    where.jobType = { in: types };
  }

  if (salaryMin) {
    where.salaryMax = { gte: parseInt(salaryMin) };
  }

  if (salaryMax) {
    where.salaryMin = { lte: parseInt(salaryMax) };
  }

  // Build orderBy
  let orderBy: Prisma.JobOrderByWithRelationInput;
  switch (sort) {
    case "salary":
      orderBy = { salaryMax: { sort: "desc", nulls: "last" } };
      break;
    case "date":
    default:
      orderBy = { postedAt: { sort: "desc", nulls: "last" } };
      break;
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  // Optionally compute match scores for authenticated users
  const session = await getServerSession(authOptions);
  let jobsWithScores = jobs.map((job) => ({
    ...job,
    skills: fromJsonArray(job.skills as string),
    matchScore: null as number | null,
  }));

  if (session?.user?.id) {
    const [preferences, savedJobs] = await Promise.all([
      prisma.jobPreference.findFirst({
        where: { userId: session.user.id },
      }),
      prisma.savedJob.findMany({
        where: {
          userId: session.user.id,
          jobId: { in: jobs.map((j) => j.id) },
        },
        select: { jobId: true },
      }),
    ]);

    const savedJobIds = new Set(savedJobs.map((sj) => sj.jobId));

    jobsWithScores = jobs.map((job) => ({
      ...job,
      skills: fromJsonArray(job.skills as string),
      matchScore: preferences
        ? computeMatchScore(job, preferences).score
        : null,
      isSaved: savedJobIds.has(job.id),
    }));

    // Sort by relevance if requested
    if (sort === "relevance" && preferences) {
      jobsWithScores.sort(
        (a, b) => (b.matchScore || 0) - (a.matchScore || 0)
      );
    }
  }

  return NextResponse.json({
    jobs: jobsWithScores,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
