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
const APPLICATION_TIMEOUT = 90_000; // 90 seconds per application
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Confirmation keywords that indicate a successful submission */
const CONFIRMATION_KEYWORDS = [
  "thank you",
  "thanks for applying",
  "application submitted",
  "application received",
  "successfully submitted",
  "we have received",
  "your application has been",
  "application complete",
  "you have applied",
  "confirmation",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Small random delay to appear human-like (200–500 ms) */
function humanDelay(): Promise<void> {
  const ms = 200 + Math.random() * 300;
  return new Promise((r) => setTimeout(r, ms));
}

/** Longer random delay between major steps (1000–2000 ms) */
function stepDelay(): Promise<void> {
  const ms = 1000 + Math.random() * 1000;
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
      // Ignore -- popup may not exist
    }
  }
}

/** Type text into a field with human-like delay */
async function humanType(page: Page, selector: string, text: string): Promise<boolean> {
  try {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loc.click({ timeout: 3000 });
      await humanDelay();
      // Clear existing content first
      await loc.fill("");
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

/**
 * Check if the page shows a confirmation message indicating successful submission.
 * Returns true if confirmation text is found.
 */
async function checkForConfirmation(page: Page): Promise<boolean> {
  try {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const lower = bodyText.toLowerCase();
    return CONFIRMATION_KEYWORDS.some((kw) => lower.includes(kw));
  } catch {
    return false;
  }
}

/**
 * Scroll down the page to reveal any additional fields that might be below the fold.
 */
async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await humanDelay();
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
  console.log(`[Playwright] Profile: ${profile.firstName} ${profile.lastName}, email: ${profile.email}, phone: ${profile.phone}, location: ${profile.location}`);

  try {
    browser = await chromium.launch({
      headless: false,
      channel: "chrome",
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

    // Take a final screenshot for debugging
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
      { timeout: 15000 }
    ).catch(() => {});
    await stepDelay();

    // --- Fill first name ---
    console.log("[Playwright] Filling first name");
    await tryTypeMultiple(page, [
      'input[name*="first_name"]',
      'input[id*="first_name"]',
      'input[autocomplete="given-name"]',
      'input[placeholder*="First"]',
    ], profile.firstName);
    await stepDelay();

    // --- Fill last name ---
    console.log("[Playwright] Filling last name");
    await tryTypeMultiple(page, [
      'input[name*="last_name"]',
      'input[id*="last_name"]',
      'input[autocomplete="family-name"]',
      'input[placeholder*="Last"]',
    ], profile.lastName);
    await stepDelay();

    // --- Fill email ---
    console.log("[Playwright] Filling email");
    await tryTypeMultiple(page, [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
      'input[autocomplete="email"]',
    ], profile.email);
    await stepDelay();

    // --- Fill phone ---
    if (profile.phone) {
      console.log("[Playwright] Filling phone");
      await tryTypeMultiple(page, [
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[id*="phone"]',
        'input[autocomplete="tel"]',
      ], profile.phone);
      await stepDelay();
    }

    // --- Select Country dropdown (required on Greenhouse) ---
    console.log("[Playwright] Selecting country");
    const countrySelected = await selectGreenhouseCountry(page, "United States");
    if (countrySelected) {
      console.log("[Playwright] Country selected: United States");
      await stepDelay();
    }

    // --- Fill Location (City) ---
    // Greenhouse uses an autocomplete location field
    if (profile.location) {
      console.log("[Playwright] Filling location/city");
      const locationFilled = await fillGreenhouseLocation(page, profile.location);
      if (locationFilled) {
        console.log("[Playwright] Location filled:", profile.location);
      }
      await stepDelay();
    }

    // --- Fill LinkedIn ---
    if (profile.linkedinUrl) {
      await tryTypeMultiple(page, [
        'input[name*="linkedin"]',
        'input[id*="linkedin"]',
        'input[placeholder*="LinkedIn"]',
        'input[name*="url[LinkedIn]"]',
      ], profile.linkedinUrl);
    }

    // --- Fill portfolio ---
    if (profile.portfolioUrl) {
      await tryTypeMultiple(page, [
        'input[name*="portfolio"]',
        'input[name*="website"]',
        'input[placeholder*="Portfolio"]',
        'input[placeholder*="Website"]',
      ], profile.portfolioUrl);
    }

    // --- Upload resume ---
    if (profile.resumePath) {
      console.log("[Playwright] Uploading resume");
      await uploadResume(page, profile.resumePath);
    }

    // Scroll down to check for additional required fields
    await scrollToBottom(page);
    await stepDelay();

    // Look for any additional required fields we may have missed
    // Check for required select dropdowns that are not filled
    await fillRequiredSelectsWithFirstOption(page);

    // Take pre-submit screenshot
    await takeScreenshot(page, "greenhouse-pre-submit");

    // --- Click submit ---
    console.log("[Playwright] Clicking submit");
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
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          console.log(`[Playwright] Submit clicked via: ${sel}`);
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      // Wait for page to respond after submit
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await stepDelay();
      await stepDelay(); // extra wait for slow confirmations

      // Take post-submit screenshot
      await takeScreenshot(page, "greenhouse-post-submit");

      // Check for confirmation
      const confirmed = await checkForConfirmation(page);
      if (confirmed) {
        console.log("[Playwright] Greenhouse: Confirmation detected!");
        return {
          success: true,
          platform: "greenhouse",
          message: "Application submitted and confirmed via Greenhouse",
        };
      }

      // Check if we're still on the same form (validation errors)
      const hasErrors = await page.locator('.field-error, .error-message, [class*="error"], .invalid-feedback').first()
        .isVisible({ timeout: 2000 }).catch(() => false);
      if (hasErrors) {
        console.log("[Playwright] Greenhouse: Form validation errors detected after submit");
        return {
          success: false,
          platform: "greenhouse",
          message: "Greenhouse form has validation errors - some required fields may be missing",
        };
      }

      // If no confirmation text but also no errors, assume it went through
      return {
        success: true,
        platform: "greenhouse",
        message: "Application submitted via Greenhouse (no explicit confirmation detected)",
      };
    }

    return {
      success: false,
      platform: "greenhouse",
      message: "Greenhouse form filled but submit button not found",
    };
  } catch (error) {
    return {
      success: false,
      platform: "greenhouse",
      message: `Greenhouse error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/**
 * Select a country in Greenhouse's country dropdown.
 * Greenhouse uses either a native <select> or a custom dropdown.
 */
async function selectGreenhouseCountry(page: Page, country: string): Promise<boolean> {
  // Try 1: Native <select> element for country
  const selectSelectors = [
    'select[name*="country"]',
    'select[id*="country"]',
    'select[data-field*="country"]',
    'select[aria-label*="Country"]',
  ];
  for (const sel of selectSelectors) {
    try {
      const select = page.locator(sel).first();
      if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
        await select.selectOption({ label: country });
        await humanDelay();
        return true;
      }
    } catch { /* try next */ }
  }

  // Try 2: Custom dropdown (click to open, then select option)
  const dropdownTriggers = [
    '[class*="country"] [class*="select"]',
    '[data-field*="country"]',
    'div[class*="country"]',
    'label:has-text("Country") + div',
  ];
  for (const sel of dropdownTriggers) {
    try {
      const trigger = page.locator(sel).first();
      if (await trigger.isVisible({ timeout: 1000 }).catch(() => false)) {
        await trigger.click();
        await humanDelay();
        // Look for the option in dropdown list
        const option = page.locator(`li:has-text("${country}"), div[role="option"]:has-text("${country}"), option:has-text("${country}")`).first();
        if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
          await option.click();
          await humanDelay();
          return true;
        }
      }
    } catch { /* try next */ }
  }

  // Try 3: Select by value instead of label
  for (const sel of selectSelectors) {
    try {
      const select = page.locator(sel).first();
      if (await select.count() > 0) {
        // Try common US values
        for (const val of ["US", "USA", "United States", "United States of America"]) {
          try {
            await select.selectOption(val);
            await humanDelay();
            return true;
          } catch { /* try next value */ }
        }
      }
    } catch { /* try next */ }
  }

  console.log("[Playwright] Could not find/select country dropdown");
  return false;
}

/**
 * Fill the location/city field on Greenhouse.
 * Greenhouse often has an autocomplete field that shows suggestions.
 */
async function fillGreenhouseLocation(page: Page, location: string): Promise<boolean> {
  const locationSelectors = [
    'input[name*="location"]',
    'input[id*="location"]',
    'input[placeholder*="Location"]',
    'input[placeholder*="City"]',
    'input[name*="city"]',
    'input[id*="city"]',
    'input[autocomplete="address-level2"]',
    'input[data-field*="location"]',
  ];

  for (const sel of locationSelectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click();
        await humanDelay();
        await loc.fill("");
        await humanDelay();
        // Type slowly to trigger autocomplete
        await loc.pressSequentially(location, { delay: 80 });
        await stepDelay();

        // Check for autocomplete suggestions and click the first one
        const suggestionSelectors = [
          '.pac-item', // Google Places autocomplete
          '[class*="autocomplete"] li',
          '[class*="suggestion"]',
          '[role="option"]',
          '[class*="dropdown"] li',
          '.location-autocomplete-results li',
        ];
        for (const suggSel of suggestionSelectors) {
          try {
            const suggestion = page.locator(suggSel).first();
            if (await suggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
              await suggestion.click();
              await humanDelay();
              return true;
            }
          } catch { /* try next */ }
        }

        // No autocomplete suggestions appeared -- the typed text should suffice
        return true;
      }
    } catch { /* try next */ }
  }

  return false;
}

/**
 * Fill any remaining required <select> elements that are still on their default/placeholder value.
 * Uses the first non-placeholder option.
 */
async function fillRequiredSelectsWithFirstOption(page: Page) {
  try {
    const selects = page.locator('select[required], select[aria-required="true"]');
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      try {
        const select = selects.nth(i);
        const currentVal = await select.inputValue().catch(() => "");
        // If the current value is empty or looks like a placeholder, select the first real option
        if (!currentVal || currentVal === "" || currentVal === "0") {
          const options = select.locator("option");
          const optCount = await options.count();
          for (let j = 1; j < optCount; j++) { // skip index 0 (usually placeholder)
            const optVal = await options.nth(j).getAttribute("value").catch(() => "");
            if (optVal && optVal !== "" && optVal !== "0") {
              await select.selectOption({ index: j });
              await humanDelay();
              break;
            }
          }
        }
      } catch { /* skip this select */ }
    }
  } catch { /* non-critical */ }
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
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await btn.click();
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
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
    await stepDelay();

    // Fill email
    await tryTypeMultiple(page, [
      'input[name="email"]',
      'input[type="email"]',
    ], profile.email);
    await stepDelay();

    // Fill phone
    if (profile.phone) {
      await tryTypeMultiple(page, [
        'input[name="phone"]',
        'input[type="tel"]',
      ], profile.phone);
      await stepDelay();
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
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await stepDelay();
      await takeScreenshot(page, "lever-post-submit");

      const confirmed = await checkForConfirmation(page);
      if (confirmed) {
        return {
          success: true,
          platform: "lever",
          message: "Application submitted and confirmed via Lever",
        };
      }

      return {
        success: true,
        platform: "lever",
        message: "Application submitted via Lever (no explicit confirmation detected)",
      };
    }

    return {
      success: false,
      platform: "lever",
      message: "Lever form filled but submit button not found",
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

    // Step 1: Click "Apply" to start the application
    console.log("[Playwright] Workday: Looking for Apply button on job page");
    const applyBtnSelectors = [
      'a[data-automation-id="jobPostingApplyButton"]',
      'button[data-automation-id="jobPostingApplyButton"]',
      'a:has-text("Apply")',
      'button:has-text("Apply")',
    ];
    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log(`[Playwright] Workday: Clicking Apply button via: ${sel}`);
          await btn.click();
          await stepDelay();
          await stepDelay(); // extra wait for Workday SPA loading
          break;
        }
      } catch { /* continue */ }
    }

    // Step 2: Handle the popup dialog with "Autofill with Resume" / "Apply Manually" / "Use My Last Application"
    console.log("[Playwright] Workday: Looking for application method dialog");
    await handleWorkdayMethodDialog(page);
    await stepDelay();

    // Step 3: Handle "Sign In" or "Create Account" pages
    // Workday sometimes requires account creation -- try to skip or use "Continue without account"
    await handleWorkdayAccountPage(page, profile.email);
    await stepDelay();

    // Step 4: Wait for the actual application form to load
    console.log("[Playwright] Workday: Waiting for application form");
    await page.waitForSelector(
      'input[data-automation-id], input[type="text"], input[type="email"], form',
      { timeout: 20000 }
    ).catch(() => {});
    await stepDelay();

    // Dismiss any popups that appeared
    await dismissPopups(page);

    // Step 5: Fill the "My Information" section
    // Workday uses data-automation-id attributes heavily
    console.log("[Playwright] Workday: Filling personal information");

    // First name
    await tryTypeMultiple(page, [
      'input[data-automation-id="legalNameSection_firstName"]',
      'input[data-automation-id="firstName"]',
      'input[aria-label*="First Name"]',
      'input[placeholder*="First Name"]',
    ], profile.firstName);
    await stepDelay();

    // Last name
    await tryTypeMultiple(page, [
      'input[data-automation-id="legalNameSection_lastName"]',
      'input[data-automation-id="lastName"]',
      'input[aria-label*="Last Name"]',
      'input[placeholder*="Last Name"]',
    ], profile.lastName);
    await stepDelay();

    // Email
    await tryTypeMultiple(page, [
      'input[data-automation-id="email"]',
      'input[data-automation-id="emailAddress"]',
      'input[type="email"]',
      'input[aria-label*="Email"]',
    ], profile.email);
    await stepDelay();

    // Phone (Workday often has country code + number)
    if (profile.phone) {
      // Try the phone device type dropdown first (set to "Mobile" or "Home")
      try {
        const phoneTypeSelect = page.locator('select[data-automation-id*="phone"], select[aria-label*="Phone Device Type"]').first();
        if (await phoneTypeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await phoneTypeSelect.selectOption({ label: "Mobile" }).catch(() => {});
          await humanDelay();
        }
      } catch { /* non-critical */ }

      await tryTypeMultiple(page, [
        'input[data-automation-id="phone-number"]',
        'input[data-automation-id="phone"]',
        'input[data-automation-id*="phoneNumber"]',
        'input[type="tel"]',
        'input[aria-label*="Phone Number"]',
        'input[aria-label*="Phone"]',
      ], profile.phone);
      await stepDelay();
    }

    // Address / Location
    if (profile.location) {
      await tryTypeMultiple(page, [
        'input[data-automation-id="addressSection_city"]',
        'input[data-automation-id="city"]',
        'input[aria-label*="City"]',
        'input[placeholder*="City"]',
      ], profile.location);
      await stepDelay();
    }

    // Upload resume
    if (profile.resumePath) {
      console.log("[Playwright] Workday: Uploading resume");
      // Workday has a specific file upload area
      const workdayFileSelectors = [
        'input[data-automation-id="file-upload-input-ref"]',
        'input[data-automation-id*="resume"]',
        'input[type="file"]',
      ];
      let uploaded = false;
      for (const sel of workdayFileSelectors) {
        try {
          const input = page.locator(sel).first();
          if (await input.count() > 0) {
            await input.setInputFiles(profile.resumePath);
            uploaded = true;
            console.log(`[Playwright] Workday: Resume uploaded via: ${sel}`);
            await stepDelay();
            break;
          }
        } catch { /* try next */ }
      }
      if (!uploaded) {
        // Fallback: generic upload
        await uploadResume(page, profile.resumePath);
      }
    }

    await stepDelay();
    await takeScreenshot(page, "workday-step1");

    // Step 6: Navigate through multi-step form
    // Workday has "Next" and "Continue" buttons between steps
    console.log("[Playwright] Workday: Navigating through form steps");
    let stepsCompleted = 0;
    const maxSteps = 5; // safety limit

    for (let step = 0; step < maxSteps; step++) {
      const nextSelectors = [
        'button[data-automation-id="bottom-navigation-next-button"]',
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button:has-text("Save and Continue")',
      ];

      let clickedNext = false;
      for (const sel of nextSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await takeScreenshot(page, `workday-step${step + 1}-pre`);
            await btn.click();
            clickedNext = true;
            stepsCompleted++;
            console.log(`[Playwright] Workday: Clicked Next/Continue (step ${step + 1})`);
            await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
            await stepDelay();
            await stepDelay(); // extra wait for Workday SPA transitions
            break;
          }
        } catch { /* continue */ }
      }

      // Check if we've reached the submit button
      const submitBtn = page.locator('button[data-automation-id="bottom-navigation-next-button"]:has-text("Submit"), button:has-text("Submit Application"), button:has-text("Submit")').first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("[Playwright] Workday: Found Submit button");
        await takeScreenshot(page, "workday-pre-submit");
        await submitBtn.click();
        console.log("[Playwright] Workday: Submit clicked");

        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await stepDelay();
        await takeScreenshot(page, "workday-post-submit");

        const confirmed = await checkForConfirmation(page);
        return {
          success: confirmed,
          platform: "workday",
          message: confirmed
            ? "Application submitted and confirmed via Workday"
            : "Application submitted via Workday (confirmation not detected)",
        };
      }

      if (!clickedNext) {
        // No more Next buttons and no Submit button found
        break;
      }

      // Fill any additional fields that appear in new steps
      await fillWorkdayStepFields(page, profile);
    }

    // If we got here, we went through steps but didn't find a submit
    await takeScreenshot(page, "workday-final");
    return {
      success: stepsCompleted > 0,
      platform: "workday",
      message: stepsCompleted > 0
        ? `Workday: Completed ${stepsCompleted} form steps but could not find final Submit button`
        : "Workday: Could not navigate form steps",
    };
  } catch (error) {
    return {
      success: false,
      platform: "workday",
      message: `Workday error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/**
 * Handle the Workday popup dialog that appears with options like
 * "Autofill with Resume", "Apply Manually", "Use My Last Application"
 */
async function handleWorkdayMethodDialog(page: Page) {
  const applyManuallySelectors = [
    'button:has-text("Apply Manually")',
    'a:has-text("Apply Manually")',
    '[data-automation-id="applyManually"]',
    'button:has-text("Apply manually")',
  ];

  // Wait a bit for the dialog to appear
  await page.waitForTimeout(3000);

  for (const sel of applyManuallySelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log(`[Playwright] Workday: Clicking "Apply Manually" via: ${sel}`);
        await btn.click();
        await stepDelay();
        return;
      }
    } catch { /* continue */ }
  }

  // If "Apply Manually" not found, try other options
  // Maybe there's "Continue" or "Start" instead
  const altSelectors = [
    'button:has-text("Start")',
    'button:has-text("Continue")',
    'button:has-text("Begin")',
    'a:has-text("Start Application")',
  ];
  for (const sel of altSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[Playwright] Workday: Clicking alt button: ${sel}`);
        await btn.click();
        await stepDelay();
        return;
      }
    } catch { /* continue */ }
  }

  console.log("[Playwright] Workday: No method dialog found, continuing");
}

/**
 * Handle Workday's "Create Account" or "Sign In" page.
 * Try to find a "Continue without account" or guest option.
 */
async function handleWorkdayAccountPage(page: Page, email?: string) {
  const guestSelectors = [
    'button:has-text("Continue as Guest")',
    'a:has-text("Continue as Guest")',
    'button:has-text("Apply as Guest")',
    'a:has-text("Apply as Guest")',
    'button:has-text("Skip")',
    'a:has-text("Skip this step")',
  ];

  for (const sel of guestSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[Playwright] Workday: Clicking guest option: ${sel}`);
        await btn.click();
        await stepDelay();
        return;
      }
    } catch { /* continue */ }
  }

  // If no guest option, check for email-based account creation
  // Some Workday sites let you enter email to continue
  try {
    const emailInput = page.locator('input[data-automation-id="email"], input[type="email"]').first();
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("[Playwright] Workday: Entering email on account page");
      await emailInput.fill(email || "");
      await humanDelay();

      // Look for continue/next button
      const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next"), button[type="submit"]').first();
      if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueBtn.click();
        await stepDelay();
      }
    }
  } catch { /* non-critical */ }
}

/**
 * Fill any visible form fields in a Workday step.
 * Used when navigating through multi-step forms.
 */
async function fillWorkdayStepFields(page: Page, profile: ApplicantProfile) {
  // Check for common fields that might appear in later steps
  // These are fields we haven't filled yet

  // Source/referral question
  try {
    const sourceSelect = page.locator('select[data-automation-id*="source"], select[aria-label*="How did you hear"]').first();
    if (await sourceSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Select "Website" or the first non-empty option
      const options = sourceSelect.locator("option");
      const count = await options.count();
      for (let i = 1; i < count; i++) {
        const text = await options.nth(i).textContent().catch(() => "");
        if (text && (text.toLowerCase().includes("website") || text.toLowerCase().includes("job board") || text.toLowerCase().includes("online"))) {
          await sourceSelect.selectOption({ index: i });
          break;
        }
      }
    }
  } catch { /* non-critical */ }

  // Resume upload (might appear in a later step)
  if (profile.resumePath) {
    try {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        const currentFiles = await fileInput.inputValue().catch(() => "");
        if (!currentFiles) {
          await fileInput.setInputFiles(profile.resumePath);
          console.log("[Playwright] Workday: Resume uploaded in later step");
          await stepDelay();
        }
      }
    } catch { /* non-critical */ }
  }

  // Required checkboxes (e.g., "I agree to terms")
  try {
    const checkboxes = page.locator('input[type="checkbox"][required], input[type="checkbox"][aria-required="true"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      const isChecked = await checkboxes.nth(i).isChecked().catch(() => true);
      if (!isChecked) {
        await checkboxes.nth(i).check();
        await humanDelay();
      }
    }
  } catch { /* non-critical */ }
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
    await page.waitForSelector('input[name*="firstName"], input[name*="email"], form', { timeout: 15000 }).catch(() => {});
    await stepDelay();

    // Fill first name
    await tryTypeMultiple(page, [
      'input[name*="firstName"]',
      'input[placeholder*="First"]',
      'input[data-test="first-name"]',
    ], profile.firstName);
    await stepDelay();

    // Fill last name
    await tryTypeMultiple(page, [
      'input[name*="lastName"]',
      'input[placeholder*="Last"]',
      'input[data-test="last-name"]',
    ], profile.lastName);
    await stepDelay();

    // Fill email
    await tryTypeMultiple(page, [
      'input[type="email"]',
      'input[name*="email"]',
      'input[data-test="email"]',
    ], profile.email);
    await stepDelay();

    // Fill phone
    if (profile.phone) {
      await tryTypeMultiple(page, [
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[data-test="phone"]',
      ], profile.phone);
      await stepDelay();
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
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await stepDelay();
      await takeScreenshot(page, "smartrecruiters-post-submit");

      const confirmed = await checkForConfirmation(page);
      return {
        success: confirmed || submitted,
        platform: "smartrecruiters",
        message: confirmed
          ? "Application submitted and confirmed via SmartRecruiters"
          : "Application submitted via SmartRecruiters",
      };
    }

    return {
      success: false,
      platform: "smartrecruiters",
      message: "SmartRecruiters form filled but submit button not found",
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

    // iCIMS typically uses iframes -- look for the apply button
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
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    // iCIMS may use iframes for forms -- try main page first, then iframes
    let handledViaFrame = false;

    // Check for iframes
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const emailInFrame = frame.locator('input[type="email"], input[name*="email"]').first();
        if (await emailInFrame.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Found the form in an iframe
          await emailInFrame.fill(profile.email);
          await humanDelay();

          // First name
          const fnInput = frame.locator('input[name*="firstName"], input[name*="first_name"], input[placeholder*="First"]').first();
          if (await fnInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await fnInput.fill(profile.firstName);
            await humanDelay();
          }

          // Last name
          const lnInput = frame.locator('input[name*="lastName"], input[name*="last_name"], input[placeholder*="Last"]').first();
          if (await lnInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await lnInput.fill(profile.lastName);
            await humanDelay();
          }

          // Phone
          if (profile.phone) {
            const phoneInput = frame.locator('input[type="tel"], input[name*="phone"]').first();
            if (await phoneInput.isVisible({ timeout: 1000 }).catch(() => false)) {
              await phoneInput.fill(profile.phone);
              await humanDelay();
            }
          }

          // Resume upload in frame
          if (profile.resumePath) {
            const fileInput = frame.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
              await fileInput.setInputFiles(profile.resumePath);
              await stepDelay();
            }
          }

          handledViaFrame = true;
          break;
        }
      } catch { /* continue to next frame */ }
    }

    // If not handled via frame, try main page
    if (!handledViaFrame) {
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
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await stepDelay();
      await takeScreenshot(page, "icims-post-submit");

      const confirmed = await checkForConfirmation(page);
      return {
        success: confirmed || submitted,
        platform: "icims",
        message: confirmed
          ? "Application submitted and confirmed via iCIMS"
          : "Application submitted via iCIMS",
      };
    }

    return {
      success: false,
      platform: "icims",
      message: "iCIMS form filled but submit button not found",
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
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
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
    await stepDelay();

    // Email
    await tryTypeMultiple(page, [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
      'input[autocomplete="email"]',
      'input[placeholder*="email" i]',
    ], profile.email);
    await stepDelay();

    // Phone
    if (profile.phone) {
      await tryTypeMultiple(page, [
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[id*="phone"]',
        'input[autocomplete="tel"]',
        'input[placeholder*="phone" i]',
      ], profile.phone);
      await stepDelay();
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

    await scrollToBottom(page);
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
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          submitted = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await stepDelay();
      await takeScreenshot(page, "generic-post-submit");

      const confirmed = await checkForConfirmation(page);
      return {
        success: confirmed || submitted,
        platform: "generic",
        message: confirmed
          ? "Application submitted and confirmed (generic form)"
          : "Application submitted (generic form)",
      };
    }

    return {
      success: false,
      platform: "generic",
      message: "Form fields filled but submit button not found",
    };
  } catch (error) {
    return {
      success: false,
      platform: "generic",
      message: `Generic form error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}
