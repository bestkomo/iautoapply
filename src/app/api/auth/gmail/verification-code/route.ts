export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { waitForVerificationCode } from "@/lib/email/gmail";

/**
 * GET /api/auth/gmail/verification-code
 * Polls the user's Gmail for a recent verification code email.
 * Used by the auto-apply system when an ATS requires email verification.
 *
 * Query params:
 *   - domain: (optional) sender domain to filter (e.g., "workday.com")
 *   - maxWait: (optional) max wait time in seconds (default: 60)
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's Gmail access token
  const user = await prisma.user.findFirst({
    where: { id: session.user.id },
    select: {
      gmailAccessToken: true,
      gmailRefreshToken: true,
      gmailConnectedAt: true,
    },
  });

  if (!user?.gmailAccessToken) {
    return NextResponse.json(
      { error: "Gmail not connected. Please connect Gmail in Settings > Inbox." },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const senderDomain = searchParams.get("domain") || undefined;
  const maxWaitSec = parseInt(searchParams.get("maxWait") || "60", 10);

  try {
    const code = await waitForVerificationCode(user.gmailAccessToken, {
      maxWaitMs: Math.min(maxWaitSec * 1000, 120_000), // Cap at 2 minutes
      pollIntervalMs: 5_000,
      afterTimestamp: new Date(Date.now() - 5 * 60_000), // Last 5 minutes
      senderDomain,
    });

    if (code) {
      return NextResponse.json({ code, found: true });
    } else {
      return NextResponse.json({ code: null, found: false, message: "No verification code found" });
    }
  } catch (error) {
    console.error("[VerificationCode] Error:", error);
    return NextResponse.json(
      { error: "Failed to check Gmail for verification code" },
      { status: 500 }
    );
  }
}
