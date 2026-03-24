export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const [coverLetters, total] = await Promise.all([
    prisma.coverLetter.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.coverLetter.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    coverLetters,
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
  const { title, content, jobTitle, company } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    );
  }

  const coverLetter = await prisma.coverLetter.create({
    data: {
      userId: session.user.id,
      title,
      content,
      jobTitle: jobTitle || null,
      company: company || null,
    },
  });

  return NextResponse.json(coverLetter, { status: 201 });
}
