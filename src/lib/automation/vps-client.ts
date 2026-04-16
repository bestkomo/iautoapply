/**
 * Client for the VPS automation server.
 * Sends apply requests to the VPS which runs Playwright + Chromium there.
 */

export interface VPSApplyRequest {
  applyUrl: string;
  jobTitle: string;
  company: string;
  profile: {
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    resumePath?: string;
    applyEmail?: string;
    applyEmailPassword?: string;
    qa?: Record<string, unknown>;
  };
}

export interface VPSApplyResponse {
  jobId: string;
  status: "started" | "complete";
  success?: boolean;
  platform?: string;
  message?: string;
}

const VPS_URL = process.env.AUTOMATION_SERVER_URL || "http://216.230.234.67:4000";
const VPS_API_KEY = process.env.AUTOMATION_API_KEY || "iautoaply-7k9xR3mN8pQvL2wY";

/**
 * Send an apply request to the VPS automation server.
 * Returns immediately with a jobId — automation runs in the background on the VPS.
 */
export async function sendApplyRequestToVPS(
  req: VPSApplyRequest
): Promise<VPSApplyResponse> {
  try {
    const res = await fetch(`${VPS_URL}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": VPS_API_KEY,
      },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VPS returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as VPSApplyResponse;
    return data;
  } catch (err) {
    console.error("[VPS Client] Error:", err);
    throw err;
  }
}

/**
 * Upload a resume PDF to the VPS for later use in applications.
 */
export async function uploadResumeToVPS(
  userId: string,
  filename: string,
  buffer: Buffer
): Promise<{ success: boolean; path?: string }> {
  try {
    const res = await fetch(`${VPS_URL}/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": VPS_API_KEY,
      },
      body: JSON.stringify({
        userId,
        filename,
        content: buffer.toString("base64"),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VPS returned ${res.status}: ${text}`);
    }

    return (await res.json()) as { success: boolean; path?: string };
  } catch (err) {
    console.error("[VPS Client] Resume upload error:", err);
    return { success: false };
  }
}

/**
 * Check if a resume is already stored on the VPS for a given user.
 */
export async function checkResumeOnVPS(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${VPS_URL}/resume/${userId}`, {
      headers: { "x-api-key": VPS_API_KEY },
    });
    const data = (await res.json()) as { exists: boolean; path?: string };
    return data.exists ? data.path || null : null;
  } catch {
    return null;
  }
}

/**
 * Check the status of the VPS automation server.
 */
export async function checkVPSHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${VPS_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
