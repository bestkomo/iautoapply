/**
 * iAutoApply Automation Server
 * Runs on VPS, receives job application requests, uses Playwright to submit them.
 *
 * REAL SUBMISSION MODE - actually clicks Submit and verifies success.
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

// Shared password used when an ATS forces us to create an account (Workday).
const ATS_ACCOUNT_PASSWORD = "iAutoApply2024!";

// Words that, when present on the page after submit, signal success.
const SUCCESS_TEXT_PATTERNS = [
  "thank you for your interest",
  "thanks for applying",
  "thank you for applying",
  "application has been received",
  "application has been submitted",
  "application submitted",
  "we've received your application",
  "we have received your application",
  "application received",
  "thanks for your application",
  "your application was sent",
  "you have successfully submitted",
  "successfully submitted",
  "submission successful",
];

const SUCCESS_URL_PATTERNS = [
  "/thanks",
  "/thank-you",
  "/thankyou",
  "/confirmation",
  "/success",
  "/complete",
  "/submitted",
  "application-submitted",
];

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
  let page = null;

  try {
    const url = applyUrl.toLowerCase();
    if (url.includes("greenhouse.io") || url.includes("job-boards.greenhouse.io")) platform = "greenhouse";
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
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      acceptDownloads: false,
    });

    page = await context.newPage();
    // Workday needs more time; we override per-step where needed.
    page.setDefaultTimeout(30000);

    await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);

    // Dismiss cookie banners
    await dismissPopups(page);

    // Platform-specific handling
    let result;
    if (platform === "greenhouse") result = await handleGreenhouse(page, profile, jobId);
    else if (platform === "lever") result = await handleLever(page, profile, jobId);
    else if (platform === "workday") result = await handleWorkday(page, profile, jobId);
    else if (platform === "smartrecruiters") result = await handleSmartRecruiters(page, profile, jobId);
    else if (platform === "icims") result = await handleICIMS(page, profile, jobId);
    else result = await handleGeneric(page, profile, jobId);

    screenshotPath = path.join(SCREENSHOT_DIR, `${jobId}-${platform}-final.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: false });
    } catch (e) {
      console.warn(`[${jobId}] Screenshot failed: ${e.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[${jobId}] Done in ${duration}ms - ${result.success ? "SUCCESS" : "FAILED"}: ${result.message}`
    );

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
    // Try to grab a final screenshot even on error.
    if (page && !screenshotPath) {
      try {
        screenshotPath = path.join(SCREENSHOT_DIR, `${jobId}-${platform}-error.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
      } catch {}
    }
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

// ============================================================================
// Common helpers
// ============================================================================

async function dismissPopups(page) {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("Got it")',
    'button:has-text("OK")',
    '[id*="cookie" i] button:has-text("Accept")',
    '[class*="cookie" i] button:has-text("Accept")',
    '#onetrust-accept-btn-handler',
  ];
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 500 })) {
        await loc.click({ timeout: 1500 });
        await page.waitForTimeout(500);
        break;
      }
    } catch {}
  }
}

async function tryClick(page, selectors, opts = {}) {
  const timeout = opts.timeout || 3000;
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 1000 })) {
        await loc.click({ timeout });
        return true;
      }
    } catch {}
  }
  return false;
}

async function tryFill(page, selector, value, opts = {}) {
  if (value === undefined || value === null || value === "") return false;
  const timeout = opts.timeout || 3000;
  try {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: 1500 })) {
      await loc.fill(String(value), { timeout });
      return true;
    }
  } catch {}
  return false;
}

async function tryUpload(page, selector, filePath, opts = {}) {
  if (!filePath) return false;
  const timeout = opts.timeout || 5000;
  try {
    // Resume uploads often target hidden inputs, so don't require visibility.
    await page.locator(selector).first().setInputFiles(filePath, { timeout });
    return true;
  } catch {
    return false;
  }
}

// Parse "Houston, TX 77084" or similar into components.
function parseLocation(location) {
  if (!location) return { city: "", state: "", zip: "", street: "" };
  const str = String(location).trim();
  // "City, ST ZIP"
  const m = str.match(/^(.*?),\s*([A-Za-z]{2})\s*(\d{5})?\s*$/);
  if (m) {
    return { city: m[1].trim(), state: m[2].toUpperCase(), zip: m[3] || "", street: "" };
  }
  // Fallback: first chunk is city.
  const parts = str.split(",").map(p => p.trim());
  return {
    city: parts[0] || "",
    state: parts[1] || "",
    zip: parts[2] || "",
    street: "",
  };
}

// Check page for success indicators after submit.
async function verifySuccess(page, jobId, platform, waitMs = 10000) {
  await page.waitForTimeout(waitMs);
  let url = "";
  let bodyText = "";
  try {
    url = (page.url() || "").toLowerCase();
  } catch {}
  try {
    bodyText = (await page.locator("body").innerText({ timeout: 5000 })).toLowerCase();
  } catch {}

  for (const p of SUCCESS_URL_PATTERNS) {
    if (url.includes(p)) {
      return { success: true, reason: `url matched "${p}"` };
    }
  }
  for (const p of SUCCESS_TEXT_PATTERNS) {
    if (bodyText.includes(p)) {
      return { success: true, reason: `page matched "${p}"` };
    }
  }
  return { success: false, reason: "no success indicator found" };
}

// Find a QA answer in profile.qa by matching keywords against the question.
function findQaAnswer(profile, keywords) {
  if (!profile || !profile.qa) return null;
  const qa = profile.qa;
  const cleanKws = keywords
    .filter((k) => k && k.length >= 4) // must be at least 4 chars to avoid silly matches
    .map((k) => k.toLowerCase().trim());
  if (cleanKws.length === 0) return null;

  // If qa is an array of {question, answer}
  if (Array.isArray(qa)) {
    for (const item of qa) {
      const q = String(item.question || item.q || "").toLowerCase();
      if (cleanKws.some((k) => q.includes(k))) return item.answer ?? item.a;
    }
    return null;
  }
  // If qa is a flat object keyed by known fields - match WHOLE WORD only
  if (typeof qa === "object") {
    for (const k of Object.keys(qa)) {
      // Convert camelCase to space-separated words (e.g. "preferredWorkType" -> "preferred work type")
      const kl = k.replace(/([A-Z])/g, " $1").toLowerCase().trim();
      const words = kl.split(/\s+/);
      // Match only if EVERY label keyword is present as a whole word in the qa key
      const allMatch = cleanKws.every((kw) =>
        words.some((w) => w === kw || w === kw + "s")
      );
      if (allMatch) return qa[k];
    }
  }
  return null;
}

// ============================================================================
// GREENHOUSE
// ============================================================================

async function handleGreenhouse(page, profile, jobId) {
  try {
    // Some greenhouse pages are "apply" landing pages - click through.
    await tryClick(page, [
      'a:has-text("Apply for this job")',
      'a:has-text("Apply for this Job")',
      'button:has-text("Apply")',
    ]);
    await page.waitForTimeout(2500);

    // Wait for the form to actually appear (look for first_name field)
    try {
      await page.waitForSelector('input[name="first_name"], input[id*="first_name" i], input[autocomplete="given-name"]', { timeout: 8000 });
    } catch {
      console.log(`[${jobId}] [Greenhouse] First name field not visible after wait`);
    }

    // Basic fields - use broader selectors and verify each fill.
    const filledFirstName = await tryFill(page, 'input[name="first_name"], input[id*="first_name" i], input[autocomplete="given-name"]', profile.firstName);
    const filledLastName = await tryFill(page, 'input[name="last_name"], input[id*="last_name" i], input[autocomplete="family-name"]', profile.lastName);

    // EMAIL - try MANY selectors and verify
    let emailFilled = false;
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[id="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[autocomplete="email"]',
      'input[placeholder*="email" i]',
      'input[aria-label*="email" i]',
    ];
    for (const sel of emailSelectors) {
      if (await tryFill(page, sel, profile.email)) {
        emailFilled = true;
        console.log(`[${jobId}] [Greenhouse] Email filled via ${sel}`);
        break;
      }
    }
    if (!emailFilled) {
      console.log(`[${jobId}] [Greenhouse] Email NOT filled - trying focus+type fallback`);
      try {
        // Last resort: find any input near label "Email" and focus+type
        const emailInput = page.locator('label:has-text("Email") + input, label:has-text("Email") ~ input, label:has-text("Email") ~ * input').first();
        if (await emailInput.isVisible({ timeout: 1500 })) {
          await emailInput.click();
          await emailInput.fill(profile.email);
          emailFilled = true;
          console.log(`[${jobId}] [Greenhouse] Email filled via label-adjacent`);
        }
      } catch {}
    }

    // PHONE
    await tryFill(page, 'input[type="tel"], input[name*="phone" i], input[id*="phone" i], input[autocomplete="tel"]', profile.phone || "");

    console.log(`[${jobId}] [Greenhouse] Filled: firstName=${filledFirstName}, lastName=${filledLastName}, email=${emailFilled}`);

    // Legal Name field (different from first/last name on some forms)
    const fullName = profile.name || `${profile.firstName} ${profile.lastName}`.trim();
    await tryFill(page, 'input[name*="legal" i]:not([type="checkbox"]), input[id*="legal" i]:not([type="checkbox"]), input[aria-label*="legal" i]:not([type="checkbox"])', fullName);
    await tryFill(page, 'input[name*="full_name" i], input[id*="full_name" i]', fullName);
    await tryFill(page, 'input[name="name"]:not([name*="user"])', fullName);

    // Resume upload - Greenhouse hides the file input, we need to find it directly
    if (profile.resumePath) {
      // Try every possible Greenhouse file input pattern (they're often hidden)
      let uploaded = false;
      const fileSelectors = [
        'input[type="file"][id*="resume" i]',
        'input[type="file"][name*="resume" i]',
        'input[type="file"][id*="cv" i]',
        'input[type="file"][aria-label*="resume" i]',
        'input[type="file"]',
      ];
      for (const sel of fileSelectors) {
        try {
          const inputs = await page.locator(sel).all();
          for (const input of inputs) {
            try {
              await input.setInputFiles(profile.resumePath, { timeout: 3000 });
              uploaded = true;
              console.log(`[${jobId}] [Greenhouse] Resume uploaded via ${sel}`);
              break;
            } catch (e) {
              // try next input
            }
          }
          if (uploaded) break;
        } catch {}
      }
      console.log(`[${jobId}] [Greenhouse] Resume upload: ${uploaded ? "SUCCESS" : "FAILED"}`);
      if (uploaded) await page.waitForTimeout(2500);
    }

    // Cover letter (optional)
    if (profile.coverLetterPath) {
      await tryUpload(page, 'input[type="file"][id*="cover" i], input[type="file"][name*="cover" i]', profile.coverLetterPath);
      await page.waitForTimeout(1000);
    }

    // Country (required React Select)
    await selectGreenhouseDropdown(page, ["country"], "United States");

    // Location (City) autocomplete
    const cityValue = profile.city || parseLocation(profile.location).city || "";
    if (cityValue) {
      await fillGreenhouseAutocomplete(page, ["location", "city"], cityValue);
    }

    // LinkedIn, website (common optional fields)
    if (profile.linkedin) {
      await tryFill(page, 'input[name*="linkedin" i], input[id*="linkedin" i]', profile.linkedin);
    }

    // Custom questions from qa profile
    await fillGreenhouseCustomQuestions(page, profile);

    // Scroll to bottom so every field renders and lazy validators fire.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Pre-submit screenshot
    const preShot = path.join(SCREENSHOT_DIR, `${jobId}-greenhouse-pre-submit.png`);
    try { await page.screenshot({ path: preShot, fullPage: true }); } catch {}

    // SUBMIT
    const submitted = await tryClick(page, [
      'button[type="submit"]:has-text("Submit Application")',
      'button[type="submit"]:has-text("Submit application")',
      'button:has-text("Submit Application")',
      'input[type="submit"]',
      'button[type="submit"]',
    ]);
    if (!submitted) {
      return { success: false, message: "Greenhouse: submit button not found" };
    }

    const v = await verifySuccess(page, jobId, "greenhouse", 10000);
    if (v.success) return { success: true, message: `Greenhouse: submitted (${v.reason})` };
    return { success: false, message: `Greenhouse: clicked submit but ${v.reason}` };
  } catch (err) {
    return { success: false, message: `Greenhouse: ${err.message}` };
  }
}

async function selectGreenhouseDropdown(page, labelKeywords, value) {
  // Greenhouse uses react-select. The label contains "Country", "Location", etc.
  // Try clicking the visible select control, then typing the value.
  const selectors = labelKeywords.flatMap(k => [
    `[aria-label*="${k}" i]`,
    `[id*="${k}" i]`,
    `div:has(> label:has-text("${capitalize(k)}")) [class*="select"]`,
    `label:has-text("${capitalize(k)}") + div`,
  ]);
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (!(await loc.isVisible({ timeout: 500 }))) continue;
      await loc.click({ timeout: 2000 });
      await page.waitForTimeout(300);
      // Try typing into any now-visible input that accepts text.
      await page.keyboard.type(value, { delay: 30 });
      await page.waitForTimeout(600);
      // Click a matching option if rendered.
      const option = page.locator(`[role="option"]:has-text("${value}"), [id*="option"]:has-text("${value}"), li:has-text("${value}")`).first();
      if (await option.isVisible({ timeout: 1500 })) {
        await option.click({ timeout: 2000 });
      } else {
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(400);
      return true;
    } catch {}
  }
  return false;
}

async function fillGreenhouseAutocomplete(page, labelKeywords, value) {
  const selectors = labelKeywords.flatMap(k => [
    `input[aria-label*="${k}" i]`,
    `input[id*="${k}" i]`,
    `input[name*="${k}" i]`,
  ]);
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (!(await loc.isVisible({ timeout: 500 }))) continue;
      await loc.click({ timeout: 1500 });
      await loc.fill("");
      await page.keyboard.type(value, { delay: 40 });
      await page.waitForTimeout(1200);
      // Click first suggestion if there is one
      const suggestion = page.locator(`[role="option"], li[role="option"], .autocomplete-results li, ul[role="listbox"] li`).first();
      if (await suggestion.isVisible({ timeout: 1500 })) {
        await suggestion.click({ timeout: 2000 });
      } else {
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(400);
      return true;
    } catch {}
  }
  return false;
}

async function fillGreenhouseCustomQuestions(page, profile) {
  // First try to match labels with QA data
  if (profile && profile.qa) {
    try {
      const labels = await page.locator("label").all();
      for (const lbl of labels) {
        const text = (await lbl.innerText().catch(() => "")).toLowerCase().trim();
        if (!text) continue;
        const answer = findQaAnswer(profile, [text]) || findQaAnswer(profile, text.split(/\s+/));
        if (answer === null || answer === undefined) continue;

        const forAttr = await lbl.getAttribute("for");
        if (!forAttr) continue;
        const field = page.locator(`#${cssEscape(forAttr)}`).first();
        if (!(await field.isVisible({ timeout: 300 }).catch(() => false))) continue;

        const tag = await field.evaluate(el => el.tagName.toLowerCase()).catch(() => "");
        const inputType = await field.getAttribute("type").catch(() => "");

        if (tag === "select") {
          // For dropdowns convert boolean to Yes/No
          const value = typeof answer === "boolean" ? (answer ? "Yes" : "No") : String(answer);
          await field.selectOption({ label: value }).catch(async () => {
            await field.selectOption(value).catch(() => {});
          });
        } else if (tag === "textarea" || (tag === "input" && (inputType === "text" || inputType === "" || inputType === "tel" || inputType === "url"))) {
          // For text fields, NEVER fill with boolean true/false
          if (typeof answer === "boolean") continue;
          // Skip if it's just a number for a non-numeric field
          if (typeof answer === "number" && inputType !== "number") {
            await field.fill(String(answer)).catch(() => {});
          } else if (typeof answer === "string" && answer.trim()) {
            await field.fill(answer.trim()).catch(() => {});
          }
        }
      }
    } catch {}
  }

  // Smart text answers for common essay-style questions
  await fillGreenhouseTextQuestions(page, profile);

  // Fill any remaining empty required dropdowns with sensible defaults
  await fillEmptyGreenhouseSelects(page, profile);
}

/**
 * Handles common Greenhouse text/textarea questions with sensible answers.
 */
async function fillGreenhouseTextQuestions(page, profile) {
  const qa = profile?.qa || {};
  const fullName = profile?.name || "";

  try {
    const allInputs = await page.locator('input[type="text"], input:not([type]), textarea, input[type="tel"], input[type="url"]').all();

    for (const input of allInputs) {
      try {
        if (!(await input.isVisible({ timeout: 200 }))) continue;
        const currentValue = await input.inputValue().catch(() => "");
        if (currentValue) continue; // already filled

        // Skip if this input is part of a radio button group (Yes/No question)
        const isYesNoQuestion = await input.evaluate((el) => {
          const container = el.closest("fieldset, .field, .form-group, .question, [class*='radio']");
          if (!container) return false;
          return container.querySelectorAll('input[type="radio"]').length >= 2;
        }).catch(() => false);
        if (isYesNoQuestion) continue;

        // Get the label text
        const labelText = await input.evaluate((el) => {
          const id = el.id;
          const label = document.querySelector(`label[for="${id}"]`);
          return (label?.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").toLowerCase();
        }).catch(() => "");

        if (!labelText) continue;

        // Skip questions that look like Yes/No questions even if they're text fields
        // (some forms use text fields for Yes/No which we can't reliably answer)
        if (
          labelText.startsWith("are you ") ||
          labelText.startsWith("do you ") ||
          labelText.startsWith("have you ") ||
          labelText.startsWith("will you ") ||
          labelText.startsWith("can you ") ||
          labelText.startsWith("would you ")
        ) {
          // These are typically Yes/No - skip text fill, let dropdown filler handle
          continue;
        }

        let value = "";

        // Match labels to sensible text answers
        if (labelText.includes("why do you want") || labelText.includes("why are you interested") || labelText.includes("interest in")) {
          value = "I'm excited about this opportunity because it aligns with my professional experience and career goals. The role offers a chance to contribute meaningfully while continuing to grow my skills.";
        } else if (labelText.includes("from where") || labelText.includes("city and state") || labelText.includes("where do you intend to work") || labelText.includes("work location")) {
          value = qa.city && qa.state ? `${qa.city}, ${qa.state}` : (profile.location || "");
        } else if (labelText.includes("linkedin")) {
          value = profile.linkedinUrl || qa.linkedinUrl || "";
        } else if (labelText.includes("portfolio") || labelText.includes("website") || labelText.includes("personal site")) {
          value = profile.portfolioUrl || qa.portfolioUrl || "";
        } else if (labelText.includes("github")) {
          value = profile.github || "";
        } else if (labelText.includes("preferred first name")) {
          value = profile.firstName || qa.preferredName || "";
        } else if (labelText.includes("preferred last name")) {
          value = profile.lastName || "";
        } else if (labelText.includes("preferred name") || labelText.includes("nickname")) {
          value = qa.preferredName || profile.firstName || "";
        } else if (labelText.includes("street address") || (labelText.includes("address") && !labelText.includes("email"))) {
          value = qa.streetAddress || "";
        } else if (labelText.includes("zip") || labelText.includes("postal")) {
          value = qa.zipCode || "";
        } else if (labelText.includes("city") && !labelText.includes("citizen")) {
          value = qa.city || "";
        } else if (
          // Only match real "address state" fields, NOT yes/no questions or veteran/visa
          (labelText.includes("legal state") ||
            labelText.includes("state of residence") ||
            (labelText.includes("state") && labelText.includes("address")) ||
            labelText === "state" ||
            labelText === "state*" ||
            labelText.startsWith("state*"))
          && !labelText.includes("statement")
          && !labelText.includes("united state")
          && !labelText.includes("rn compact")
          && !labelText.includes("nurse practitioner")
          && !labelText.includes("legally")
          && !labelText.includes("authorized")
          && !labelText.includes("allowed")
          && !labelText.includes("veteran")
          && !labelText.includes("visa")
        ) {
          value = qa.state || "";
        } else if (labelText.includes("country") && !labelText.includes("home country") && !labelText.includes("origin")) {
          value = qa.country || "United States";
        } else if (labelText.includes("salary") && !labelText.includes("expect")) {
          value = qa.currentSalary ? String(qa.currentSalary) : "Negotiable";
        } else if (labelText.includes("expect") && labelText.includes("salary")) {
          value = qa.salaryExpectation || "Negotiable";
        } else if (labelText.includes("notice")) {
          value = qa.noticeRequired || "2 weeks";
        } else if (labelText.includes("years of experience") || labelText.includes("years experience")) {
          value = qa.yearsOfExperience ? String(qa.yearsOfExperience) : "5";
        } else if (labelText.includes("additional information") || labelText.includes("anything else") || labelText.includes("cover letter")) {
          value = `Thank you for considering my application for this role. I am excited about the opportunity and look forward to discussing how my experience aligns with your team's needs.`;
        } else if (labelText.includes("how did you hear") || labelText.includes("source")) {
          value = qa.howDidYouHear || "LinkedIn";
        } else if (labelText.includes("reference")) {
          if (labelText.includes("name")) value = qa.referenceName1 || "";
          else if (labelText.includes("email")) value = qa.referenceEmail1 || "";
          else if (labelText.includes("phone")) value = qa.referencePhone1 || "";
        }

        if (value) {
          await input.fill(value).catch(() => {});
          console.log(`[Greenhouse] Filled text "${labelText.substring(0, 50)}" with "${value.substring(0, 60)}"`);
        }
      } catch {}
    }
  } catch (err) {
    console.error("[Greenhouse] Text questions error:", err.message);
  }
}

async function fillEmptyGreenhouseSelects(page, profile) {
  const qa = profile?.qa || {};
  try {
    // Native <select> elements - pick first non-empty option for required ones
    const selects = await page.locator('select[required], select').all();
    for (const sel of selects) {
      try {
        if (!(await sel.isVisible({ timeout: 200 }))) continue;
        const value = await sel.inputValue().catch(() => "");
        if (value) continue; // already filled

        // Get the label text to make smarter choices
        const labelText = await sel.evaluate((el) => {
          const id = el.id;
          const label = document.querySelector(`label[for="${id}"]`);
          return (label?.textContent || el.getAttribute("aria-label") || "").toLowerCase();
        }).catch(() => "");

        // Get all options
        const options = await sel.locator("option").all();
        if (options.length < 2) continue;

        let chosenLabel = "";

        // Smart matching - PREFER user's questionnaire answers over defaults
        if (labelText.includes("sponsor") || labelText.includes("immigration")) {
          chosenLabel = qa.requireSponsorship === true ? "Yes" : "No";
        } else if (labelText.includes("visa status") || labelText.includes("work authorization status") || labelText.includes("authorization status")) {
          chosenLabel = qa.visaStatus || "US Citizen";
        } else if (labelText.includes("authorized") || labelText.includes("eligible to work") || labelText.includes("legally") || labelText.includes("right to work")) {
          chosenLabel = qa.authorizedToWork === false ? "No" : "Yes";
        } else if (labelText.includes("over 18") || labelText.includes("18 years") || labelText.includes("age of 18")) {
          chosenLabel = qa.isOver18 === false ? "No" : "Yes";
        } else if (labelText.includes("driver") && labelText.includes("license")) {
          chosenLabel = qa.hasDriversLicense === true ? "Yes" : "No";
        } else if (labelText.includes("felony") || labelText.includes("conviction") || labelText.includes("convicted")) {
          chosenLabel = qa.hasFelonyConviction === true ? "Yes" : "No";
        } else if (labelText.includes("misdemeanor")) {
          chosenLabel = qa.hasMisdemeanor === true ? "Yes" : "No";
        } else if (labelText.includes("background check")) {
          chosenLabel = qa.hasBackgroundCheck === false ? "No" : "Yes";
        } else if (labelText.includes("drug test") || labelText.includes("drug screen")) {
          chosenLabel = qa.hasDrugTest === false ? "No" : "Yes";
        } else if (labelText.includes("relocat")) {
          chosenLabel = qa.willingToRelocate === false ? "No" : "Yes";
        } else if (labelText.includes("travel")) {
          chosenLabel = qa.willingToTravel === false ? "No" : "Yes";
        } else if (labelText.includes("overtime")) {
          chosenLabel = qa.willingOvertime === false ? "No" : "Yes";
        } else if (labelText.includes("weekend")) {
          chosenLabel = qa.willingWeekends === false ? "No" : "Yes";
        } else if (labelText.includes("years") && labelText.includes("experience")) {
          chosenLabel = qa.yearsOfExperience ? String(qa.yearsOfExperience) : "5";
        } else if (labelText.includes("education") || labelText.includes("degree")) {
          chosenLabel = qa.highestEducation || "Bachelor";
        } else if (labelText.includes("hear") || labelText.includes("source") || labelText.includes("referral")) {
          chosenLabel = qa.howDidYouHear || "LinkedIn";
        } else if (labelText.includes("current salary") || labelText.includes("current compensation")) {
          chosenLabel = qa.currentSalary ? String(qa.currentSalary) : "Negotiable";
        } else if (labelText.includes("salary") || labelText.includes("compensation") || labelText.includes("expected pay")) {
          chosenLabel = qa.salaryExpectation || (qa.desiredSalary ? String(qa.desiredSalary) : "Negotiable");
        } else if (labelText.includes("notice") || labelText.includes("notice period")) {
          chosenLabel = qa.noticeRequired || "2 weeks";
        } else if (labelText.includes("start date") || labelText.includes("availability") || labelText.includes("when can you start")) {
          chosenLabel = qa.availableStartDate || "Immediately";
        } else if (labelText.includes("work type") || labelText.includes("employment type") || labelText.includes("position type")) {
          chosenLabel = qa.preferredWorkType || "Full-time";
        } else if (labelText.includes("shift") || labelText.includes("schedule")) {
          chosenLabel = qa.willingShifts || "Day";
        } else if (labelText.includes("remote") || labelText.includes("work model") || labelText.includes("on-site")) {
          chosenLabel = qa.remotePreference || "Hybrid";
        } else if (labelText.includes("pronoun")) {
          chosenLabel = qa.pronouns || "Decline";
        } else if (labelText.includes("hispanic") || labelText.includes("latino")) {
          chosenLabel = qa.hispanicLatino || "Decline to";
        } else if (labelText.includes("age range") || (labelText.includes("age") && !labelText.includes("manage"))) {
          chosenLabel = qa.ageRange || "Decline to";
        } else if (labelText.includes("gender")) {
          chosenLabel = qa.gender || "Decline to";
        } else if (labelText.includes("race") || labelText.includes("ethnicity")) {
          chosenLabel = qa.race || "Decline to";
        } else if (labelText.includes("veteran")) {
          chosenLabel = qa.veteranStatus || "Decline to";
        } else if (labelText.includes("disab")) {
          chosenLabel = qa.disabilityStatus || "Decline to";
        } else if (labelText.includes("nursing license") || labelText.includes("nursing")) {
          chosenLabel = qa.hasNursingLicense === true ? "Yes" : "No";
        } else if (labelText.includes("cpr")) {
          chosenLabel = qa.hasCPR === true ? "Yes" : "No";
        } else if (labelText.includes("bls")) {
          chosenLabel = qa.hasBLS === true ? "Yes" : "No";
        } else if (labelText.includes("country") && !labelText.includes("origin")) {
          chosenLabel = qa.country || "United States";
        } else if (labelText.includes("state")) {
          chosenLabel = qa.state || "TX";
        }

        // Try to match the smart choice
        if (chosenLabel) {
          for (const opt of options) {
            const text = (await opt.textContent().catch(() => "") || "").trim();
            if (text.toLowerCase().includes(chosenLabel.toLowerCase())) {
              const val = await opt.getAttribute("value").catch(() => null);
              if (val) {
                await sel.selectOption(val).catch(() => {});
                console.log(`[Greenhouse] Auto-selected "${text}" for "${labelText.substring(0, 40)}"`);
                break;
              }
            }
          }
        }

        // If still empty, just pick the first non-empty option
        const newValue = await sel.inputValue().catch(() => "");
        if (!newValue) {
          for (const opt of options) {
            const val = await opt.getAttribute("value").catch(() => null);
            const text = (await opt.textContent().catch(() => "") || "").trim();
            if (val && text && !text.toLowerCase().includes("select")) {
              await sel.selectOption(val).catch(() => {});
              console.log(`[Greenhouse] Default-selected "${text}" for "${labelText.substring(0, 40)}"`);
              break;
            }
          }
        }
      } catch {}
    }
  } catch (err) {
    console.error("[Greenhouse] Error filling empty selects:", err.message);
  }
}

function cssEscape(s) {
  return String(s).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// LEVER
// ============================================================================

async function handleLever(page, profile, jobId) {
  try {
    // Landing page may have an Apply button that leads to /apply
    await tryClick(page, [
      'a.postings-btn:has-text("Apply")',
      'a[href*="/apply"]:has-text("Apply")',
      'a:has-text("Apply for this job")',
    ]);
    await page.waitForTimeout(2000);

    const fullName = profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim();

    await tryFill(page, 'input[name="name"]', fullName);
    await tryFill(page, 'input[name="email"]', profile.email);
    await tryFill(page, 'input[name="phone"]', profile.phone || "");
    await tryFill(page, 'input[name="org"], input[name="company"]', profile.currentCompany || "");
    if (profile.linkedin) {
      await tryFill(page, 'input[name="urls[LinkedIn]"], input[name*="linkedin" i]', profile.linkedin);
    }
    if (profile.github) {
      await tryFill(page, 'input[name="urls[GitHub]"], input[name*="github" i]', profile.github);
    }
    if (profile.website) {
      await tryFill(page, 'input[name="urls[Portfolio]"], input[name*="portfolio" i], input[name*="website" i]', profile.website);
    }

    // How did you hear about us
    const source = findQaAnswer(profile, ["hear", "source", "referral"]) || "LinkedIn";
    await tryFill(page, 'input[name="source"]', source);

    // Resume
    if (profile.resumePath) {
      await tryUpload(page, 'input[type="file"][name="resume"], input[type="file"]', profile.resumePath);
      await page.waitForTimeout(1500);
    }

    // Custom questions (Lever renders them as labeled inputs/selects/radios)
    await fillLeverCustomQuestions(page, profile);

    // Consent checkbox (common on EU postings)
    try {
      const consent = page.locator('input[type="checkbox"][name*="consent" i], input[type="checkbox"][name*="privacy" i]').first();
      if (await consent.isVisible({ timeout: 500 })) {
        await consent.check({ timeout: 1500 });
      }
    } catch {}

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);

    const preShot = path.join(SCREENSHOT_DIR, `${jobId}-lever-pre-submit.png`);
    try { await page.screenshot({ path: preShot, fullPage: true }); } catch {}

    const submitted = await tryClick(page, [
      '#btn-submit',
      'button:has-text("Submit application")',
      'button:has-text("Submit Application")',
      'button[type="submit"]',
    ]);
    if (!submitted) return { success: false, message: "Lever: submit button not found" };

    const v = await verifySuccess(page, jobId, "lever", 10000);
    if (v.success) return { success: true, message: `Lever: submitted (${v.reason})` };
    return { success: false, message: `Lever: clicked submit but ${v.reason}` };
  } catch (err) {
    return { success: false, message: `Lever: ${err.message}` };
  }
}

async function fillLeverCustomQuestions(page, profile) {
  if (!profile || !profile.qa) return;
  try {
    const cards = await page.locator(".application-question, li.application-question").all();
    for (const card of cards) {
      const labelText = (await card.innerText().catch(() => "")).toLowerCase();
      const answer = findQaAnswer(profile, [labelText]) || findQaAnswer(profile, labelText.split(/\s+/).slice(0, 6));
      if (!answer) continue;
      const input = card.locator('input[type="text"], textarea, select').first();
      if (await input.isVisible({ timeout: 300 }).catch(() => false)) {
        const tag = await input.evaluate(el => el.tagName.toLowerCase()).catch(() => "");
        if (tag === "select") {
          await input.selectOption({ label: String(answer) }).catch(() => {});
        } else {
          await input.fill(String(answer)).catch(() => {});
        }
      }
    }
  } catch {}
}

// ============================================================================
// WORKDAY (multi-step, timeout 180s total)
// ============================================================================

async function handleWorkday(page, profile, jobId) {
  const workdayStart = Date.now();
  const WORKDAY_BUDGET_MS = 180000;
  const timeLeft = () => WORKDAY_BUDGET_MS - (Date.now() - workdayStart);

  try {
    // Step 1: Click Apply on the job listing page.
    await tryClick(page, [
      'a[data-uxi-element-id*="apply" i]',
      '[data-automation-id="adventureButton"]',
      'button[data-automation-id="applyAction"]',
      'button:has-text("Apply")',
      'a:has-text("Apply")',
    ]);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Step 2: Method dialog - choose Apply Manually.
    await tryClick(page, [
      'a[data-automation-id="applyManually"]',
      'button[data-automation-id="applyManually"]',
      '[data-automation-id="applyManually"]',
      'div[role="button"]:has-text("Apply Manually")',
      'button:has-text("Apply Manually")',
    ]);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    if (timeLeft() < 0) return { success: false, message: "Workday: timed out at apply-method step" };

    // Step 3: Create Account page.
    const emailVisible = await page.locator('input[data-automation-id="email"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (emailVisible) {
      await tryFill(page, 'input[data-automation-id="email"]', profile.email);
      await page.waitForTimeout(3000); // password fields populate after email blur
      await tryFill(page, 'input[data-automation-id="password"]', ATS_ACCOUNT_PASSWORD);
      await tryFill(page, 'input[data-automation-id="verifyPassword"]', ATS_ACCOUNT_PASSWORD);
      // Some Workday flows have a checkbox for terms.
      try {
        const agree = page.locator('input[data-automation-id="createAccountCheckbox"], input[type="checkbox"]').first();
        if (await agree.isVisible({ timeout: 500 })) await agree.check({ timeout: 1500 }).catch(() => {});
      } catch {}
      await tryClick(page, [
        'button[data-automation-id="click_filter"]',
        'button[data-automation-id="createAccountSubmitButton"]',
        'button:has-text("Create Account")',
        'button:has-text("Sign Up")',
      ]);
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    if (timeLeft() < 0) return { success: false, message: "Workday: timed out at account step" };

    // Step 4: My Information
    await tryFill(page, 'input[data-automation-id="legalNameSection_firstName"]', profile.firstName);
    await tryFill(page, 'input[data-automation-id="legalNameSection_lastName"]', profile.lastName);

    const loc = parseLocation(profile.location || "");
    if (profile.street || profile.addressLine1) {
      await tryFill(page, 'input[data-automation-id="addressSection_addressLine1"]', profile.street || profile.addressLine1);
    }
    if (loc.city) await tryFill(page, 'input[data-automation-id="addressSection_city"]', loc.city);
    if (loc.zip) await tryFill(page, 'input[data-automation-id="addressSection_postalCode"]', loc.zip);
    if (loc.state) {
      await selectWorkdayDropdown(page, 'button[data-automation-id="addressSection_countryRegion"]', loc.state);
    }
    await tryFill(page, 'input[data-automation-id="phone-number"], input[data-automation-id="phone"]', profile.phone || "");

    await tryClick(page, [
      'button[data-automation-id="pageFooterNextButton"]',
      'button:has-text("Save and Continue")',
    ]);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    if (timeLeft() < 0) return { success: false, message: "Workday: timed out at my-info step" };

    // Step 5: My Experience - upload resume.
    if (profile.resumePath) {
      const uploaded = await tryUpload(page, 'input[data-automation-id="file-upload-input-ref"]', profile.resumePath);
      if (uploaded) await page.waitForTimeout(5000);
    }
    await tryClick(page, [
      'button[data-automation-id="pageFooterNextButton"]',
      'button:has-text("Save and Continue")',
    ]);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Step 6: Application Questions - best-effort from profile.qa.
    await fillWorkdayQuestions(page, profile);
    await tryClick(page, [
      'button[data-automation-id="pageFooterNextButton"]',
      'button:has-text("Save and Continue")',
    ]);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Step 7: Voluntary Disclosures - default "I don't wish to answer".
    await fillWorkdayVoluntary(page, profile);
    await tryClick(page, [
      'button[data-automation-id="pageFooterNextButton"]',
      'button:has-text("Save and Continue")',
    ]);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Step 8: Self Identify - disability.
    await fillWorkdaySelfIdentify(page, profile);
    await tryClick(page, [
      'button[data-automation-id="pageFooterNextButton"]',
      'button:has-text("Save and Continue")',
    ]);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    if (timeLeft() < 0) return { success: false, message: "Workday: timed out before review" };

    // Step 9: Review & Submit.
    // Check any mandatory acknowledgement checkboxes.
    try {
      const checks = await page.locator('input[type="checkbox"]').all();
      for (const c of checks) {
        if (await c.isVisible({ timeout: 200 }).catch(() => false)) {
          await c.check({ timeout: 1000 }).catch(() => {});
        }
      }
    } catch {}

    const preShot = path.join(SCREENSHOT_DIR, `${jobId}-workday-pre-submit.png`);
    try { await page.screenshot({ path: preShot, fullPage: true }); } catch {}

    const submitted = await tryClick(page, [
      'button[data-automation-id="pageFooterSubmitButton"]',
      'button[data-automation-id="wd-Button-Submit"]',
      'button:has-text("Submit")',
    ]);
    if (!submitted) return { success: false, message: "Workday: submit button not found" };

    const v = await verifySuccess(page, jobId, "workday", 12000);
    if (v.success) return { success: true, message: `Workday: submitted (${v.reason})` };
    return { success: false, message: `Workday: clicked submit but ${v.reason}` };
  } catch (err) {
    return { success: false, message: `Workday: ${err.message}` };
  }
}

async function selectWorkdayDropdown(page, triggerSelector, optionText) {
  try {
    const trigger = page.locator(triggerSelector).first();
    if (!(await trigger.isVisible({ timeout: 1500 }))) return false;
    await trigger.click({ timeout: 2000 });
    await page.waitForTimeout(500);
    const option = page.locator(`[role="option"]:has-text("${optionText}"), li:has-text("${optionText}")`).first();
    if (await option.isVisible({ timeout: 2000 })) {
      await option.click({ timeout: 2000 });
      return true;
    }
  } catch {}
  return false;
}

async function fillWorkdayQuestions(page, profile) {
  if (!profile || !profile.qa) return;
  try {
    const fields = await page.locator('[data-automation-id*="question" i], [data-automation-id*="Question"]').all();
    for (const f of fields) {
      const label = (await f.innerText().catch(() => "")).toLowerCase();
      const answer = findQaAnswer(profile, [label]) || findQaAnswer(profile, label.split(/\s+/).slice(0, 6));
      if (!answer) continue;
      const input = f.locator('input, textarea, select').first();
      if (await input.isVisible({ timeout: 300 }).catch(() => false)) {
        const tag = await input.evaluate(el => el.tagName.toLowerCase()).catch(() => "");
        if (tag === "select") {
          await input.selectOption({ label: String(answer) }).catch(() => {});
        } else {
          await input.fill(String(answer)).catch(() => {});
        }
      }
    }
  } catch {}
}

async function fillWorkdayVoluntary(page, profile) {
  // Default behavior: pick "I don't wish to answer" for gender/ethnicity/veteran unless qa overrides.
  const triggers = [
    'button[data-automation-id*="gender" i]',
    'button[data-automation-id*="ethnicity" i]',
    'button[data-automation-id*="hispanic" i]',
    'button[data-automation-id*="veteran" i]',
    'button[data-automation-id*="Race" i]',
  ];
  for (const sel of triggers) {
    try {
      const t = page.locator(sel).first();
      if (!(await t.isVisible({ timeout: 500 }))) continue;
      await t.click({ timeout: 1500 });
      await page.waitForTimeout(300);
      const opt = page.locator(`[role="option"]:has-text("I don"), [role="option"]:has-text("not wish"), [role="option"]:has-text("Decline")`).first();
      if (await opt.isVisible({ timeout: 1500 })) {
        await opt.click({ timeout: 1500 });
      } else {
        await page.keyboard.press("Escape");
      }
    } catch {}
  }
}

async function fillWorkdaySelfIdentify(page, profile) {
  const disabilityAnswer =
    findQaAnswer(profile, ["disability", "disabilityStatus", "disability_status"]) || "I do not wish to answer";
  try {
    const triggers = await page.locator('button[data-automation-id*="disability" i], button[data-automation-id*="selfIdentify" i]').all();
    for (const t of triggers) {
      if (await t.isVisible({ timeout: 300 }).catch(() => false)) {
        await t.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(300);
        const opt = page.locator(`[role="option"]:has-text("${disabilityAnswer}"), [role="option"]:has-text("not wish")`).first();
        if (await opt.isVisible({ timeout: 1500 })) await opt.click({ timeout: 1500 }).catch(() => {});
        else await page.keyboard.press("Escape");
      }
    }
    // Name + date acknowledgement (some Workday self-identify pages require this)
    await tryFill(page, 'input[data-automation-id*="name" i]', `${profile.firstName || ""} ${profile.lastName || ""}`.trim());
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const yyyy = today.getFullYear();
    await tryFill(page, 'input[data-automation-id*="dateSection_month" i]', mm);
    await tryFill(page, 'input[data-automation-id*="dateSection_day" i]', dd);
    await tryFill(page, 'input[data-automation-id*="dateSection_year" i]', String(yyyy));
  } catch {}
}

// ============================================================================
// SMARTRECRUITERS
// ============================================================================

async function handleSmartRecruiters(page, profile, jobId) {
  try {
    await tryClick(page, ['button:has-text("I\'m interested")', 'a:has-text("Apply")', 'button:has-text("Apply")']);
    await page.waitForTimeout(2000);

    await tryFill(page, 'input[name="firstName"], input[id*="firstName" i]', profile.firstName);
    await tryFill(page, 'input[name="lastName"], input[id*="lastName" i]', profile.lastName);
    await tryFill(page, 'input[type="email"]', profile.email);
    await tryFill(page, 'input[type="tel"]', profile.phone || "");

    if (profile.resumePath) {
      await tryUpload(page, 'input[type="file"]', profile.resumePath);
      await page.waitForTimeout(2000);
    }

    const submitted = await tryClick(page, [
      'button:has-text("Submit")',
      'button[type="submit"]',
    ]);
    if (!submitted) return { success: false, message: "SmartRecruiters: submit not found" };

    const v = await verifySuccess(page, jobId, "smartrecruiters", 10000);
    return v.success
      ? { success: true, message: `SmartRecruiters: submitted (${v.reason})` }
      : { success: false, message: `SmartRecruiters: ${v.reason}` };
  } catch (err) {
    return { success: false, message: `SmartRecruiters: ${err.message}` };
  }
}

// ============================================================================
// ICIMS
// ============================================================================

async function handleICIMS(page, profile, jobId) {
  try {
    await tryClick(page, ['a:has-text("Apply")', 'button:has-text("Apply")']);
    await page.waitForTimeout(2000);

    await tryFill(page, 'input[id*="firstname" i], input[name*="firstname" i]', profile.firstName);
    await tryFill(page, 'input[id*="lastname" i], input[name*="lastname" i]', profile.lastName);
    await tryFill(page, 'input[type="email"]', profile.email);
    await tryFill(page, 'input[type="tel"], input[name*="phone" i]', profile.phone || "");

    if (profile.resumePath) {
      await tryUpload(page, 'input[type="file"]', profile.resumePath);
      await page.waitForTimeout(2000);
    }

    const submitted = await tryClick(page, [
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button[type="submit"]',
    ]);
    if (!submitted) return { success: false, message: "iCIMS: submit not found" };

    const v = await verifySuccess(page, jobId, "icims", 10000);
    return v.success
      ? { success: true, message: `iCIMS: submitted (${v.reason})` }
      : { success: false, message: `iCIMS: ${v.reason}` };
  } catch (err) {
    return { success: false, message: `iCIMS: ${err.message}` };
  }
}

// ============================================================================
// GENERIC
// ============================================================================

// ============================================================================
// AI-assisted helpers (Claude analyzes the DOM to find form fields and submit buttons)
// ============================================================================

async function extractFormStructure(page) {
  return await page.evaluate(() => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    };

    const inputs = Array.from(
      document.querySelectorAll("input, textarea, select")
    )
      .filter((el) => isVisible(el) && el.type !== "hidden")
      .map((el) => {
        const labelEl = el.labels?.[0];
        const label = (
          labelEl?.textContent ||
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("title") ||
          ""
        ).trim().substring(0, 200);
        return {
          label,
          name: el.name || "",
          id: el.id || "",
          type: el.type || el.tagName.toLowerCase(),
          required: el.required || false,
        };
      })
      .filter((i) => i.name || i.id || i.label);

    const buttons = Array.from(
      document.querySelectorAll(
        'button, input[type="submit"], input[type="button"], a[role="button"]'
      )
    )
      .filter((el) => isVisible(el))
      .map((el) => {
        const text = (el.textContent || el.value || "").trim().substring(0, 100);
        return { text, id: el.id || "", type: el.type || "" };
      })
      .filter((b) => b.text);

    return { inputs, buttons, url: window.location.href, title: document.title };
  });
}

async function askClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[Claude] ANTHROPIC_API_KEY not set, skipping AI assist");
    return null;
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("[Claude] API error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.content[0].text;
  } catch (e) {
    console.error("[Claude] Request failed:", e.message);
    return null;
  }
}

function parseClaudeJson(text) {
  if (!text) return null;
  // Strip markdown code fences
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1];
  // Find first { and last }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch (e) {
    console.error("[Claude] JSON parse failed:", e.message, "raw:", cleaned.substring(0, 200));
    return null;
  }
}

async function handleGeneric(page, profile, jobId) {
  console.log(`[${jobId}] [Generic-AI] Starting AI-assisted automation`);

  try {
    let structure = await extractFormStructure(page);
    console.log(`[${jobId}] [Generic-AI] Initial: ${structure.inputs.length} inputs, ${structure.buttons.length} buttons`);

    // If no inputs visible, look for an "Apply" button to click first
    if (structure.inputs.length < 2 && structure.buttons.length > 0) {
      console.log(`[${jobId}] [Generic-AI] Few inputs, looking for Apply button via Claude`);

      const applyAnswer = await askClaude(
        `You are looking at a job posting page. Find the "Apply" button (or similar - "Apply Now", "Apply for this job", "I'm Interested", etc.) that opens the application form.

Buttons on the page:
${JSON.stringify(structure.buttons.slice(0, 30))}

Respond with ONLY the exact text or id of the Apply button (no quotes, no explanation). If none, respond with NONE.`
      );

      if (applyAnswer && !applyAnswer.toUpperCase().includes("NONE")) {
        const target = applyAnswer.trim().replace(/^["']|["']$/g, "");
        console.log(`[${jobId}] [Generic-AI] Clicking Apply: ${target}`);
        const clicked = await tryClick(page, [
          `#${CSS.escape ? CSS.escape(target) : target}`,
          `button:has-text("${target}")`,
          `a:has-text("${target}")`,
        ]);
        if (clicked) {
          await page.waitForTimeout(3000);
          structure = await extractFormStructure(page);
          console.log(`[${jobId}] [Generic-AI] After Apply click: ${structure.inputs.length} inputs`);
        }
      }
    }

    if (structure.inputs.length === 0) {
      return { success: false, message: "Generic-AI: no form fields found on page" };
    }

    // Ask Claude to map fields to profile values
    const fieldMappingPrompt = `You are filling a job application form. Map each form field to the appropriate value from the applicant's profile. Return ONLY a JSON object where keys are the field's "name" or "id" (whichever exists) and values are what to type.

Form fields:
${JSON.stringify(structure.inputs.slice(0, 50))}

Applicant profile:
- Full name: ${profile.name || ""}
- First name: ${profile.firstName || ""}
- Last name: ${profile.lastName || ""}
- Email: ${profile.email || ""}
- Phone: ${profile.phone || ""}
- Location: ${profile.location || ""}
- LinkedIn URL: ${profile.linkedinUrl || ""}
- Portfolio URL: ${profile.portfolioUrl || ""}

Rules:
- Skip file upload fields (type=file)
- Skip checkboxes/radios (we'll handle separately)
- For "How did you hear about us" use "Job Board"
- For salary use "Negotiable"
- Return JSON only, no markdown.

Example: {"first_name": "John", "email": "john@example.com"}`;

    const mappingText = await askClaude(fieldMappingPrompt);
    const mapping = parseClaudeJson(mappingText);

    if (mapping) {
      console.log(`[${jobId}] [Generic-AI] Got ${Object.keys(mapping).length} field mappings from Claude`);
      for (const [fieldKey, value] of Object.entries(mapping)) {
        if (!value) continue;
        // Try by name, then by id
        const filled =
          (await tryFill(page, `[name="${fieldKey}"]`, String(value))) ||
          (await tryFill(page, `#${fieldKey}`, String(value))) ||
          (await tryFill(page, `[name*="${fieldKey}" i]`, String(value)));
        if (filled) console.log(`[${jobId}] [Generic-AI] Filled ${fieldKey}`);
      }
    } else {
      // Fallback: basic heuristic fills
      console.log(`[${jobId}] [Generic-AI] Claude mapping failed, using heuristics`);
      await tryFill(page, 'input[type="email"]', profile.email);
      await tryFill(page, 'input[name*="first" i]', profile.firstName);
      await tryFill(page, 'input[name*="last" i]', profile.lastName);
      await tryFill(page, 'input[type="tel"], input[name*="phone" i]', profile.phone || "");
    }

    // Upload resume if there's a file input
    if (profile.resumePath) {
      await tryUpload(page, 'input[type="file"]', profile.resumePath);
      await page.waitForTimeout(1500);
    }

    // Find submit button via Claude
    const fresh = await extractFormStructure(page);
    const submitAnswer = await askClaude(
      `Which button submits this job application form? Common labels: "Submit Application", "Submit", "Apply", "Send Application".

Buttons on the page:
${JSON.stringify(fresh.buttons.slice(0, 30))}

Respond with ONLY the exact text or id of the submit button (no quotes, no explanation). If none, respond with NONE.`
    );

    let submitted = false;
    if (submitAnswer && !submitAnswer.toUpperCase().includes("NONE")) {
      const target = submitAnswer.trim().replace(/^["']|["']$/g, "");
      console.log(`[${jobId}] [Generic-AI] Submitting via: ${target}`);
      submitted =
        (await tryClick(page, [
          `#${target}`,
          `button:has-text("${target}")`,
          `input[value="${target}"]`,
          `button[type="submit"]:has-text("${target}")`,
        ]));
    }

    // Fallback: try common submit selectors
    if (!submitted) {
      submitted = await tryClick(page, [
        'button[type="submit"]:has-text("Submit Application")',
        'button:has-text("Submit Application")',
        'button[type="submit"]:has-text("Apply")',
        'button:has-text("Apply Now")',
        'button[type="submit"]',
        'input[type="submit"]',
      ]);
    }

    if (!submitted) {
      return { success: false, message: "Generic-AI: no submit button found" };
    }

    const v = await verifySuccess(page, jobId, "generic", 10000);
    return v.success
      ? { success: true, message: `Generic-AI: submitted (${v.reason})` }
      : { success: false, message: `Generic-AI: clicked submit but ${v.reason}` };
  } catch (err) {
    console.error(`[${jobId}] [Generic-AI] Error:`, err.message);
    return { success: false, message: `Generic-AI: ${err.message}` };
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[iAutoApply Automation] Listening on port ${PORT}`);
  console.log(`Auth key: ${API_KEY.substring(0, 8)}...`);
});
