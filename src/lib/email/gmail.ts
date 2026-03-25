// Gmail API client using REST endpoints (no googleapis SDK)

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export function getGmailClient(accessToken: string) {
  async function request(path: string, params?: Record<string, string>) {
    const url = new URL(`${GMAIL_API_BASE}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  return {
    listMessages: (query: string, maxResults = 20) =>
      request("/messages", { q: query, maxResults: String(maxResults) }),
    getMessage: (id: string) =>
      request(`/messages/${id}`, { format: "full" }),
    getProfile: () => request("/profile"),
  };
}

// Search query patterns for application-related emails
const APPLICATION_SEARCH_QUERIES = [
  '"thank you for applying"',
  '"application received"',
  '"interview"',
  '"we regret"',
  '"move forward"',
  '"next steps"',
  '"application status"',
  '"unfortunately"',
  '"pleased to inform"',
  '"schedule an interview"',
  '"we would like to invite"',
  '"your application"',
];

export type EmailStatus =
  | "applied_confirmation"
  | "interview_invite"
  | "rejection"
  | "follow_up";

export interface ParsedEmail {
  id: string;
  from: string;
  subject: string;
  date: string;
  bodyPreview: string;
  status: EmailStatus;
  company: string;
}

export async function fetchApplicationEmails(
  accessToken: string,
  since?: Date
): Promise<ParsedEmail[]> {
  const client = getGmailClient(accessToken);

  // Build search query
  let query = `(${APPLICATION_SEARCH_QUERIES.join(" OR ")})`;
  if (since) {
    const afterDate = Math.floor(since.getTime() / 1000);
    query += ` after:${afterDate}`;
  }

  const listResult = await client.listMessages(query, 50);
  const messageIds: { id: string }[] = listResult.messages || [];

  if (messageIds.length === 0) return [];

  // Fetch full messages (limit to 30 to avoid rate limits)
  const toFetch = messageIds.slice(0, 30);
  const messages = await Promise.all(
    toFetch.map((m) => client.getMessage(m.id))
  );

  return messages.map((msg) => parseEmailContent(msg));
}

function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string
): string {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(payload: Record<string, unknown>): string {
  // Try to get text/plain body
  if (
    payload.mimeType === "text/plain" &&
    payload.body &&
    (payload.body as Record<string, unknown>).data
  ) {
    return decodeBase64Url(
      (payload.body as Record<string, unknown>).data as string
    );
  }

  // Try parts
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      if (
        part.mimeType === "text/plain" &&
        part.body &&
        (part.body as Record<string, unknown>).data
      ) {
        return decodeBase64Url(
          (part.body as Record<string, unknown>).data as string
        );
      }
    }
    // Fallback to text/html
    for (const part of parts) {
      if (
        part.mimeType === "text/html" &&
        part.body &&
        (part.body as Record<string, unknown>).data
      ) {
        const html = decodeBase64Url(
          (part.body as Record<string, unknown>).data as string
        );
        // Strip HTML tags for preview
        return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
    // Recurse into multipart
    for (const part of parts) {
      if ((part.mimeType as string)?.startsWith("multipart/")) {
        const result = extractBody(part);
        if (result) return result;
      }
    }
  }

  return "";
}

function detectStatus(subject: string, body: string): EmailStatus {
  const text = `${subject} ${body}`.toLowerCase();

  // Interview patterns
  if (
    text.includes("interview") ||
    text.includes("schedule a call") ||
    text.includes("would like to invite") ||
    text.includes("move forward") ||
    text.includes("next steps") ||
    text.includes("pleased to inform")
  ) {
    return "interview_invite";
  }

  // Rejection patterns
  if (
    text.includes("we regret") ||
    text.includes("unfortunately") ||
    text.includes("not moving forward") ||
    text.includes("decided not to") ||
    text.includes("other candidates") ||
    text.includes("will not be moving") ||
    text.includes("position has been filled")
  ) {
    return "rejection";
  }

  // Confirmation patterns
  if (
    text.includes("thank you for applying") ||
    text.includes("application received") ||
    text.includes("application has been received") ||
    text.includes("successfully submitted") ||
    text.includes("we have received your")
  ) {
    return "applied_confirmation";
  }

  return "follow_up";
}

function extractCompanyName(from: string): string {
  // "John Doe <john@company.com>" -> try to extract company from email domain
  const nameMatch = from.match(/^([^<]+)/);
  const emailMatch = from.match(/<([^>]+)>/);

  if (emailMatch) {
    const domain = emailMatch[1].split("@")[1];
    if (domain) {
      // Remove common TLDs and clean up
      const company = domain
        .split(".")[0]
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      // If we have a name that looks like a company (not a person), use it
      if (nameMatch) {
        const name = nameMatch[1].trim();
        // If name contains words like "Recruiting", "Careers", "HR", "Team", use it
        if (
          /recruiting|careers|hr|team|talent|hiring|jobs|noreply|no-reply/i.test(
            name
          )
        ) {
          return company;
        }
        return name;
      }
      return company;
    }
  }

  if (nameMatch) return nameMatch[1].trim();
  return from;
}

export function parseEmailContent(email: Record<string, unknown>): ParsedEmail {
  const payload = email.payload as Record<string, unknown>;
  const headers = (payload?.headers || []) as Array<{
    name: string;
    value: string;
  }>;

  const from = getHeader(headers, "From");
  const subject = getHeader(headers, "Subject");
  const date = getHeader(headers, "Date");

  const body = extractBody(payload);
  const bodyPreview = body.slice(0, 200);

  const status = detectStatus(subject, body);
  const company = extractCompanyName(from);

  return {
    id: email.id as string,
    from,
    subject,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    bodyPreview,
    status,
    company,
  };
}

/* ------------------------------------------------------------------ */
/*  Verification Code Reader                                           */
/* ------------------------------------------------------------------ */

/**
 * Search Gmail for a recent verification code email from an ATS platform.
 * Waits up to `maxWaitMs` (polling every `pollIntervalMs`) for the email to arrive.
 * Returns the extracted code or null if not found.
 */
export async function waitForVerificationCode(
  accessToken: string,
  options?: {
    /** Max time to wait in ms (default: 60_000 = 60s) */
    maxWaitMs?: number;
    /** Poll interval in ms (default: 5_000 = 5s) */
    pollIntervalMs?: number;
    /** Only look at emails after this timestamp */
    afterTimestamp?: Date;
    /** Optional sender domain to filter (e.g. "workday.com") */
    senderDomain?: string;
  }
): Promise<string | null> {
  const maxWait = options?.maxWaitMs ?? 60_000;
  const pollInterval = options?.pollIntervalMs ?? 5_000;
  const afterTs = options?.afterTimestamp ?? new Date(Date.now() - 5 * 60_000); // last 5 min
  const senderDomain = options?.senderDomain;

  const client = getGmailClient(accessToken);
  const afterEpoch = Math.floor(afterTs.getTime() / 1000);

  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      // Build Gmail search query for verification code emails
      let query = `(subject:"verification code" OR subject:"verify your email" OR subject:"security code" OR subject:"confirm your" OR subject:"one-time" OR subject:"OTP" OR subject:"passcode") after:${afterEpoch} is:unread`;
      if (senderDomain) {
        query += ` from:${senderDomain}`;
      }

      const listResult = await client.listMessages(query, 5);
      const messageIds: { id: string }[] = listResult.messages || [];

      if (messageIds.length > 0) {
        // Get the most recent matching email
        const msg = await client.getMessage(messageIds[0].id);
        const payload = msg.payload as Record<string, unknown>;
        const body = extractBody(payload);
        const headers = (payload?.headers || []) as Array<{ name: string; value: string }>;
        const subject = getHeader(headers, "Subject");

        // Try to extract the verification code
        const code = extractVerificationCode(subject + " " + body);
        if (code) {
          console.log(`[Gmail] Found verification code: ${code}`);
          return code;
        }
      }
    } catch (err) {
      console.error("[Gmail] Error polling for verification code:", err);
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  console.log("[Gmail] Timed out waiting for verification code");
  return null;
}

/**
 * Extract a verification/OTP code from email text.
 * Looks for common patterns: 4-8 digit codes, alphanumeric codes.
 */
function extractVerificationCode(text: string): string | null {
  // Common patterns for verification codes:

  // Pattern 1: "code is: 123456" or "code: 123456" or "code 123456"
  const codeIsMatch = text.match(/(?:code|passcode|OTP|pin)[\s]*(?:is)?[\s:]*[\s](\d{4,8})/i);
  if (codeIsMatch) return codeIsMatch[1];

  // Pattern 2: "123456 is your verification code"
  const codeBeforeMatch = text.match(/(\d{4,8})[\s]+(?:is your|is the)[\s]+(?:verification|security|one-time)/i);
  if (codeBeforeMatch) return codeBeforeMatch[1];

  // Pattern 3: Standalone 6-digit code on its own line or between spaces
  // Look for a code that's visually prominent (surrounded by whitespace/newlines)
  const standaloneMatch = text.match(/(?:^|\s)(\d{6})(?:\s|$|\.)/m);
  if (standaloneMatch) return standaloneMatch[1];

  // Pattern 4: Bold/emphasized code like **123456** or "123456"
  const emphMatch = text.match(/[*"'](\d{4,8})[*"']/);
  if (emphMatch) return emphMatch[1];

  // Pattern 5: Alphanumeric code (e.g., "AB12CD")
  const alphaMatch = text.match(/(?:code|passcode)[\s:]+([A-Z0-9]{4,8})/i);
  if (alphaMatch) return alphaMatch[1];

  return null;
}
