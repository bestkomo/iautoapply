import { prisma } from "@/lib/db/prisma";
import crypto from "crypto";

const APPLY_EMAIL_DOMAIN = process.env.APPLY_EMAIL_DOMAIN || "apply.iautoaply.com";
const ENCRYPTION_KEY = process.env.APPLY_EMAIL_ENCRYPTION_KEY || "";

// ─── Password Encryption (AES-256-GCM) ──────────────────────────────────────

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    // Fallback: derive key from a secret for development
    return crypto.createHash("sha256").update(ENCRYPTION_KEY || "dev-key-change-in-production").digest();
  }
  return Buffer.from(ENCRYPTION_KEY, "hex");
}

export function encryptPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:encrypted (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPassword(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted password format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ─── Local Part Generation ───────────────────────────────────────────────────

export function generateLocalPart(userId: string, userName?: string | null): string {
  const shortId = userId.slice(-6).toLowerCase();
  if (userName) {
    const parts = userName.trim().toLowerCase().split(/\s+/);
    const first = parts[0]?.replace(/[^a-z]/g, "").slice(0, 10) || "user";
    const lastInitial = parts[parts.length - 1]?.[0]?.replace(/[^a-z]/g, "") || "";
    return `${first}${lastInitial ? "-" + lastInitial : ""}-${shortId}`;
  }
  return `user-${shortId}`;
}

// ─── Generate Secure Password ────────────────────────────────────────────────

export function generateMailboxPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(20);
  let password = "";
  for (let i = 0; i < 20; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

// ─── Mailcow API Integration ─────────────────────────────────────────────────

const MAILCOW_API_URL = process.env.MAILCOW_API_URL || "";
const MAILCOW_API_KEY = process.env.MAILCOW_API_KEY || "";

// Note: Mailcow server uses Let's Encrypt SSL (mail.iautoaply.com)

async function createMailboxOnServer(localPart: string, password: string, userName?: string | null): Promise<boolean> {
  if (!MAILCOW_API_URL || !MAILCOW_API_KEY) {
    console.warn("[ApplyEmail] Mailcow not configured, skipping mailbox creation on server");
    return true; // Allow DB record creation even without mail server (for dev)
  }

  try {
    const res = await fetch(`${MAILCOW_API_URL}/add/mailbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": MAILCOW_API_KEY,
      },
      body: JSON.stringify({
        local_part: localPart,
        domain: APPLY_EMAIL_DOMAIN,
        password: password,
        password2: password,
        name: userName || "iAutoApply User",
        quota: 256, // 256 MB per mailbox
        active: 1,
        force_pw_update: 0,
        tls_enforce_in: 0,
        tls_enforce_out: 0,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[ApplyEmail] Mailcow API error ${res.status}: ${body}`);
      return false;
    }

    const data = await res.json();
    console.log("[ApplyEmail] Mailbox created on server:", data);
    return true;
  } catch (error) {
    console.error("[ApplyEmail] Failed to create mailbox on server:", error);
    return false;
  }
}

async function deleteMailboxOnServer(localPart: string): Promise<boolean> {
  if (!MAILCOW_API_URL || !MAILCOW_API_KEY) return true;

  try {
    const res = await fetch(`${MAILCOW_API_URL}/delete/mailbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": MAILCOW_API_KEY,
      },
      body: JSON.stringify([`${localPart}@${APPLY_EMAIL_DOMAIN}`]),
    });

    return res.ok;
  } catch (error) {
    console.error("[ApplyEmail] Failed to delete mailbox:", error);
    return false;
  }
}

// ─── Main Functions ──────────────────────────────────────────────────────────

export async function createApplyEmail(userId: string): Promise<{ address: string; password: string } | null> {
  // Check if already exists
  const existing = await prisma.applyEmail.findUnique({ where: { userId } });
  if (existing) {
    return {
      address: existing.address,
      password: decryptPassword(existing.password),
    };
  }

  // Get user info for name-based local part
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const localPart = generateLocalPart(userId, user?.name);
  const password = generateMailboxPassword();
  const address = `${localPart}@${APPLY_EMAIL_DOMAIN}`;

  // Create mailbox on mail server
  const serverCreated = await createMailboxOnServer(localPart, password, user?.name);
  if (!serverCreated) {
    console.error("[ApplyEmail] Failed to create mailbox on server for user:", userId);
    return null;
  }

  // Save to database with encrypted password
  const encryptedPassword = encryptPassword(password);
  await prisma.applyEmail.create({
    data: {
      userId,
      address,
      localPart,
      password: encryptedPassword,
    },
  });

  console.log(`[ApplyEmail] Created apply email: ${address} for user: ${userId}`);
  return { address, password };
}

export async function getApplyEmail(userId: string): Promise<{ address: string; password: string } | null> {
  const record = await prisma.applyEmail.findUnique({ where: { userId } });
  if (!record) return null;

  return {
    address: record.address,
    password: decryptPassword(record.password),
  };
}

export async function deleteApplyEmail(userId: string): Promise<boolean> {
  const record = await prisma.applyEmail.findUnique({ where: { userId } });
  if (!record) return true;

  await deleteMailboxOnServer(record.localPart);
  await prisma.applyEmail.delete({ where: { userId } });

  console.log(`[ApplyEmail] Deleted apply email: ${record.address}`);
  return true;
}
