export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { getApplyEmail } from "@/lib/email/apply-email";
import { fetchInboxEmails, markAsRead } from "@/lib/email/imap-client";

// GET — fetch paginated inbox emails via IMAP
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creds = await getApplyEmail(session.user.id);
  if (!creds) {
    return NextResponse.json({
      emails: [],
      total: 0,
      applyEmail: null,
    });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    const { emails, total } = await fetchInboxEmails(creds.address, creds.password, page, limit);

    // Categorize emails
    const categorized = emails.map((email) => ({
      ...email,
      category: categorizeEmail(email.subject, email.bodyText),
    }));

    return NextResponse.json({
      emails: categorized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      applyEmail: creds.address,
    });
  } catch (error) {
    console.error("[ApplyEmail Inbox] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

// PATCH — mark email as read
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creds = await getApplyEmail(session.user.id);
  if (!creds) {
    return NextResponse.json({ error: "No apply email found" }, { status: 404 });
  }

  let body: { uid: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const success = await markAsRead(creds.address, creds.password, body.uid);
  return NextResponse.json({ success });
}

// ─── Email Categorization ────────────────────────────────────────────────────

function categorizeEmail(subject: string, bodyText: string): string {
  const text = `${subject} ${bodyText}`.toLowerCase();

  // Verification
  if (/verif|security code|confirm your|enter.*(code|otp)/i.test(text)) {
    return "verification";
  }

  // Interview invite
  if (/interview|schedule|move forward|next step|phone screen|meet with/i.test(text)) {
    return "interview";
  }

  // Rejection
  if (/unfortunately|regret|not.*(selected|moving)|other candidates|decided.*move forward with/i.test(text)) {
    return "rejection";
  }

  // Application confirmation
  if (/thank you for (applying|your (interest|application))|application (received|submitted|confirm)|we have received/i.test(text)) {
    return "confirmation";
  }

  // Assessment/test
  if (/assessment|test|evaluation|skill.*check/i.test(text)) {
    return "assessment";
  }

  return "other";
}
