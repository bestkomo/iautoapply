// @ts-expect-error - imapflow has no bundled types
import { ImapFlow } from "imapflow";

const IMAP_HOST = process.env.APPLY_EMAIL_IMAP_HOST || "mail.iautoaply.com";
const IMAP_PORT = parseInt(process.env.APPLY_EMAIL_IMAP_PORT || "993", 10);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InboxEmail {
  uid: number;
  from: string;
  fromName: string;
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  isRead: boolean;
}

// ─── IMAP Connection Helper ──────────────────────────────────────────────────

function createClient(email: string, password: string): InstanceType<typeof ImapFlow> {
  return new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false, // Allow self-signed certs (Mailcow)
    },
  });
}

// ─── Fetch Verification Code ─────────────────────────────────────────────────

const VERIFICATION_PATTERNS = [
  /(?:verification|security|confirm(?:ation)?)\s*code\s*(?:is|:)\s*(\d{4,8})/i,
  /(\d{4,8})\s*is\s*your\s*(?:verification|security|confirm)/i,
  /(?:enter|use)\s*(?:the\s*)?(?:code|OTP)\s*(?:is|:)?\s*(\d{4,8})/i,
  /(?:code|OTP|passcode)\s*[:=]\s*(\d{4,8})/i,
  /\b(\d{6})\b/, // Standalone 6-digit code (common)
];

function extractCode(text: string): string | null {
  for (const pattern of VERIFICATION_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function fetchVerificationCode(
  email: string,
  password: string,
  maxWaitSeconds = 90
): Promise<string | null> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  console.log(`[IMAP] Polling for verification code at ${email} (max ${maxWaitSeconds}s)`);

  while (Date.now() - startTime < maxWaitMs) {
    const client = createClient(email, password);
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        // Search for recent unseen emails (last 5 minutes)
        const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
        const messages = client.fetch(
          { seen: false, since: fiveMinAgo },
          { source: true, envelope: true }
        );

        for await (const msg of messages) {
          const source = msg.source?.toString("utf8") || "";
          const subject = msg.envelope?.subject || "";
          const searchText = `${subject} ${source}`;

          // Check if this is a verification email
          const isVerification =
            /verif|code|security|confirm|OTP|passcode/i.test(subject) ||
            /verif|code|security|confirm|OTP|passcode/i.test(source);

          if (isVerification) {
            const code = extractCode(searchText);
            if (code) {
              console.log(`[IMAP] Found verification code: ${code}`);
              return code;
            }
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (error) {
      console.error("[IMAP] Connection error:", error);
    } finally {
      try { client.close(); } catch { /* ignore */ }
    }

    // Wait 5 seconds before next poll
    if (Date.now() - startTime + 5000 < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 5000));
    } else {
      break;
    }
  }

  console.warn(`[IMAP] No verification code found after ${maxWaitSeconds}s`);
  return null;
}

// ─── Fetch Inbox Emails ──────────────────────────────────────────────────────

export async function fetchInboxEmails(
  email: string,
  password: string,
  page = 1,
  limit = 20
): Promise<{ emails: InboxEmail[]; total: number }> {
  const client = createClient(email, password);
  const emails: InboxEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const total = client.mailbox?.exists || 0;

      if (total === 0) {
        return { emails: [], total: 0 };
      }

      // Calculate range for pagination (newest first)
      const start = Math.max(1, total - (page * limit) + 1);
      const end = Math.max(1, total - ((page - 1) * limit));

      const range = `${start}:${end}`;
      const messages = client.fetch(range, {
        envelope: true,
        bodyStructure: true,
        flags: true,
        source: true,
      });

      for await (const msg of messages) {
        const envelope = msg.envelope;
        const fromAddr = envelope?.from?.[0];
        const source = msg.source?.toString("utf8") || "";

        // Extract plain text body from source (simple extraction)
        let bodyText = "";
        let bodyHtml = "";
        const textMatch = source.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\.\r\n|$)/i);
        const htmlMatch = source.match(/Content-Type: text\/html[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\.\r\n|$)/i);
        if (textMatch) bodyText = textMatch[1].trim();
        if (htmlMatch) bodyHtml = htmlMatch[1].trim();

        emails.push({
          uid: msg.uid,
          from: fromAddr?.address || "unknown",
          fromName: fromAddr?.name || fromAddr?.address || "Unknown",
          subject: envelope?.subject || "(no subject)",
          date: envelope?.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
          bodyText,
          bodyHtml,
          isRead: msg.flags?.has("\\Seen") || false,
        });
      }

      // Reverse to get newest first
      emails.reverse();

      return { emails, total };
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("[IMAP] Error fetching inbox:", error);
    return { emails: [], total: 0 };
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

// ─── Mark Email as Read ──────────────────────────────────────────────────────

export async function markAsRead(
  email: string,
  password: string,
  uid: number
): Promise<boolean> {
  const client = createClient(email, password);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      await client.messageFlagsAdd({ uid }, ["\\Seen"]);
      return true;
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("[IMAP] Error marking as read:", error);
    return false;
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}
