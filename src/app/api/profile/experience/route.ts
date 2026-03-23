import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { toJsonArray, fromJsonArray } from "@/lib/db/json-array";
import { experienceSchema } from "@/lib/validators/profile";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = experienceSchema.parse(body);

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  });

  const experience = await prisma.experience.create({
    data: {
      profileId: profile.id,
      ...data,
      bullets: toJsonArray(data.bullets),
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });

  return NextResponse.json({
    ...experience,
    bullets: fromJsonArray(experience.bullets as string),
  }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.experience.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
