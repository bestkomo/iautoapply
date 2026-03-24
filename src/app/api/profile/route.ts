export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { personalInfoSchema } from "@/lib/validators/profile";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.userProfile.findFirst({
    where: { userId: session.user.id },
    include: {
      experiences: { orderBy: { sortOrder: "asc" } },
      education: { orderBy: { startDate: "desc" } },
      skills: true,
      certifications: true,
      languages: true,
    },
  });

  if (!profile) return NextResponse.json(null);

  // Parse JSON array fields before sending to frontend
  const response = {
    ...profile,
    experiences: profile.experiences.map((exp) => ({
      ...exp,
      bullets: fromJsonArray(exp.bullets as string),
    })),
  };

  return NextResponse.json(response);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = personalInfoSchema.parse(body);

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });

  return NextResponse.json(profile);
}
