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
  streetAddress: null,
  city: null,
  state: null,
  zipCode: null,
  country: "United States",
  visaStatus: null,
  hasBackgroundCheck: true,
  hasDrugTest: true,
  hasMisdemeanor: false,
  currentSalary: null,
  salaryExpectation: null,
  noticeRequired: "2 weeks",
  preferredWorkType: "Full-time",
  willingShifts: "Day",
  willingOvertime: true,
  willingWeekends: true,
  remotePreference: "Hybrid",
  pronouns: null,
  hispanicLatino: "Decline to answer",
  ageRange: "Decline to answer",
  hasNursingLicense: false,
  nursingLicenseState: null,
  hasCPR: false,
  hasBLS: false,
  hasMedicalExperience: null,
  hasReferences: true,
  referenceName1: null,
  referenceEmail1: null,
  referencePhone1: null,
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
    // Address
    streetAddress: (body.streetAddress as string) || null,
    city: (body.city as string) || null,
    state: (body.state as string) || null,
    zipCode: (body.zipCode as string) || null,
    country: (body.country as string) || "United States",
    // Visa
    visaStatus: (body.visaStatus as string) || null,
    // Background
    hasBackgroundCheck: body.hasBackgroundCheck !== false,
    hasDrugTest: body.hasDrugTest !== false,
    hasMisdemeanor: body.hasMisdemeanor === true,
    // Compensation
    currentSalary: body.currentSalary ? Number(body.currentSalary) : null,
    salaryExpectation: (body.salaryExpectation as string) || null,
    noticeRequired: (body.noticeRequired as string) || "2 weeks",
    // Work prefs
    preferredWorkType: (body.preferredWorkType as string) || "Full-time",
    willingShifts: (body.willingShifts as string) || "Day",
    willingOvertime: body.willingOvertime !== false,
    willingWeekends: body.willingWeekends !== false,
    remotePreference: (body.remotePreference as string) || "Hybrid",
    // Demographics ext
    pronouns: (body.pronouns as string) || null,
    hispanicLatino: (body.hispanicLatino as string) || "Decline to answer",
    ageRange: (body.ageRange as string) || "Decline to answer",
    // Healthcare
    hasNursingLicense: body.hasNursingLicense === true,
    nursingLicenseState: (body.nursingLicenseState as string) || null,
    hasCPR: body.hasCPR === true,
    hasBLS: body.hasBLS === true,
    hasMedicalExperience: body.hasMedicalExperience ? Number(body.hasMedicalExperience) : null,
    // References
    hasReferences: body.hasReferences !== false,
    referenceName1: (body.referenceName1 as string) || null,
    referenceEmail1: (body.referenceEmail1 as string) || null,
    referencePhone1: (body.referencePhone1 as string) || null,
  };

  const answers = await prisma.applicationAnswers.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return NextResponse.json(answers);
}
