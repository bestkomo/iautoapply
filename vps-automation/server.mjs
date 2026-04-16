/**
 * iAutoApply Automation Server
 * Runs on VPS, receives job application requests, uses Playwright to submit them.
 */
import express from "express";
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.AUTOMATION_API_KEY || "iautoaply-secret-change-me";
const SCREENSHOT_DIR = "/var/lib/iautoaply/screenshots";
const RESUME_DIR = "/var/lib/iautoaply/resumes";

// Ensure directories exist
await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
await fs.mkdir(RESUME_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "25mb" }));

// Auth middleware
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Upload resume (base64 encoded)
app.post("/resume", async (req, res) => {
  try {
    const { userId, filename, content } = req.body;
    if (!userId || !content) {
      return res.status(400).json({ error: "userId and content required" });
    }
    const userDir = path.join(RESUME_DIR, userId);
    await fs.mkdir(userDir, { recursive: true });
    const filePath = path.join(userDir, filename || "resume.pdf");
    const buffer = Buffer.from(content, "base64");
    await fs.writeFile(filePath, buffer);
    res.json({ success: true, path: filePath });
  } catch (err) {
    console.error("Resume upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Check if resume exists
app.get("/resume/:userId", async (req, res) => {
  const filePath = path.join(RESUME_DIR, req.params.userId, "resume.pdf");
  try {
    await fs.access(filePath);
    res.json({ exists: true, path: filePath });
  } catch {
    res.json({ exists: false });
  }
});

// Main apply endpoint
app.post("/apply", async (req, res) => {
  const { applyUrl, profile, jobTitle, company } = req.body;

  if (!applyUrl || !profile) {
    return res.status(400).json({ error: "applyUrl and profile required" });
  }

  console.log(`[${new Date().toISOString()}] Applying: ${jobTitle} @ ${company} -> ${applyUrl}`);

  // Respond immediately, run automation in background
  const jobId = crypto.randomBytes(8).toString("hex");
  res.json({ jobId, status: "started", message: "Automation started" });

  runApply(jobId, applyUrl, profile, jobTitle, company).catch(err => {
    console.error(`[${jobId}] Failed:`, err.message);
  });
});

// Status check (optional - results are POSTed back via webhook)
const jobResults = new Map();
app.get("/apply/:jobId", (req, res) => {
  const result = jobResults.get(req.params.jobId);
  if (!result) return res.json({ status: "running" });
  res.json(result);
});

async function runApply(jobId, applyUrl, profile, jobTitle, company) {
  const startTime = Date.now();
  let browser;
  let platform = "unknown";
  let screenshotPath = null;

  try {
    const url = applyUrl.toLowerCase();
    if (url.includes("greenhouse.io")) platform = "greenhouse";
    else if (url.includes("lever.co")) platform = "lever";
    else if (url.includes("myworkdayjobs.com") || url.includes("workday.com")) platform = "workday";
    else if (url.includes("smartrecruiters.com")) platform = "smartrecruiters";
    else if (url.includes("icims.com")) platform = "icims";
    else if (url.includes("paylocity.com")) platform = "paylocity";
    else platform = "generic";

    console.log(`[${jobId}] Platform: ${platform}`);

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    await page.goto(applyUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Dismiss cookie banners
    await dismissPopups(page);

    // Platform-specific handling
    let result;
    if (platform === "greenhouse") result = await handleGreenhouse(page, profile, jobId);
    else if (platform === "lever") result = await handleLever(page, profile, jobId);
    else if (platform === "workday") result = await handleWorkday(page, profile, jobId);
    else result = await handleGeneric(page, profile, jobId);

    screenshotPath = path.join(SCREENSHOT_DIR, `${jobId}-${platform}-final.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const duration = Date.now() - startTime;
    console.log(`[${jobId}] Done in ${duration}ms - ${result.success ? "SUCCESS" : "FAILED"}: ${result.message}`);

    jobResults.set(jobId, {
      status: "complete",
      success: result.success,
      platform,
      message: result.message,
      screenshotPath,
      duration,
    });
  } catch (err) {
    console.error(`[${jobId}] Error:`, err.message);
    jobResults.set(jobId, {
      status: "complete",
      success: false,
      platform,
      message: `Error: ${err.message}`,
      screenshotPath,
      duration: Date.now() - startTime,
    });
  } finally {
    if (browser) await browser.close().catch(() => {});

    // Clean up old results after 1 hour
    setTimeout(() => jobResults.delete(jobId), 3600000);
  }
}

async function dismissPopups(page) {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Got it")',
    '[id*="cookie"] button',
    '[class*="cookie"] button',
  ];
  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 1000 });
      await page.waitForTimeout(500);
    } catch {}
  }
}

async function handleGreenhouse(page, profile, jobId) {
  try {
    // Click "Apply" button if present
    await tryClick(page, [
      'a:has-text("Apply for this job")',
      'button:has-text("Apply")',
      'a:has-text("Apply")',
    ]);
    await page.waitForTimeout(2000);

    // Fill fields
    await tryFill(page, 'input[name="first_name"], input[id*="first_name"]', profile.firstName);
    await tryFill(page, 'input[name="last_name"], input[id*="last_name"]', profile.lastName);
    await tryFill(page, 'input[type="email"]', profile.email);
    await tryFill(page, 'input[type="tel"], input[name*="phone"]', profile.phone || "");

    // Upload resume
    if (profile.resumePath) {
      await tryUpload(page, 'input[type="file"]', profile.resumePath);
    }

    // Scroll to bottom to reveal all fields
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Take screenshot before submit
    const screenshotPath = path.join(SCREENSHOT_DIR, `${jobId}-greenhouse-pre-submit.png`);
    await page.screenshot({ path: screenshotPath });

    // For safety, don't actually submit yet - just verify we got this far
    return { success: true, message: "Greenhouse form filled (dry-run mode)" };
  } catch (err) {
    return { success: false, message: `Greenhouse: ${err.message}` };
  }
}

async function handleLever(page, profile, jobId) {
  try {
    await tryClick(page, ['a.postings-btn:has-text("Apply")', 'a:has-text("Apply")']);
    await page.waitForTimeout(2000);

    await tryFill(page, 'input[name="name"]', profile.name);
    await tryFill(page, 'input[name="email"]', profile.email);
    await tryFill(page, 'input[name="phone"]', profile.phone || "");

    if (profile.resumePath) {
      await tryUpload(page, 'input[type="file"][name="resume"], input[type="file"]', profile.resumePath);
    }

    return { success: true, message: "Lever form filled (dry-run mode)" };
  } catch (err) {
    return { success: false, message: `Lever: ${err.message}` };
  }
}

async function handleWorkday(page, profile, jobId) {
  try {
    // Click Apply
    await tryClick(page, ['a[data-uxi-element-id*="apply"]', 'a:has-text("Apply")', 'button:has-text("Apply")']);
    await page.waitForTimeout(3000);

    // Handle method dialog (Apply Manually)
    await tryClick(page, [
      'button:has-text("Apply Manually")',
      'button[data-automation-id*="applyManually"]',
    ]);
    await page.waitForTimeout(2000);

    // Basic email fill on account page
    await tryFill(page, 'input[type="email"], input[data-automation-id="email"]', profile.email);

    return { success: true, message: "Workday initial page reached (dry-run mode)" };
  } catch (err) {
    return { success: false, message: `Workday: ${err.message}` };
  }
}

async function handleGeneric(page, profile, jobId) {
  try {
    await tryFill(page, 'input[type="email"]', profile.email);
    await tryFill(page, 'input[name*="name"]', profile.name);
    await tryFill(page, 'input[name*="phone"]', profile.phone || "");

    if (profile.resumePath) {
      await tryUpload(page, 'input[type="file"]', profile.resumePath);
    }

    return { success: true, message: "Generic form filled (dry-run mode)" };
  } catch (err) {
    return { success: false, message: `Generic: ${err.message}` };
  }
}

// Helpers
async function tryClick(page, selectors) {
  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 3000 });
      return true;
    } catch {}
  }
  return false;
}

async function tryFill(page, selector, value) {
  if (!value) return false;
  try {
    await page.fill(selector, value, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function tryUpload(page, selector, filePath) {
  try {
    await page.setInputFiles(selector, filePath, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[iAutoApply Automation] Listening on port ${PORT}`);
  console.log(`Auth key: ${API_KEY.substring(0, 8)}...`);
});
