import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import {
  fetchApplicationEmails,
  type ParsedEmail,
  type EmailStatus,
} from "@/lib/email/gmail";

interface InboxItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  preview: string;
  status: "confirmed" | "interview" | "rejected" | "pending";
  company: string;
  source: "gmail" | "application";
}

function mapEmailStatus(
  emailStatus: EmailStatus
): InboxItem["status"] {
  switch (emailStatus) {
    case "applied_confirmation":
      return "confirmed";
    case "interview_invite":
      return "interview";
    case "rejection":
      return "rejected";
    case "follow_up":
    default:
      return "pending";
  }
}

function mapApplicationStatus(status: string): InboxItem["status"] {
  switch (status) {
    case "APPLIED":
    case "PENDING":
      return "confirmed";
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEWED":
      return "interview";
    case "REJECTED":
      return "rejected";
    default:
      return "pending";
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const items: InboxItem[] = [];

  // Get user's Gmail token from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailAccessToken: true, gmailRefreshToken: true },
  });

  let gmailConnected = false;

  if (user?.gmailAccessToken) {
    gmailConnected = true;
    try {
      // Fetch emails from the last 30 days
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const emails: ParsedEmail[] = await fetchApplicationEmails(
        user.gmailAccessToken,
        since
      );

      for (const email of emails) {
        items.push({
          id: `gmail-${email.id}`,
          from: email.from,
          subject: email.subject,
          date: email.date,
          preview: email.bodyPreview,
          status: mapEmailStatus(email.status),
          company: email.company,
          source: "gmail",
        });
      }
    } catch (err) {
      console.error("Failed to fetch Gmail emails:", err);
      // If token expired, we might need to refresh
      // For now, continue with application data
    }
  }

  // Get application status updates
  const applications = await prisma.application.findMany({
    where: { userId },
    include: {
      job: {
        select: { title: true, company: true },
      },
    },
    orderBy: { appliedAt: "desc" },
    take: 50,
  });

  for (const app of applications) {
    items.push({
      id: `app-${app.id}`,
      from: app.job.company,
      subject: `Application: ${app.job.title} at ${app.job.company}`,
      date: (app.respondedAt || app.appliedAt).toISOString(),
      preview: `Your application for ${app.job.title} is currently ${app.status.toLowerCase().replace(/_/g, " ")}`,
      status: mapApplicationStatus(app.status),
      company: app.job.company,
      source: "application",
    });
  }

  // Sort all items by date (newest first)
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // If no Gmail and no applications, return mock data
  if (items.length === 0 && !gmailConnected) {
    return NextResponse.json({
      gmailConnected: false,
      items: [
        {
          id: "mock-1",
          from: "iAutoApply",
          subject: "Connect your Gmail to see application responses",
          date: new Date().toISOString(),
          preview:
            "Connect your Gmail account to automatically track responses from companies you've applied to. We'll monitor your inbox for interview invites, application confirmations, and status updates.",
          status: "pending",
          company: "iAutoApply",
          source: "application" as const,
        },
      ],
    });
  }

  return NextResponse.json({
    gmailConnected,
    items,
  });
}
