export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

const DEFAULTS = {
  authorizedToWork: true,
  requireSponsorship: false,
  isOver18: true,
  hasDriversLicense: false,
  hasFelonyConviction: false,
  willingToRelocate: true,
  willingToTravel: true,
  desiredSalary: null,
  availableStartDate: "Immediately",
  howDidYouHear: "Job Board",
  yearsOfExperience: 0,
  highestEducation: "Bachelor's",
  gender: "Decline to answer",
  race: "Decline to answer",
  veteranStatus: "Decline to answer",
  disabilityStatus: "Decline to answer",
  linkedinUrl: null,
  portfolioUrl: null,
  preferredName: null,
  customAnswers: "{}",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const answers = await prisma.applicationAnswers.findFirst({
    where: { userId: session.user.id },
  });

  if (!answers) {
    // Return defaults pre-filled with profile data where possible
    const profile = await prisma.userProfile.findFirst({
      where: { userId: session.user.id },
      include: { experiences: true },
    });

    return NextResponse.json({
      ...DEFAULTS,
      linkedinUrl: profile?.linkedinUrl || null,
      portfolioUrl: profile?.portfolioUrl || null,
      yearsOfExperience: profile?.experiences?.length || 0,
    });
  }

  return NextResponse.json(answers);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = {
    authorizedToWork: body.authorizedToWork === true,
    requireSponsorship: body.requireSponsorship === true,
    isOver18: body.isOver18 !== false,
    hasDriversLicense: body.hasDriversLicense === true,
    hasFelonyConviction: body.hasFelonyConviction === true,
    willingToRelocate: body.willingToRelocate !== false,
    willingToTravel: body.willingToTravel !== false,
    desiredSalary: body.desiredSalary ? Number(body.desiredSalary) : null,
    availableStartDate: (body.availableStartDate as string) || "Immediately",
    howDidYouHear: (body.howDidYouHear as string) || "Job Board",
    yearsOfExperience: body.yearsOfExperience ? Number(body.yearsOfExperience) : 0,
    highestEducation: (body.highestEducation as string) || "Bachelor's",
    gender: (body.gender as string) || "Decline to answer",
    race: (body.race as string) || "Decline to answer",
    veteranStatus: (body.veteranStatus as string) || "Decline to answer",
    disabilityStatus: (body.disabilityStatus as string) || "Decline to answer",
    linkedinUrl: (body.linkedinUrl as string) || null,
    portfolioUrl: (body.portfolioUrl as string) || null,
    preferredName: (body.preferredName as string) || null,
    customAnswers: body.customAnswers ? JSON.stringify(body.customAnswers) : "{}",
  };

  const answers = await prisma.applicationAnswers.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return NextResponse.json(answers);
}
