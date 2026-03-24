export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { skillSchema } from "@/lib/validators/profile";
import { z } from "zod";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const skills = z.array(skillSchema).parse(body.skills);

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  });

  // Clear existing and re-add
  await prisma.skill.deleteMany({ where: { profileId: profile.id } });
  const created = await prisma.skill.createMany({
    data: skills.map((s) => ({ profileId: profile.id, ...s })),
  });

  return NextResponse.json({ count: created.count }, { status: 201 });
}
