import { chromium, Browser, Page } from "playwright";
import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ApplicantProfile {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  resumePath?: string; // Absolute path to resume PDF file on disk
}

export interface ApplyResult {
  success: boolean;
  platform: string; // "greenhouse", "lever", "workday", "smartrecruiters", "icims", "generic"
  message: string;
  screenshotPath?: string; // Screenshot for debugging
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SCREENSHOTS_DIR = resolve(process.cwd(), "screenshots");
const APPLICATION_TIMEOUT = 60_000; // 60 seconds per application
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Small random delay to appear human-like (200–600 ms) */
function humanDelay(): Promise<void> {
  const ms = 200 + Math.random() * 400;
  return new Promise((r) => setTimeout(r, ms));
}

/** Longer random delay between major steps (500–1500 ms) */
function stepDelay(): Promise<void> {
  const ms = 500 + Math.random() * 1000;
  return new Promise((r) => setTimeout(r, ms));
}

/** Ensure the screenshots directory exists */
function ensureScreenshotsDir() {
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

/** Detect ATS platform from the URL */
function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("boards.greenhouse.io") || u.includes("job-boards.greenhouse.io") || u.includes("greenhouse.io")) {
    return "greenhouse";
  }
  if (u.includes("jobs.lever.co") || u.includes("lever.co")) {
    return "lever";
  }
  if (u.includes("myworkdayjobs.com") || u.includes(".wd1.") || u.includes(".wd5.") || u.includes(".wd3.")) {
    return "workday";
  }
  if (u.includes("jobs.smartrecruiters.com") || u.includes("smartrecruiters.com")) {
    return "smartrecruiters";
  }
  if (u.includes("icims.com")) {
    return "icims";
  }
  return "generic";
}

/** Try to dismiss cookie banners and popups */
async function dismissPopups(page: Page) {
  const dismissSelectors = [
    // Cookie banners
    'button[id*="cookie-accept"]',
    'button[id*="accept-cookies"]',
    'button[class*="cookie-accept"]',
    'button[data-action="accept"]',
    '#onetrust-accept-btn-handler',
    '.cc-btn.cc-dismiss',
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Accept Cookies")',
    'button:has-text("Got it")',
    'button:has-text("I agree")',
    // Generic close buttons for modals
    'button[aria-label="Close"]',
    'button[aria-label="Dismiss"]',
    '.modal-close',
    '[data-dismiss="modal"]',
  ];

  for (const selector of dismissSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ timeout: 1000 }).catch(() => {});
        await humanDelay();
      }
    } catch {
      // Ignore — popup may not exist
    }
  }
}

/** Type text into a field with human-like per-character delay */
async function humanType(page: Page, selector: string, text: string): Promise<boolean> {
  try {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loc.click({ timeout: 2000 });
      await humanDelay();
      await loc.fill(text);
      await humanDelay();
      return true;
    }
  } catch {
    // Field not found
  }
  return false;
}

/** Try multiple selectors until one works for typing */
async function tryTypeMultiple(page: Page, selectors: string[], text: string): Promise<boolean> {
  for (const sel of selectors) {
    if (await humanType(page, sel, text)) return true;
  }
  return false;
}

/** Upload a file to a file input */
async function uploadResume(page: Page, resumePath: string): Promise<boolean> {
  const fileSelectors = [
    'input[type="file"]',
    'input[name*="resume"]',
    'input[name*="Resume"]',
    'input[accept*=".pdf"]',
    'input[accept*="application/pdf"]',
    'input[id*="resume"]',
    'input[id*="Resume"]',
    'input[data-field*="resume"]',
  ];

  for (const sel of fileSelectors) {
    try {
      const input = page.locator(sel).first();
      if (await input.count() > 0) {
        await input.setInputFiles(resumePath);
        await stepDelay();
        console.log(`[Playwright] Resume uploaded via selector: ${sel}`);
        return true;
      }
    } catch {
      // Try next selector
    }
  }
  return false;
}

/** Take a screenshot and return the file path */
async function takeScreenshot(page: Page, label: string): Promise<string> {
  ensureScreenshotsDir();
  const timestamp = Date.now();
  const filename = `${label}-${timestamp}.png`;
  const filepath = resolve(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  return filepath;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export async function applyToJobReal(
  applyUrl: string,
  profile: ApplicantProfile
): Promise<ApplyResult> {
  let browser: Browser | null = null;
  const platform = detectPlatform(applyUrl);

  console.log(`[Playwright] Starting application to ${applyUrl} (platform: ${platform})`);

  try {
    browser = await chromium.launch({
      headless: false,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
    });

    // Set a global timeout for the entire operation
    context.setDefaultTimeout(APPLICATION_TIMEOUT);

    const page = await context.newPage();

    // Navigate to the job URL
    console.log(`[Playwright] Navigating to ${applyUrl}`);
    await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await stepDelay();

    // Dismiss any popups / cookie banners
    await dismissPopups(page);

    // Route to the correct ATS handler
    let result: ApplyResult;
    switch (platform) {
      case "greenhouse":
        result = await applyGreenhouse(page, profile);
        break;
      case "lever":
        result = await applyLever(page, profile);
        break;
      case "workday":
        result = await applyWorkday(page, profile);
        break;
      case "smartrecruiters":
        result = await applySmartRecruiters(page, profile);
        break;
      case "icims":
        result = await applyICIMS(page, profile);
        break;
      default:
        result = await applyGeneric(page, profile);
        break;
    }

    // Take a screenshot before closing for debugging
    try {
      result.screenshotPath = await takeScreenshot(page, `${platform}-${result.success ? "success" : "fail"}`);
    } catch {
      // Screenshot failure is non-critical
    }

    await context.close();
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Playwright] Application failed:`, msg);
    return {
      success: false,
      platform,
      message: `Browser automation error: ${msg}`,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Greenhouse                                                         */
/* ------------------------------------------------------------------ */

async function applyGreenhouse(page: Page, profile: ApplicantProfile): Promise<ApplyResult> {
  try {
    console.log("[Playwright] Handling Greenhouse application");

    // Some Greenhouse pages have an "Apply" button to open the form
    const applyBtnSelectors = [
      'a:has-text("Apply for this job")',
      'a:has-text("Apply")',
      'button:has-text("Apply")',
      '#apply_button',
      '.btn-apply',
    ];
    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    // Wait for the application form to appear
    await page.waitForSelector(
      '#application_form, .application-form, form[action*="application"], form',
      { timeout: 10000 }
    ).catch(() => {});
    await stepDelay();

    // Fill first name
    await tryTypeMultiple(page, [
      'input[name*="first_name"]',
      'input[id*="first_name"]',
      'input[autocomplete="given-name"]',
      'input[placeholder*="First"]',
    ], profile.firstName);

    // Fill last name
    await tryTypeMultiple(page, [
      'input[name*="last_name"]',
      'input[id*="last_name"]',
      'input[autocomplete="family-name"]',
      'input[placeholder*="Last"]',
    ], profile.lastName);

    // Fill email
    await tryTypeMultiple(page, [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
      'input[autocomplete="email"]',
    ], profile.email);

    // Fill phone
    if (profile.phone) {
      await tryTypeMultiple(page, [
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[id*="phone"]',
        'input[autocomplete="tel"]',
      ], profile.phone);
    }

    // Fill location
    if (profile.location) {
      await tryTypeMultiple(page, [
        'input[name*="location"]',
        'input[id*="location"]',
        'input[placeholder*="Location"]',
        'input[placeholder*="City"]',
        'input[name*="city"]',
      ], profile.location);
    }

    // Fill LinkedIn
    if (profile.linkedinUrl) {
      await tryTypeMultiple(page, [
        'input[name*="linkedin"]',
        'input[id*="linkedin"]',
        'input[placeholder*="LinkedIn"]',
        'input[name*="url[LinkedIn]"]',
      ], profile.linkedinUrl);
    }

    // Fill portfolio
    if (profile.portfolioUrl) {
      await tryTypeMultiple(page, [
        'input[name*="portfolio"]',
        'input[name*="website"]',
        'input[placeholder*="Portfolio"]',
        'input[placeholder*="Website"]',
      ], profile.portfolioUrl);
    }

    // Upload resume
    if (profile.resumePath) {
      await uploadResume(page, profile.resumePath);
    }

    await stepDelay();

    // Take pre-submit screenshot
    await takeScreenshot(page, "greenhouse-pre-submit");

    // Click submit
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit Application")',
      'button:has-text("Submit")',
      '#submit_app',
    ];
    let submitted = false;
    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      // Wait for confirmation or navigation
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await stepDelay();
    }

    return {
      success: submitted,
      platform: "greenhouse",
      message: submitted
        ? "Application submitted via Greenhouse"
        : "Greenhouse form filled but submit button not found",
    };
  } catch (error) {
    return {
      success: false,
      platform: "greenhouse",
      message: `Greenhouse error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Lever                                                              */
/* ------------------------------------------------------------------ */

async function applyLever(page: Page, profile: ApplicantProfile): Promise<ApplyResult> {
  try {
    console.log("[Playwright] Handling Lever application");

    // Click the "Apply" button on the job page
    const applyBtnSelectors = [
      'a.postings-btn',
      '.posting-btn-submit',
      'a[href*="/apply"]',
      'a:has-text("Apply for this job")',
      'a:has-text("Apply")',
    ];
    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    // Fill name (Lever uses a combined "name" field)
    await tryTypeMultiple(page, [
      'input[name="name"]',
      'input[placeholder*="Full name"]',
      'input[placeholder*="name"]',
    ], profile.name);

    // Fill email
    await tryTypeMultiple(page, [
      'input[name="email"]',
      'input[type="email"]',
    ], profile.email);

    // Fill phone
    if (profile.phone) {
      await tryTypeMultiple(page, [
        'input[name="phone"]',
        'input[type="tel"]',
      ], profile.phone);
    }

    // Fill location
    if (profile.location) {
      await tryTypeMultiple(page, [
        'input[name="location"]',
        'input[name*="location"]',
        'input[placeholder*="Location"]',
      ], profile.location);
    }

    // Fill LinkedIn
    if (profile.linkedinUrl) {
      await tryTypeMultiple(page, [
        'input[name="urls[LinkedIn]"]',
        'input[name*="linkedin"]',
        'input[placeholder*="LinkedIn"]',
      ], profile.linkedinUrl);
    }

    // Fill portfolio
    if (profile.portfolioUrl) {
      await tryTypeMultiple(page, [
        'input[name="urls[Portfolio]"]',
        'input[name*="portfolio"]',
        'input[name*="website"]',
        'input[placeholder*="Portfolio"]',
        'input[placeholder*="Website"]',
      ], profile.portfolioUrl);
    }

    // Upload resume
    if (profile.resumePath) {
      await uploadResume(page, profile.resumePath);
    }

    await stepDelay();
    await takeScreenshot(page, "lever-pre-submit");

    // Submit
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Submit application")',
      'button:has-text("Submit")',
      '.template-btn-submit',
    ];
    let submitted = false;
    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await stepDelay();
    }

    return {
      success: submitted,
      platform: "lever",
      message: submitted
        ? "Application submitted via Lever"
        : "Lever form filled but submit button not found",
    };
  } catch (error) {
    return {
      success: false,
      platform: "lever",
      message: `Lever error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Workday                                                            */
/* ------------------------------------------------------------------ */

async function applyWorkday(page: Page, profile: ApplicantProfile): Promise<ApplyResult> {
  try {
    console.log("[Playwright] Handling Workday application");

    // Workday apps are complex multi-step SPAs. We try our best.
    // Step 1: Click "Apply" to start
    const applyBtnSelectors = [
      'a[data-automation-id="jobPostingApplyButton"]',
      'button[data-automation-id="jobPostingApplyButton"]',
      'a:has-text("Apply")',
      'button:has-text("Apply")',
    ];
    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await btn.click();
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    // Some Workday portals offer "Apply Manually" vs "Use my last application"
    try {
      const manualBtn = page.locator('button:has-text("Apply Manually")').first();
      if (await manualBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await manualBtn.click();
        await stepDelay();
      }
    } catch { /* continue */ }

    // Step 2: Try to fill the "My Information" section
    // Workday uses data-automation-id attributes heavily

    // First name
    await tryTypeMultiple(page, [
      'input[data-automation-id="legalNameSection_firstName"]',
      'input[data-automation-id="firstName"]',
      'input[aria-label*="First Name"]',
      'input[placeholder*="First Name"]',
    ], profile.firstName);

    // Last name
    await tryTypeMultiple(page, [
      'input[data-automation-id="legalNameSection_lastName"]',
      'input[data-automation-id="lastName"]',
      'input[aria-label*="Last Name"]',
      'input[placeholder*="Last Name"]',
    ], profile.lastName);

    // Email
    await tryTypeMultiple(page, [
      'input[data-automation-id="email"]',
      'input[type="email"]',
      'input[aria-label*="Email"]',
    ], profile.email);

    // Phone
    if (profile.phone) {
      await tryTypeMultiple(page, [
        'input[data-automation-id="phone-number"]',
        'input[data-automation-id="phone"]',
        'input[type="tel"]',
        'input[aria-label*="Phone"]',
      ], profile.phone);
    }

    // Address / Location
    if (profile.location) {
      await tryTypeMultiple(page, [
        'input[data-automation-id="addressSection_city"]',
        'input[aria-label*="City"]',
        'input[placeholder*="City"]',
      ], profile.location);
    }

    // Upload resume
    if (profile.resumePath) {
      await uploadResume(page, profile.resumePath);
    }

    await stepDelay();
    await takeScreenshot(page, "workday-pre-submit");

    // Try to submit or advance to next page
    const nextSelectors = [
      'button[data-automation-id="bottom-navigation-next-button"]',
      'button:has-text("Submit")',
      'button:has-text("Next")',
      'button:has-text("Continue")',
    ];
    let submitted = false;
    for (const sel of nextSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    return {
      success: submitted,
      platform: "workday",
      message: submitted
        ? "Workday application form filled and submitted/advanced"
        : "Workday form partially filled (complex multi-step form)",
    };
  } catch (error) {
    return {
      success: false,
      platform: "workday",
      message: `Workday error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  SmartRecruiters                                                    */
/* ------------------------------------------------------------------ */

async function applySmartRecruiters(page: Page, profile: ApplicantProfile): Promise<ApplyResult> {
  try {
    console.log("[Playwright] Handling SmartRecruiters application");

    // Click "Apply" button
    const applyBtnSelectors = [
      'button[data-test="apply-button"]',
      'button.js-apply-btn',
      'a.apply-btn',
      'button:has-text("Apply")',
      'a:has-text("Apply Now")',
    ];
    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await btn.click();
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    // Wait for form
    await page.waitForSelector('input[name*="firstName"], input[name*="email"], form', { timeout: 10000 }).catch(() => {});
    await stepDelay();

    // Fill first name
    await tryTypeMultiple(page, [
      'input[name*="firstName"]',
      'input[placeholder*="First"]',
      'input[data-test="first-name"]',
    ], profile.firstName);

    // Fill last name
    await tryTypeMultiple(page, [
      'input[name*="lastName"]',
      'input[placeholder*="Last"]',
      'input[data-test="last-name"]',
    ], profile.lastName);

    // Fill email
    await tryTypeMultiple(page, [
      'input[type="email"]',
      'input[name*="email"]',
      'input[data-test="email"]',
    ], profile.email);

    // Fill phone
    if (profile.phone) {
      await tryTypeMultiple(page, [
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[data-test="phone"]',
      ], profile.phone);
    }

    // Fill location
    if (profile.location) {
      await tryTypeMultiple(page, [
        'input[name*="location"]',
        'input[name*="city"]',
        'input[placeholder*="Location"]',
      ], profile.location);
    }

    // Upload resume
    if (profile.resumePath) {
      await uploadResume(page, profile.resumePath);
    }

    await stepDelay();
    await takeScreenshot(page, "smartrecruiters-pre-submit");

    // Submit
    let submitted = false;
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Apply")',
      'button[data-test="submit-application"]',
    ];
    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    }

    return {
      success: submitted,
      platform: "smartrecruiters",
      message: submitted
        ? "Application submitted via SmartRecruiters"
        : "SmartRecruiters form filled but submit button not found",
    };
  } catch (error) {
    return {
      success: false,
      platform: "smartrecruiters",
      message: `SmartRecruiters error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  iCIMS                                                              */
/* ------------------------------------------------------------------ */

async function applyICIMS(page: Page, profile: ApplicantProfile): Promise<ApplyResult> {
  try {
    console.log("[Playwright] Handling iCIMS application");

    // iCIMS typically uses iframes — look for the apply button
    const applyBtnSelectors = [
      'a:has-text("Apply Now")',
      'a:has-text("Apply")',
      'button:has-text("Apply")',
      '.iCIMS_ApplyButton',
      'a.iCIMS_PrimaryButton',
    ];
    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await btn.click();
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    // iCIMS may use iframes for forms — try main page first, then iframes
    let formPage: Page | null = page;

    // Check for iframes
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const emailInFrame = frame.locator('input[type="email"], input[name*="email"]').first();
        if (await emailInFrame.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Found the form in an iframe — but we work with frames directly in Playwright
          // Fill fields in this frame
          await emailInFrame.fill(profile.email);
          await humanDelay();

          // First name
          const fnInput = frame.locator('input[name*="firstName"], input[name*="first_name"], input[placeholder*="First"]').first();
          if (await fnInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await fnInput.fill(profile.firstName);
          }

          // Last name
          const lnInput = frame.locator('input[name*="lastName"], input[name*="last_name"], input[placeholder*="Last"]').first();
          if (await lnInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await lnInput.fill(profile.lastName);
          }

          // Phone
          if (profile.phone) {
            const phoneInput = frame.locator('input[type="tel"], input[name*="phone"]').first();
            if (await phoneInput.isVisible({ timeout: 1000 }).catch(() => false)) {
              await phoneInput.fill(profile.phone);
            }
          }

          // Resume upload in frame
          if (profile.resumePath) {
            const fileInput = frame.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
              await fileInput.setInputFiles(profile.resumePath);
            }
          }

          formPage = null; // We handled it via frame
          break;
        }
      } catch { /* continue to next frame */ }
    }

    // If not handled via frame, try main page
    if (formPage) {
      await tryTypeMultiple(page, [
        'input[name*="firstName"]',
        'input[placeholder*="First"]',
      ], profile.firstName);

      await tryTypeMultiple(page, [
        'input[name*="lastName"]',
        'input[placeholder*="Last"]',
      ], profile.lastName);

      await tryTypeMultiple(page, [
        'input[type="email"]',
        'input[name*="email"]',
      ], profile.email);

      if (profile.phone) {
        await tryTypeMultiple(page, [
          'input[type="tel"]',
          'input[name*="phone"]',
        ], profile.phone);
      }

      if (profile.resumePath) {
        await uploadResume(page, profile.resumePath);
      }
    }

    await stepDelay();
    await takeScreenshot(page, "icims-pre-submit");

    // Submit
    let submitted = false;
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'a:has-text("Submit")',
    ];
    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    }

    return {
      success: submitted,
      platform: "icims",
      message: submitted
        ? "Application submitted via iCIMS"
        : "iCIMS form filled but submit button not found",
    };
  } catch (error) {
    return {
      success: false,
      platform: "icims",
      message: `iCIMS error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Generic (best-effort)                                              */
/* ------------------------------------------------------------------ */

async function applyGeneric(page: Page, profile: ApplicantProfile): Promise<ApplyResult> {
  try {
    console.log("[Playwright] Handling Generic application");

    // Try to find an "Apply" button first
    const applyBtnSelectors = [
      'a:has-text("Apply Now")',
      'a:has-text("Apply")',
      'button:has-text("Apply Now")',
      'button:has-text("Apply")',
    ];
    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    // Check if there is a form at all
    const formCount = await page.locator("form").count();
    if (formCount === 0) {
      return {
        success: false,
        platform: "generic",
        message: "No application form found on page",
      };
    }

    // Try first name / last name split
    const filledFirst = await tryTypeMultiple(page, [
      'input[name*="first_name"]',
      'input[name*="firstName"]',
      'input[id*="first_name"]',
      'input[id*="firstName"]',
      'input[placeholder*="First Name"]',
      'input[placeholder*="First"]',
      'input[autocomplete="given-name"]',
    ], profile.firstName);

    if (filledFirst) {
      await tryTypeMultiple(page, [
        'input[name*="last_name"]',
        'input[name*="lastName"]',
        'input[id*="last_name"]',
        'input[id*="lastName"]',
        'input[placeholder*="Last Name"]',
        'input[placeholder*="Last"]',
        'input[autocomplete="family-name"]',
      ], profile.lastName);
    } else {
      // Try a combined name field
      await tryTypeMultiple(page, [
        'input[name*="name"]',
        'input[id*="name"]',
        'input[placeholder*="name" i]',
        'input[autocomplete="name"]',
      ], profile.name);
    }

    // Email
    await tryTypeMultiple(page, [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
      'input[autocomplete="email"]',
      'input[placeholder*="email" i]',
    ], profile.email);

    // Phone
    if (profile.phone) {
      await tryTypeMultiple(page, [
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[id*="phone"]',
        'input[autocomplete="tel"]',
        'input[placeholder*="phone" i]',
      ], profile.phone);
    }

    // Location
    if (profile.location) {
      await tryTypeMultiple(page, [
        'input[name*="location"]',
        'input[name*="city"]',
        'input[placeholder*="Location"]',
        'input[placeholder*="City"]',
      ], profile.location);
    }

    // LinkedIn
    if (profile.linkedinUrl) {
      await tryTypeMultiple(page, [
        'input[name*="linkedin"]',
        'input[placeholder*="LinkedIn"]',
      ], profile.linkedinUrl);
    }

    // Resume upload
    if (profile.resumePath) {
      await uploadResume(page, profile.resumePath);
    }

    await stepDelay();
    await takeScreenshot(page, "generic-pre-submit");

    // Submit
    let submitted = false;
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit Application")',
      'button:has-text("Submit")',
      'button:has-text("Apply")',
      'button:has-text("Send")',
    ];
    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    }

    return {
      success: submitted,
      platform: "generic",
      message: submitted
        ? "Application submitted (generic form)"
        : "Form fields filled but submit button not found",
    };
  } catch (error) {
    return {
      success: false,
      platform: "generic",
      message: `Generic form error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}
