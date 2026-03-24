export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray, toJsonArray } from "@/lib/db/json-array";
import { preferencesSchema } from "@/lib/validators/profile";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await prisma.jobPreference.findFirst({
    where: { userId: session.user.id },
  });
  if (!prefs) return NextResponse.json(null);
  return NextResponse.json({
    ...prefs,
    desiredTitles: fromJsonArray(prefs.desiredTitles as string),
    desiredLocations: fromJsonArray(prefs.desiredLocations as string),
    jobTypes: fromJsonArray(prefs.jobTypes as string),
    skills: fromJsonArray(prefs.skills as string),
    excludeCompanies: fromJsonArray(prefs.excludeCompanies as string),
  });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = preferencesSchema.parse(body);

  const dbData = {
    ...data,
    desiredTitles: toJsonArray(data.desiredTitles),
    desiredLocations: toJsonArray(data.desiredLocations),
    jobTypes: toJsonArray(data.jobTypes),
    skills: toJsonArray(data.skills),
    excludeCompanies: toJsonArray(data.excludeCompanies),
  };

  const prefs = await prisma.jobPreference.upsert({
    where: { userId: session.user.id },
    update: dbData,
    create: { userId: session.user.id, ...dbData },
  });

  return NextResponse.json({
    ...prefs,
    desiredTitles: fromJsonArray(prefs.desiredTitles as string),
    desiredLocations: fromJsonArray(prefs.desiredLocations as string),
    jobTypes: fromJsonArray(prefs.jobTypes as string),
    skills: fromJsonArray(prefs.skills as string),
    excludeCompanies: fromJsonArray(prefs.excludeCompanies as string),
  });
}
