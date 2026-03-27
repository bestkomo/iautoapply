export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { createApplyEmail } from "@/lib/email/apply-email";

// GET — returns user's apply email address (or null)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.applyEmail.findUnique({
    where: { userId: session.user.id },
    select: { address: true, createdAt: true },
  });

  return NextResponse.json({
    applyEmail: record?.address || null,
    createdAt: record?.createdAt || null,
  });
}

// POST — manually create apply email (for paid users)
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check subscription — only paid users get apply email
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  const plan = subscription?.plan || "FREE";
  if (plan === "FREE") {
    return NextResponse.json(
      { error: "Upgrade to PRO or ENTERPRISE to get your application email" },
      { status: 403 }
    );
  }

  const result = await createApplyEmail(session.user.id);
  if (!result) {
    return NextResponse.json(
      { error: "Failed to create apply email. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    applyEmail: result.address,
    message: "Application email created successfully",
  });
}
