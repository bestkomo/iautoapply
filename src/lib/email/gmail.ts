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
