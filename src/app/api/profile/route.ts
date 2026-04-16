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

  const [profile, subscription] = await Promise.all([
    prisma.userProfile.findFirst({
      where: { userId: session.user.id },
      include: {
        experiences: { orderBy: { sortOrder: "asc" } },
        education: { orderBy: { startDate: "desc" } },
        skills: true,
        certifications: true,
        languages: true,
      },
    }),
    prisma.subscription.findFirst({
      where: { userId: session.user.id },
      select: {
        plan: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
        stripeSubId: true,
      },
    }),
  ]);

  // Determine effective plan (treats expired subscriptions as FREE)
  let effectivePlan = "FREE";
  if (subscription) {
    const now = new Date();
    const active =
      !subscription.currentPeriodEnd ||
      subscription.currentPeriodEnd > now ||
      subscription.plan === "ENTERPRISE";
    effectivePlan = active ? subscription.plan : "FREE";
  }

  if (!profile) {
    return NextResponse.json({
      subscription: subscription
        ? { ...subscription, plan: effectivePlan }
        : { plan: effectivePlan },
    });
  }

  // Parse JSON array fields before sending to frontend
  const response = {
    ...profile,
    experiences: profile.experiences.map((exp) => ({
      ...exp,
      bullets: fromJsonArray(exp.bullets as string),
    })),
    subscription: subscription
      ? { ...subscription, plan: effectivePlan }
      : { plan: effectivePlan },
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
