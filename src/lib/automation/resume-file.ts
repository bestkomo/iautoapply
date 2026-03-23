import { resolve } from "path";
import { mkdirSync, existsSync, writeFileSync } from "fs";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const UPLOADS_DIR = resolve(process.cwd(), "uploads");

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Saves a user's resume as a PDF file on disk for Playwright to upload.
 * Creates the directory structure if it doesn't exist.
 *
 * @returns The absolute file path where the resume was saved
 */
export async function saveResumeFile(
  userId: string,
  resumeBuffer: Buffer,
  filename: string
): Promise<string> {
  const userDir = resolve(UPLOADS_DIR, userId);

  // Create directory if it doesn't exist
  if (!existsSync(userDir)) {
    mkdirSync(userDir, { recursive: true });
  }

  // Always save as resume.pdf for consistent access
  // Keep the original extension if it's not .pdf
  const ext = filename.toLowerCase().endsWith(".pdf") ? ".pdf" : getExtension(filename);
  const savedFilename = `resume${ext}`;
  const filePath = resolve(userDir, savedFilename);

  writeFileSync(filePath, resumeBuffer);
  console.log(`[ResumeFile] Saved resume for user ${userId} at ${filePath} (${resumeBuffer.length} bytes)`);

  return filePath;
}

/**
 * Returns the absolute path to the user's resume file if it exists, null otherwise.
 */
export function getResumeFilePath(userId: string): string | null {
  const extensions = [".pdf", ".docx", ".doc", ".txt"];

  for (const ext of extensions) {
    const filePath = resolve(UPLOADS_DIR, userId, `resume${ext}`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return ".pdf";
  return filename.substring(lastDot).toLowerCase();
}
