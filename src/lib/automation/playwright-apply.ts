import { chromium, Browser, Page } from "playwright";
import { resolve } from "path";
import { mkdirSync, existsSync, statSync } from "fs";

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
  applyEmail?: string; // Generated @apply.iautoaply.com email for ATS accounts
  applyEmailPassword?: string; // Password for the apply email (for Workday account creation)
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
const WORKDAY_TIMEOUT = 180_000; // 180 seconds for Workday (7 steps)
const WORKDAY_PASSWORD = "iAutoApply2024!";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Confirmation keywords that indicate a successful submission */
const CONFIRMATION_KEYWORDS = [
  "thank you for applying",
  "thanks for applying",
  "application submitted",
  "application received",
  "successfully submitted",
  "we have received your application",
  "your application has been submitted",
  "your application has been received",
  "application complete",
  "you have successfully applied",
  "you have applied",
  "application confirmation",
  "we'll review your application",
  "we will review your application",
];

/** Error keywords that indicate the submission failed */
const ERROR_KEYWORDS = [
  "required field",
  "please fill",
  "is required",
  "please complete",
  "missing required",
  "please enter",
  "invalid format",
  "must be completed",
  "error submitting",
  "submission failed",
  "could not submit",
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
  // Verify file exists before attempting upload
  if (!existsSync(resumePath)) {
    console.error(`[Playwright] Resume file does not exist: ${resumePath}`);
    return false;
  }
  console.log(`[Playwright] Resume file verified at: ${resumePath} (${statSync(resumePath).size} bytes)`);

  const fileSelectors = [
    'input[type="file"]',
    'input[name*="resume"]',
    'input[name*="Resume"]',
    'input[accept*=".pdf"]',
    'input[accept*="application/pdf"]',
    'input[accept*=".doc"]',
    'input[accept*=".txt"]',
    'input[id*="resume"]',
    'input[id*="Resume"]',
    'input[data-field*="resume"]',
    'input[name*="file"]',
    'input[id*="file"]',
  ];

  // First try: find visible or hidden file inputs directly
  for (const sel of fileSelectors) {
    try {
      const input = page.locator(sel).first();
      if (await input.count() > 0) {
        await input.setInputFiles(resumePath);
        await stepDelay();
        console.log(`[Playwright] Resume uploaded via selector: ${sel}`);
        return true;
      }
    } catch (err) {
      console.log(`[Playwright] Resume upload failed for ${sel}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Second try: Greenhouse "Attach" button triggers a hidden file input
  // Click the Attach button and use fileChooser event
  try {
    const attachButton = page.locator('button:has-text("Attach"), a:has-text("Attach"), label:has-text("Attach")').first();
    if (await attachButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("[Playwright] Found Attach button, using fileChooser event");
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 5000 }),
        attachButton.click(),
      ]);
      await fileChooser.setFiles(resumePath);
      await stepDelay();
      console.log("[Playwright] Resume uploaded via Attach button fileChooser");
      return true;
    }
  } catch (err) {
    console.log(`[Playwright] Attach button approach failed: ${err instanceof Error ? err.message : err}`);
  }

  // Third try: find ANY file input on the page (including hidden ones)
  try {
    const allFileInputs = page.locator('input[type="file"]');
    const count = await allFileInputs.count();
    console.log(`[Playwright] Found ${count} total file inputs on page`);
    for (let i = 0; i < count; i++) {
      try {
        await allFileInputs.nth(i).setInputFiles(resumePath);
        await stepDelay();
        console.log(`[Playwright] Resume uploaded via file input #${i}`);
        return true;
      } catch { /* try next */ }
    }
  } catch { /* skip */ }

  console.error("[Playwright] Failed to upload resume - no working file input found");
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
 * Returns true only if confirmation text is found AND no error text is present.
 */
async function checkForConfirmation(page: Page): Promise<boolean> {
  try {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const lower = bodyText.toLowerCase();
    const hasConfirmation = CONFIRMATION_KEYWORDS.some((kw) => lower.includes(kw));
    const hasErrors = ERROR_KEYWORDS.some((kw) => lower.includes(kw));
    // Only confirm if we see confirmation text and NO error text
    return hasConfirmation && !hasErrors;
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
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-translate",
        "--no-first-run",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-component-update",
        "--js-flags=--max-old-space-size=96",
      ],
    });

    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
      // Block images and fonts to save memory
      bypassCSP: true,
    });

    // Block images, fonts, and media to reduce memory
    await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,ico,woff,woff2,ttf,eot}', (route) => route.abort());
    await context.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        return route.abort();
      }
      return route.continue();
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

    // --- Fill LinkedIn (always fill - many forms require it) ---
    const linkedinUrl = profile.linkedinUrl || `https://www.linkedin.com/in/${profile.firstName?.toLowerCase() || "applicant"}-${profile.lastName?.toLowerCase() || "profile"}`;
    console.log("[Playwright] Filling LinkedIn:", linkedinUrl);
    await tryTypeMultiple(page, [
      'input[name*="linkedin"]',
      'input[id*="linkedin"]',
      'input[placeholder*="LinkedIn"]',
      'input[name*="url[LinkedIn]"]',
      'input[aria-label*="LinkedIn"]',
      'input[data-field*="linkedin"]',
    ], linkedinUrl);

    // Try filling LinkedIn via label (Greenhouse often uses labels)
    try {
      const linkedinLabels = page.locator('label:has-text("LinkedIn")');
      const llCount = await linkedinLabels.count();
      for (let i = 0; i < llCount; i++) {
        const label = linkedinLabels.nth(i);
        const forAttr = await label.getAttribute("for").catch(() => null);
        if (forAttr) {
          const input = page.locator(`#${CSS.escape(forAttr)}`).first();
          const val = await input.inputValue().catch(() => "filled");
          if (!val || val === "") {
            await input.fill(linkedinUrl);
            console.log("[Playwright] LinkedIn filled via label");
          }
        }
      }
    } catch { /* skip */ }

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
      console.log("[Playwright] Uploading resume from:", profile.resumePath);
      const uploaded = await uploadResume(page, profile.resumePath);
      if (!uploaded) {
        console.error("[Playwright] WARNING: Resume upload failed! Form submission will likely fail.");
      }
    } else {
      console.error("[Playwright] WARNING: No resume path provided! Form submission will likely fail.");
    }

    // Scroll down to check for additional required fields
    await scrollToBottom(page);
    await stepDelay();

    // --- Fill common required text fields Greenhouse often asks ---
    console.log("[Playwright] Greenhouse: Filling common required text fields");
    await fillGreenhouseCommonFields(page, profile);

    // Look for any additional required fields we may have missed
    // Check for required select dropdowns that are not filled
    await fillRequiredSelectsWithFirstOption(page);

    // Handle ALL dropdown types on Greenhouse forms
    try {
      // Fill ALL native select elements (not just required ones)
      const allSelects = page.locator('select');
      const selectCount = await allSelects.count();
      console.log(`[Playwright] Greenhouse: Found ${selectCount} total select elements`);
      for (let i = 0; i < selectCount; i++) {
        const sel = allSelects.nth(i);
        const currentVal = await sel.inputValue().catch(() => "");
        if (!currentVal || currentVal === "") {
          const options = sel.locator("option");
          const optCount = await options.count();
          // Try to find "I do not wish to answer" or "Decline" option first
          let selectedDecline = false;
          for (let j = 0; j < optCount; j++) {
            const text = await options.nth(j).textContent().catch(() => "");
            if (text && (text.toLowerCase().includes("decline") || text.toLowerCase().includes("do not wish") || text.toLowerCase().includes("prefer not"))) {
              await sel.selectOption({ index: j });
              selectedDecline = true;
              console.log(`[Playwright] Greenhouse: Selected "${text}" for dropdown ${i}`);
              break;
            }
          }
          // Try "Yes" for work authorization type questions
          if (!selectedDecline) {
            for (let j = 0; j < optCount; j++) {
              const text = await options.nth(j).textContent().catch(() => "");
              if (text && text.trim().toLowerCase() === "yes") {
                await sel.selectOption({ index: j });
                selectedDecline = true;
                console.log(`[Playwright] Greenhouse: Selected "Yes" for dropdown ${i}`);
                break;
              }
            }
          }
          if (!selectedDecline && optCount > 1) {
            // Select first non-empty option
            await sel.selectOption({ index: 1 });
            const chosen = await options.nth(1).textContent().catch(() => "option 1");
            console.log(`[Playwright] Greenhouse: Selected first option "${chosen}" for dropdown ${i}`);
          }
        }
      }

      // Handle React Select custom dropdowns - context-aware
      const reactSelectSelectors = [
        '[class*="select__placeholder"]',
        '[class*="Select__placeholder"]',
        '[class*="css-"][class*="placeholder"]',
        '.select__placeholder',
      ];

      for (const reactSel of reactSelectSelectors) {
        const reactSelects = page.locator(reactSel);
        const reactSelectCount = await reactSelects.count();
        if (reactSelectCount > 0) {
          console.log(`[Playwright] Greenhouse: Found ${reactSelectCount} React Select dropdowns via ${reactSel}`);
          for (let i = 0; i < reactSelectCount; i++) {
            try {
              const placeholder = reactSelects.nth(i);

              // Get the context: find the closest label or question text
              const contextText = await placeholder.evaluate((el: Element) => {
                // Walk up to find a label, fieldset legend, or nearby text
                let node: Element | null = el;
                for (let depth = 0; depth < 8 && node; depth++) {
                  node = node.parentElement;
                  if (!node) break;
                  // Check for a label within this container
                  const label = node.querySelector('label, legend, .field-label, [class*="label"]');
                  if (label && label.textContent && label.textContent.trim().length > 3) {
                    return label.textContent.trim().toLowerCase();
                  }
                  // Check for a preceding sibling with text
                  const prev = node.previousElementSibling;
                  if (prev && prev.textContent && prev.textContent.trim().length > 3) {
                    return prev.textContent.trim().toLowerCase();
                  }
                }
                return "";
              }).catch(() => "");

              console.log(`[Playwright] Greenhouse: React Select ${i} context: "${contextText.substring(0, 80)}"`);

              // Click the React Select container
              const container = placeholder.locator('..').first();
              await container.click();
              await page.waitForTimeout(800);

              let clicked = false;

              // Context-aware option selection
              if (contextText.includes("compensation") || contextText.includes("salary") || contextText.includes("pay")) {
                // Pick a salary range — try $35k-$40k or any mid-range option
                const salarySelectors = [
                  '[class*="option"]:has-text("35")',
                  '[class*="option"]:has-text("40")',
                  '[class*="option"]:has-text("30")',
                  '[class*="option"]:has-text("50")',
                  '[role="option"]:has-text("35")',
                  '[role="option"]:has-text("40")',
                  '[role="option"]:has-text("30")',
                  '[role="option"]:has-text("50")',
                ];
                for (const sSel of salarySelectors) {
                  const opt = page.locator(sSel).first();
                  if (await opt.isVisible({ timeout: 400 }).catch(() => false)) {
                    await opt.click();
                    clicked = true;
                    console.log(`[Playwright] Greenhouse: Selected salary option for React Select ${i}`);
                    break;
                  }
                }
                // If no salary number found, pick second option (usually first real range)
                if (!clicked) {
                  const allOpts = page.locator('[class*="select__option"], [role="option"]');
                  const optCount = await allOpts.count();
                  if (optCount > 1) {
                    await allOpts.nth(1).click();
                    clicked = true;
                    console.log(`[Playwright] Greenhouse: Selected 2nd salary option for React Select ${i}`);
                  }
                }
              } else if (contextText.includes("sponsorship") || contextText.includes("visa") || contextText.includes("h-1b") || contextText.includes("immigration")) {
                // No sponsorship needed
                const noSelectors = [
                  '[class*="option"]:has-text("No")',
                  '[role="option"]:has-text("No")',
                  '[class*="option"]:has-text("will not")',
                  '[role="option"]:has-text("will not")',
                ];
                for (const nSel of noSelectors) {
                  const opt = page.locator(nSel).first();
                  if (await opt.isVisible({ timeout: 400 }).catch(() => false)) {
                    await opt.click();
                    clicked = true;
                    console.log(`[Playwright] Greenhouse: Selected "No" for sponsorship React Select ${i}`);
                    break;
                  }
                }
              } else if (contextText.includes("experience") || contextText.includes("years")) {
                // Select 5+ years or "Yes"
                const expSelectors = [
                  '[class*="option"]:has-text("5")',
                  '[class*="option"]:has-text("Yes")',
                  '[role="option"]:has-text("5")',
                  '[role="option"]:has-text("Yes")',
                  '[class*="option"]:has-text("3")',
                  '[role="option"]:has-text("3")',
                ];
                for (const eSel of expSelectors) {
                  const opt = page.locator(eSel).first();
                  if (await opt.isVisible({ timeout: 400 }).catch(() => false)) {
                    await opt.click();
                    clicked = true;
                    console.log(`[Playwright] Greenhouse: Selected experience answer for React Select ${i}`);
                    break;
                  }
                }
              } else if (contextText.includes("authorized") || contextText.includes("eligible") || contextText.includes("right to work") || contextText.includes("legally") || contextText.includes("source of your right")) {
                // Work authorization — try "US Citizen", "Citizen", "Yes", or first option
                const authSelectors = [
                  '[class*="option"]:has-text("Citizen")',
                  '[role="option"]:has-text("Citizen")',
                  '[class*="option"]:has-text("US")',
                  '[role="option"]:has-text("US")',
                  '[class*="option"]:has-text("Yes")',
                  '[role="option"]:has-text("Yes")',
                  '[class*="option"]:has-text("authorized")',
                  '[role="option"]:has-text("authorized")',
                ];
                for (const aSel of authSelectors) {
                  const opt = page.locator(aSel).first();
                  if (await opt.isVisible({ timeout: 400 }).catch(() => false)) {
                    await opt.click();
                    clicked = true;
                    console.log(`[Playwright] Greenhouse: Selected work auth option for React Select ${i}`);
                    break;
                  }
                }
              } else if (contextText.includes("gender") || contextText.includes("self-identification")) {
                // Gender — prefer not to say / decline
                const genderSelectors = [
                  '[class*="option"]:has-text("Decline")',
                  '[role="option"]:has-text("Decline")',
                  '[class*="option"]:has-text("prefer not")',
                  '[role="option"]:has-text("prefer not")',
                  '[class*="option"]:has-text("do not wish")',
                  '[role="option"]:has-text("do not wish")',
                ];
                for (const gSel of genderSelectors) {
                  const opt = page.locator(gSel).first();
                  if (await opt.isVisible({ timeout: 400 }).catch(() => false)) {
                    await opt.click();
                    clicked = true;
                    console.log(`[Playwright] Greenhouse: Selected decline for gender React Select ${i}`);
                    break;
                  }
                }
              }

              // Fallback: try Decline/prefer not, then Yes, then first option
              if (!clicked) {
                const declineSelectors = [
                  '[class*="select__option"]:has-text("Decline")',
                  '[class*="select__option"]:has-text("do not wish")',
                  '[class*="select__option"]:has-text("prefer not")',
                  '[class*="option"]:has-text("Decline")',
                  '[role="option"]:has-text("Decline")',
                  '[role="option"]:has-text("do not wish")',
                ];
                for (const dSel of declineSelectors) {
                  const opt = page.locator(dSel).first();
                  if (await opt.isVisible({ timeout: 400 }).catch(() => false)) {
                    await opt.click();
                    clicked = true;
                    console.log(`[Playwright] Greenhouse: Clicked decline for React Select ${i}`);
                    break;
                  }
                }
              }
              if (!clicked) {
                const yesOpt = page.locator('[class*="select__option"]:has-text("Yes"), [role="option"]:has-text("Yes")').first();
                if (await yesOpt.isVisible({ timeout: 400 }).catch(() => false)) {
                  await yesOpt.click();
                  clicked = true;
                  console.log(`[Playwright] Greenhouse: Clicked "Yes" for React Select ${i}`);
                }
              }
              if (!clicked) {
                const firstOpt = page.locator('[class*="select__option"], [role="option"]').first();
                if (await firstOpt.isVisible({ timeout: 400 }).catch(() => false)) {
                  await firstOpt.click();
                  console.log(`[Playwright] Greenhouse: Clicked first option for React Select ${i}`);
                }
              }
              await page.waitForTimeout(300);
            } catch { /* skip */ }
          }
          break;
        }
      }

      // Handle any unfilled required text inputs and textareas
      await fillEmptyRequiredInputs(page);

      // Check all required checkboxes (agreement, consent, etc.)
      const checkboxes = page.locator('input[type="checkbox"]:not(:checked)');
      const cbCount = await checkboxes.count();
      for (let i = 0; i < cbCount; i++) {
        try {
          await checkboxes.nth(i).check({ force: true });
          console.log(`[Playwright] Checked required checkbox ${i + 1}`);
        } catch { /* skip */ }
      }
    } catch (e) {
      console.log("[Playwright] Greenhouse: Error filling dropdowns:", e);
    }

    await scrollToBottom(page);
    await page.waitForTimeout(1000);

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
      // Use specific Greenhouse error selectors — avoid overly broad [class*="error"]
      const errorSelector = '.field-error, .error-message, .invalid-feedback, [data-error], .form-field--error, .field_with_errors, .field--error';
      const hasErrors = await page.locator(errorSelector).first()
        .isVisible({ timeout: 2000 }).catch(() => false);

      // Also check for the red "Please enter" / "is required" text that Greenhouse shows
      const pageText = await page.textContent("body").catch(() => "") || "";
      const hasRequiredErrors = /please enter your|is required\.|please fill|resume\/cv is required/i.test(pageText) &&
        !CONFIRMATION_KEYWORDS.some(kw => pageText.toLowerCase().includes(kw));

      if (hasErrors || hasRequiredErrors) {
        // Log which fields have errors
        try {
          const errorElements = page.locator(errorSelector);
          const errorCount = await errorElements.count();
          const errorTexts: string[] = [];
          for (let i = 0; i < Math.min(errorCount, 10); i++) {
            const text = await errorElements.nth(i).textContent().catch(() => "");
            if (text && text.trim().length > 0 && text.trim().length < 200) {
              errorTexts.push(text.trim());
            }
          }
          // Also find required fields that are empty
          const emptyRequired = page.locator('input[required]:not([type="hidden"]), select[required], textarea[required]');
          const emptyCount = await emptyRequired.count();
          const emptyFields: string[] = [];
          for (let i = 0; i < Math.min(emptyCount, 10); i++) {
            const val = await emptyRequired.nth(i).inputValue().catch(() => "filled");
            if (!val || val === "") {
              const name = await emptyRequired.nth(i).getAttribute("name").catch(() => "");
              const placeholder = await emptyRequired.nth(i).getAttribute("placeholder").catch(() => "");
              const ariaLabel = await emptyRequired.nth(i).getAttribute("aria-label").catch(() => "");
              emptyFields.push(name || placeholder || ariaLabel || "unknown");
            }
          }
          console.log(`[Playwright] Greenhouse: ${errorTexts.length} error messages:`, errorTexts.join(" | "));
          console.log(`[Playwright] Greenhouse: ${emptyFields.length} empty required fields:`, emptyFields.join(", "));
        } catch { /* ignore logging errors */ }

        console.log("[Playwright] Greenhouse: Form validation errors detected after submit");
        return {
          success: false,
          platform: "greenhouse",
          message: "Greenhouse form has validation errors - some required fields may be missing",
        };
      }

      // No confirmation and no errors - check if URL changed (redirect to thank you page)
      const currentUrl = page.url().toLowerCase();
      const urlChanged = currentUrl.includes("thank") ||
                         currentUrl.includes("confirm") ||
                         currentUrl.includes("success") ||
                         currentUrl.includes("applied") ||
                         currentUrl.includes("complete") ||
                         currentUrl.includes("submitted");

      // If no confirmation text but also no errors, the form was likely submitted successfully
      // Many Greenhouse forms just show a brief flash or redirect without clear confirmation text
      const noFormVisible = !(await page.locator('button[type="submit"], input[type="submit"], #submit_app').first()
        .isVisible({ timeout: 2000 }).catch(() => false));

      if (urlChanged || noFormVisible) {
        return {
          success: true,
          platform: "greenhouse",
          message: urlChanged
            ? "Application submitted via Greenhouse (URL redirect detected)"
            : "Application submitted via Greenhouse (form no longer visible after submit)",
        };
      }

      return {
        success: false,
        platform: "greenhouse",
        message: "Form submitted but no confirmation detected - application may not have completed",
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
 * Fill common required text fields on Greenhouse forms.
 * These include "How did you hear about us?", "Are you authorized to work?", etc.
 */
async function fillGreenhouseCommonFields(page: Page, profile: ApplicantProfile) {
  try {
    // Common question patterns and their answers
    const commonAnswers: { patterns: string[]; answer: string }[] = [
      {
        patterns: ["how did you hear", "how did you find", "where did you hear", "referral source", "source of application"],
        answer: "Online Job Board",
      },
      {
        patterns: ["authorized to work", "legally authorized", "work authorization", "eligible to work", "right to work"],
        answer: "Yes",
      },
      {
        patterns: ["require sponsorship", "visa sponsorship", "immigration sponsorship", "need sponsorship"],
        answer: "No",
      },
      {
        patterns: ["salary expectation", "desired salary", "expected salary", "compensation expectation", "desired compensation", "compensation range", "pay expectation"],
        answer: "$35,000 - $40,000",
      },
      {
        patterns: ["years of experience", "how many years"],
        answer: "5",
      },
      {
        patterns: ["start date", "available to start", "earliest start", "when can you start"],
        answer: "Immediately",
      },
      {
        patterns: ["cover letter", "why are you interested", "why do you want"],
        answer: `I am very interested in this position and believe my healthcare experience and skills make me a strong candidate. I am excited about the opportunity to contribute to your team.`,
      },
      {
        patterns: ["based in the united kingdom", "based in the uk", "based in netherlands", "based in germany", "based in ireland"],
        answer: "No",
      },
      {
        patterns: ["employment agreement", "post-employment restriction", "non-compete", "employment restriction"],
        answer: "No",
      },
      {
        patterns: ["country of residence", "current country"],
        answer: "United States",
      },
      {
        patterns: ["gender", "pronouns", "self-identification of gender"],
        answer: "Prefer not to say",
      },
      {
        patterns: ["race", "ethnicity", "ethnic"],
        answer: "Prefer not to say",
      },
      {
        patterns: ["veteran", "military"],
        answer: "I am not a protected veteran",
      },
      {
        patterns: ["disability", "disabled"],
        answer: "I do not wish to answer",
      },
      {
        patterns: ["preferred first name", "preferred name", "nickname", "goes by"],
        answer: profile.firstName || "N/A",
      },
      {
        patterns: ["location", "city", "current city", "where are you located", "your city"],
        answer: profile.location?.split(",")[0]?.trim() || "Houston",
      },
      {
        patterns: ["right to work", "source of your right", "work permit", "work eligibility"],
        answer: "US Citizen",
      },
      {
        patterns: ["current company", "current employer"],
        answer: "Open to opportunities",
      },
      {
        patterns: ["notice period", "how soon"],
        answer: "Immediately",
      },
      {
        patterns: ["linkedin", "linkedin url", "linkedin profile"],
        answer: profile.linkedinUrl || "https://linkedin.com/in/applicant",
      },
      {
        patterns: ["website", "portfolio", "personal site"],
        answer: profile.portfolioUrl || "N/A",
      },
    ];

    // Find all visible labels and their associated inputs
    const labels = page.locator('label');
    const labelCount = await labels.count();

    for (let i = 0; i < labelCount; i++) {
      try {
        const label = labels.nth(i);
        const labelText = (await label.textContent().catch(() => "")) || "";
        const labelLower = labelText.toLowerCase().trim();

        if (!labelLower || labelLower.length < 3) continue;

        for (const qa of commonAnswers) {
          if (qa.patterns.some(p => labelLower.includes(p))) {
            // Find the associated input
            const forAttr = await label.getAttribute("for").catch(() => null);
            let input;
            if (forAttr) {
              input = page.locator(`[id="${forAttr.replace(/"/g, '\\"')}"]`).first();
            } else {
              // Try sibling/child input
              input = label.locator('~ input, ~ textarea, ~ div input, ~ div textarea, input, textarea').first();
            }

            if (input && await input.isVisible({ timeout: 500 }).catch(() => false)) {
              const currentVal = await input.inputValue().catch(() => "");
              if (!currentVal || currentVal.trim() === "") {
                const tagName = await input.evaluate(el => el.tagName.toLowerCase()).catch(() => "input");
                if (tagName === "textarea") {
                  await input.fill(qa.answer);
                } else {
                  await input.fill(qa.answer);
                }
                console.log(`[Playwright] Greenhouse: Answered "${labelText.trim().substring(0, 50)}" with "${qa.answer.substring(0, 30)}"`);
              }
            }
            break;
          }
        }
      } catch { /* skip label */ }
    }

    // Also fill any empty required inputs with reasonable defaults
    const requiredInputs = page.locator('input[required]:not([type="file"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea[required]');
    const reqCount = await requiredInputs.count();
    for (let i = 0; i < reqCount; i++) {
      try {
        const inp = requiredInputs.nth(i);
        const val = await inp.inputValue().catch(() => "");
        if (!val || val.trim() === "") {
          const name = (await inp.getAttribute("name").catch(() => "")) || "";
          const placeholder = (await inp.getAttribute("placeholder").catch(() => "")) || "";
          const type = (await inp.getAttribute("type").catch(() => "text")) || "text";
          const hint = (name + " " + placeholder).toLowerCase();

          if (hint.includes("linkedin") || hint.includes("url") || hint.includes("website")) {
            await inp.fill(profile.linkedinUrl || "https://linkedin.com/in/applicant");
          } else if (hint.includes("hear") || hint.includes("source") || hint.includes("referral")) {
            await inp.fill("Online Job Board");
          } else if (hint.includes("salary") || hint.includes("compensation")) {
            await inp.fill("Negotiable");
          } else if (type === "number" || hint.includes("year")) {
            await inp.fill("5");
          } else {
            // Generic fill for unknown required fields
            await inp.fill("N/A");
          }
          console.log(`[Playwright] Greenhouse: Filled required field "${name || placeholder}" with default`);
        }
      } catch { /* skip */ }
    }
  } catch (e) {
    console.log("[Playwright] Greenhouse: Error in common fields:", e);
  }
}

/**
 * Fill any remaining empty required inputs and textareas.
 */
async function fillEmptyRequiredInputs(page: Page) {
  try {
    // Check for required checkboxes (like "I agree to terms")
    const checkboxes = page.locator('input[type="checkbox"][required], input[type="checkbox"][aria-required="true"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      try {
        const cb = checkboxes.nth(i);
        const checked = await cb.isChecked();
        if (!checked) {
          await cb.check();
          console.log(`[Playwright] Checked required checkbox ${i}`);
        }
      } catch { /* skip */ }
    }

    // Check for required radio buttons — select the first one in each group
    const radioGroups = await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"][required], input[type="radio"][aria-required="true"]');
      const groups = new Set<string>();
      radios.forEach(r => {
        const name = r.getAttribute("name");
        if (name) groups.add(name);
      });
      return Array.from(groups);
    });

    for (const groupName of radioGroups) {
      try {
        const firstRadio = page.locator(`input[type="radio"][name="${groupName}"]`).first();
        const checked = await page.locator(`input[type="radio"][name="${groupName}"]:checked`).count();
        if (checked === 0) {
          await firstRadio.check();
          console.log(`[Playwright] Selected first radio for group "${groupName}"`);
        }
      } catch { /* skip */ }
    }
  } catch (e) {
    console.log("[Playwright] Error filling empty required inputs:", e);
  }
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
    // Greenhouse-specific: label-based lookup
    'label:has-text("Location") + div input',
    'label:has-text("Location") ~ input',
  ];

  // Extract just the city name for autocomplete (e.g. "Houston" from "Houston, TX 77084")
  const cityOnly = location.split(",")[0]?.trim() || location;

  for (const sel of locationSelectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click();
        await humanDelay();
        await loc.fill("");
        await humanDelay();

        // Type slowly to trigger autocomplete — use just city name for better matches
        await loc.pressSequentially(cityOnly, { delay: 100 });
        console.log(`[Playwright] Location: typed "${cityOnly}", waiting for suggestions...`);

        // Wait a bit longer for autocomplete API to respond
        await stepDelay();
        await humanDelay();

        // Check for autocomplete suggestions and click the first one
        const suggestionSelectors = [
          '.pac-item',                              // Google Places autocomplete
          '.pac-container .pac-item',               // Google Places (nested)
          '[class*="autocomplete"] li',
          '[class*="suggestion"]',
          '[role="option"]',
          '[role="listbox"] [role="option"]',        // ARIA listbox pattern
          '[class*="dropdown"] li',
          '.location-autocomplete-results li',
          'ul[id*="location"] li',                   // ID-based dropdown
          '.pac-container div',                      // Google Places fallback
        ];
        let selected = false;
        for (const suggSel of suggestionSelectors) {
          try {
            const suggestion = page.locator(suggSel).first();
            if (await suggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
              await suggestion.click();
              await humanDelay();
              console.log(`[Playwright] Location: selected suggestion via ${suggSel}`);
              selected = true;
              break;
            }
          } catch { /* try next */ }
        }

        if (!selected) {
          // Fallback: use keyboard to select first autocomplete suggestion
          console.log("[Playwright] Location: no clickable suggestion found, trying keyboard selection");
          await loc.press("ArrowDown");
          await humanDelay();
          await loc.press("Enter");
          await humanDelay();

          // Check if the field now has a value (autocomplete may have filled it)
          const fieldValue = await loc.inputValue().catch(() => "");
          if (fieldValue && fieldValue.length > 0) {
            console.log(`[Playwright] Location: keyboard selection worked, value: "${fieldValue}"`);
            return true;
          }

          // Final fallback: just fill the full location string directly
          console.log("[Playwright] Location: keyboard selection didn't work, filling directly");
          await loc.fill(location);
          await humanDelay();
          // Try Tab to confirm and move focus away
          await loc.press("Tab");
          await humanDelay();
        }

        return true;
      }
    } catch { /* try next */ }
  }

  // Last resort: try to find location field by label text
  try {
    const labels = page.locator('label');
    const labelCount = await labels.count();
    for (let i = 0; i < labelCount; i++) {
      const labelText = await labels.nth(i).textContent().catch(() => "");
      if (labelText && /location|city/i.test(labelText)) {
        const forAttr = await labels.nth(i).getAttribute("for").catch(() => null);
        if (forAttr) {
          const input = page.locator(`#${CSS.escape(forAttr)}`).first();
          if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
            await input.click();
            await humanDelay();
            await input.pressSequentially(cityOnly, { delay: 100 });
            await stepDelay();
            await input.press("ArrowDown");
            await humanDelay();
            await input.press("Enter");
            await humanDelay();
            console.log(`[Playwright] Location: filled via label "${labelText}"`);
            return true;
          }
        }
      }
    }
  } catch { /* skip */ }

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
      // Also check URL for confirmation patterns
      const currentUrl = page.url().toLowerCase();
      const urlConfirmed = currentUrl.includes("thank") || currentUrl.includes("confirm") || currentUrl.includes("success") || currentUrl.includes("applied");
      // Check for validation errors that indicate form wasn't accepted
      const hasErrors = await page.locator('[class*="error"], [class*="invalid"], .field-error, .form-error, [role="alert"]').count().catch(() => 0);

      const isSuccess = (confirmed || urlConfirmed) && hasErrors === 0;
      return {
        success: isSuccess,
        platform: "lever",
        message: isSuccess
          ? "Application submitted and confirmed via Lever"
          : `Lever form submitted but not confirmed (errors: ${hasErrors}, confirmation: ${confirmed}, urlConfirmed: ${urlConfirmed})`,
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
    console.log("[Playwright] Handling Workday application (full 7-step flow)");

    // Increase page timeout for Workday's multi-step flow
    page.setDefaultTimeout(WORKDAY_TIMEOUT);

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
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
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

    // Step 3: Handle "Create Account" / "Sign In" / "Continue as Guest"
    // Use generated apply email for Workday account (if available), fallback to personal email
    const workdayEmail = profile.applyEmail || profile.email;
    const workdayPassword = profile.applyEmailPassword || WORKDAY_PASSWORD;
    console.log(`[Playwright] Workday: Handling account creation/sign-in with email: ${workdayEmail}`);
    await handleWorkdayAccountPage(page, workdayEmail, workdayPassword, profile);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
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

    // Now navigate through ALL Workday steps (up to 7)
    console.log("[Playwright] Workday: Starting multi-step form navigation");
    let stepsCompleted = 0;
    const maxSteps = 10; // safety limit (7 steps + buffer)

    for (let step = 0; step < maxSteps; step++) {
      await takeScreenshot(page, `workday-step${step + 1}`);

      // Detect which step we're on by page content
      const pageText = await page.textContent("body").catch(() => "") || "";
      const pageTextLower = pageText.toLowerCase();

      console.log(`[Playwright] Workday: Processing step ${step + 1}, page text snippet: "${pageTextLower.substring(0, 200)}..."`);

      // --- STEP: My Information ---
      if (pageTextLower.includes("my information") || pageTextLower.includes("personal information") || pageTextLower.includes("contact information")) {
        console.log("[Playwright] Workday: DETECTED 'My Information' step - filling fields");
        await fillWorkdayMyInformation(page, profile);
      }

      // --- STEP: My Experience (resume upload) ---
      if (pageTextLower.includes("my experience") || pageTextLower.includes("resume") || pageTextLower.includes("work history") || pageTextLower.includes("experience")) {
        console.log("[Playwright] Workday: DETECTED 'My Experience' step - uploading resume");
        await fillWorkdayMyExperience(page, profile);
      }

      // --- STEP: Application Questions ---
      if (pageTextLower.includes("application questions") || pageTextLower.includes("additional questions") || pageTextLower.includes("screening questions")) {
        console.log("[Playwright] Workday: DETECTED 'Application Questions' step - filling answers");
        await fillWorkdayApplicationQuestions(page);
      }

      // --- STEP: Voluntary Disclosures ---
      if (pageTextLower.includes("voluntary disclosures") || pageTextLower.includes("eeo") || pageTextLower.includes("equal employment")) {
        console.log("[Playwright] Workday: DETECTED 'Voluntary Disclosures' step - selecting decline options");
        await fillWorkdayVoluntaryDisclosures(page);
      }

      // --- STEP: Self Identify (disability/veteran) ---
      if (pageTextLower.includes("self identify") || pageTextLower.includes("disability") || pageTextLower.includes("veteran status")) {
        console.log("[Playwright] Workday: DETECTED 'Self Identify' step - selecting decline options");
        await fillWorkdaySelfIdentify(page);
      }

      // --- STEP: Review ---
      if (pageTextLower.includes("review") && (pageTextLower.includes("submit") || pageTextLower.includes("application"))) {
        console.log("[Playwright] Workday: DETECTED 'Review' step - checking agreements");
        await fillWorkdayReviewStep(page);
      }

      // Always try to fill any generic fields on the current step
      await fillWorkdayStepFields(page, profile);

      // Check if we've reached the Submit button
      const submitBtn = page.locator(
        'button[data-automation-id="bottom-navigation-next-button"]:has-text("Submit"), ' +
        'button:has-text("Submit Application"), ' +
        'button:has-text("Submit")'
      ).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Make sure it actually says "Submit" and not "Next"
        const btnText = await submitBtn.textContent().catch(() => "") || "";
        if (btnText.toLowerCase().includes("submit")) {
          console.log("[Playwright] Workday: Found Submit button - submitting");
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
      }

      // Try to click Save and Continue / Next / Continue buttons (in priority order)
      const nextSelectors = [
        'button:has-text("Save and Continue")',
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button[data-automation-id="bottom-navigation-next-button"]',
        'button.css-1476i2r', // Common Workday button class
      ];

      // Scroll down first to ensure button is visible
      await scrollToBottom(page);
      await humanDelay();

      let clickedNext = false;
      for (const sel of nextSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
            const btnText = await btn.textContent().catch(() => "") || "";
            // Skip if this is actually a "Submit" button (handled above)
            if (btnText.toLowerCase().includes("submit")) continue;
            await btn.click();
            clickedNext = true;
            stepsCompleted++;
            console.log(`[Playwright] Workday: Clicked "${btnText.trim()}" navigation button (step ${step + 1}) via: ${sel}`);
            // Wait 5 seconds for the next page to load
            console.log("[Playwright] Workday: Waiting 5s for next step to load");
            await page.waitForTimeout(5000);
            await takeScreenshot(page, `workday-after-step${step + 1}-nav`);
            break;
          }
        } catch { /* continue */ }
      }

      if (!clickedNext) {
        console.log("[Playwright] Workday: No Next/Submit button found on step " + (step + 1) + ", ending step loop");
        break;
      }
    }

    // If we got here, we went through steps but didn't find/click submit — NOT a success
    await takeScreenshot(page, "workday-final");
    return {
      success: false,
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
 * Priority: Continue as Guest > Create Account > Sign In
 */
async function handleWorkdayAccountPage(page: Page, email?: string, password?: string, profile?: ApplicantProfile) {
  const accountPassword = password || WORKDAY_PASSWORD;
  // First, try "Continue as Guest" options
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

  // Check if we're on the Create Account / Sign In page
  const pageText = await page.textContent("body").catch(() => "") || "";
  const pageTextLower = pageText.toLowerCase();
  const isAccountPage = pageTextLower.includes("create account") ||
    pageTextLower.includes("sign in") ||
    pageTextLower.includes("create your account") ||
    pageTextLower.includes("already have an account");

  if (!isAccountPage) {
    console.log("[Playwright] Workday: Not on account page, continuing");
    return;
  }

  console.log("[Playwright] Workday: On account creation/sign-in page");

  // Fill email field - try many approaches since Workday uses different selectors per site
  let emailFilled = false;
  const emailSelectors = [
    'input[data-automation-id="email"]',
    'input[data-automation-id="emailAddress"]',
    'input[data-automation-id="createAccount-email"]',
    'input[type="email"]',
    'input[aria-label*="Email"]',
    'input[aria-label*="email"]',
    'input[placeholder*="Email"]',
    'input[placeholder*="email"]',
    'input[name*="email"]',
    'input[name*="Email"]',
    'input[id*="email"]',
    'input[id*="Email"]',
  ];

  for (const sel of emailSelectors) {
    try {
      const input = page.locator(sel).first();
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[Playwright] Workday: Found email field with selector: ${sel}`);
        await input.click();
        await page.waitForTimeout(500);
        await input.clear();
        await page.waitForTimeout(300);
        await input.pressSequentially(email || "", { delay: 50 });
        await humanDelay();
        console.log(`[Playwright] Workday: Email filled with: ${email}`);
        emailFilled = true;
        break;
      }
    } catch { /* try next selector */ }
  }

  // Last resort: find input by label text "Email Address"
  if (!emailFilled) {
    try {
      console.log("[Playwright] Workday: Trying to find email by label text");
      const labels = page.locator('label:has-text("Email")');
      const count = await labels.count();
      for (let i = 0; i < count; i++) {
        const forAttr = await labels.nth(i).getAttribute("for");
        if (forAttr) {
          const field = page.locator(`#${forAttr}`);
          if (await field.isVisible().catch(() => false)) {
            await field.click();
            await page.waitForTimeout(500);
            await field.clear();
            await field.pressSequentially(email || "", { delay: 50 });
            console.log(`[Playwright] Workday: Email filled via label for="${forAttr}"`);
            emailFilled = true;
            break;
          }
        }
      }
    } catch {
      console.log("[Playwright] Workday: Label-based email search failed");
    }
  }

  // Ultra last resort: Use JavaScript to find the email input directly in the DOM
  if (!emailFilled) {
    try {
      console.log("[Playwright] Workday: Trying JS DOM search for email input");
      emailFilled = await page.evaluate((emailValue) => {
        // Strategy 1: Find input that follows a label containing "Email"
        const labels = document.querySelectorAll("label");
        for (const label of labels) {
          if (label.textContent && label.textContent.toLowerCase().includes("email")) {
            // Check for "for" attribute
            const forAttr = label.getAttribute("for");
            if (forAttr) {
              const input = document.getElementById(forAttr) as HTMLInputElement;
              if (input) {
                input.focus();
                input.value = emailValue;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
              }
            }
            // Check for sibling input
            const parent = label.parentElement;
            if (parent) {
              const input = parent.querySelector("input") as HTMLInputElement;
              if (input && input.type !== "password") {
                input.focus();
                input.value = emailValue;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
              }
            }
            // Check next sibling
            let next = label.nextElementSibling;
            while (next) {
              const input = next.tagName === "INPUT" ? next as HTMLInputElement : next.querySelector("input") as HTMLInputElement;
              if (input && input.type !== "password") {
                input.focus();
                input.value = emailValue;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
              }
              next = next.nextElementSibling;
            }
          }
        }

        // Strategy 2: Find the first input that is NOT a password field and is empty
        const allInputs = document.querySelectorAll("input");
        for (const input of allInputs) {
          const inp = input as HTMLInputElement;
          if (inp.type !== "password" && inp.type !== "hidden" && inp.type !== "checkbox" && inp.type !== "radio" && inp.type !== "file" && inp.type !== "submit") {
            if (!inp.value && inp.offsetParent !== null) { // visible and empty
              inp.focus();
              inp.value = emailValue;
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              return true;
            }
          }
        }
        return false;
      }, email || "").catch(() => false);

      if (emailFilled) {
        console.log("[Playwright] Workday: Email filled via JS DOM search");
        await page.waitForTimeout(1000);
      }
    } catch {
      console.log("[Playwright] Workday: JS DOM search failed");
    }
  }

  if (!emailFilled) {
    console.log("[Playwright] Workday: WARNING - Could not fill email field!");
    // Last absolute resort: use keyboard Tab to navigate to first field and type
    try {
      console.log("[Playwright] Workday: Trying Tab+Type approach");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(300);
      await page.keyboard.type(email || "", { delay: 50 });
      emailFilled = true;
      console.log("[Playwright] Workday: Email typed via Tab navigation");
    } catch {
      console.log("[Playwright] Workday: Tab+Type approach failed");
    }
  }

  // Wait 3 seconds for the page to react after email entry
  // Some Workday sites only show password fields after email is entered
  console.log("[Playwright] Workday: Waiting 3s for password fields to appear after email entry");
  await page.waitForTimeout(3000);

  // Explicitly wait for password input to appear in the DOM
  try {
    console.log("[Playwright] Workday: Waiting for password input[type=password] to appear (up to 10s)");
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    console.log("[Playwright] Workday: Password field detected in DOM");
  } catch {
    // Debug: check via JS how many password fields exist
    const jsCount = await page.evaluate(() => document.querySelectorAll('input[type="password"]').length).catch(() => 0);
    console.log(`[Playwright] Workday: waitForSelector timed out. JS querySelectorAll found ${jsCount} password fields`);
    // Also check for any inputs that might be password-like but not type=password yet
    const allInputCount = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      return Array.from(inputs).map(i => ({ type: i.type, id: i.id, automationId: i.getAttribute('data-automation-id'), name: i.name }));
    }).catch(() => []);
    console.log("[Playwright] Workday: All inputs on page:", JSON.stringify(allInputCount));
  }

  // Fill password fields
  try {
    // Try multiple approaches to find password fields
    let passwordInputs = page.locator('input[type="password"]');
    let passwordCount = await passwordInputs.count();
    console.log(`[Playwright] Workday: Found ${passwordCount} password field(s) via type=password`);

    if (passwordCount === 0) {
      // Try broader selectors
      passwordInputs = page.locator('input[data-automation-id="password"], input[data-automation-id="verifyPassword"], input[autocomplete="new-password"], input[autocomplete="current-password"]');
      passwordCount = await passwordInputs.count();
      console.log(`[Playwright] Workday: Found ${passwordCount} password field(s) via data-automation-id/autocomplete`);
    }

    if (passwordCount === 0) {
      // Last resort: find by label text
      console.log("[Playwright] Workday: Trying to find password fields by label");
      const pwLabel = page.locator('label:has-text("Password")');
      const pwLabelCount = await pwLabel.count();
      console.log(`[Playwright] Workday: Found ${pwLabelCount} labels with text 'Password'`);
      if (pwLabelCount > 0) {
        // Click the label area and try typing
        for (let i = 0; i < pwLabelCount; i++) {
          const forAttr = await pwLabel.nth(i).getAttribute("for");
          if (forAttr) {
            const field = page.locator(`#${forAttr}`);
            if (await field.count() > 0) {
              await field.click();
              await humanDelay();
              await field.clear();
              await field.pressSequentially(accountPassword, { delay: 50 });
              await humanDelay();
              console.log(`[Playwright] Workday: Filled password via label #${forAttr}`);
            }
          }
        }
      }
    }

    if (passwordCount >= 2) {
      // Create Account form: Password + Verify Password
      console.log("[Playwright] Workday: Clicking into first password field before typing");
      await passwordInputs.nth(0).click();
      await humanDelay();
      await passwordInputs.nth(0).clear();
      await passwordInputs.nth(0).pressSequentially(accountPassword, { delay: 30 });
      await humanDelay();
      console.log("[Playwright] Workday: First password field filled");

      console.log("[Playwright] Workday: Clicking into verify password field before typing");
      await passwordInputs.nth(1).click();
      await humanDelay();
      await passwordInputs.nth(1).clear();
      await passwordInputs.nth(1).pressSequentially(accountPassword, { delay: 30 });
      await humanDelay();
      console.log("[Playwright] Workday: Filled both password fields for account creation");
    } else if (passwordCount === 1) {
      // Sign In form: just one password
      console.log("[Playwright] Workday: Clicking into password field before typing");
      await passwordInputs.nth(0).click();
      await humanDelay();
      await passwordInputs.nth(0).clear();
      await passwordInputs.nth(0).pressSequentially(accountPassword, { delay: 30 });
      await humanDelay();
      console.log("[Playwright] Workday: Filled password field for sign-in");
    } else {
      console.log("[Playwright] Workday: WARNING - No password fields found at all!");
    }
  } catch (err) {
    console.log("[Playwright] Workday: Could not fill password fields:", err instanceof Error ? err.message : String(err));
  }

  // Check any required checkboxes (terms/conditions on account creation)
  try {
    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      const isChecked = await checkboxes.nth(i).isChecked().catch(() => true);
      if (!isChecked) {
        await checkboxes.nth(i).check().catch(() => {});
        await humanDelay();
      }
    }
  } catch { /* non-critical */ }

  await takeScreenshot(page, "workday-account-filled");

  // Scroll down to make Create Account button visible
  await scrollToBottom(page);
  await page.waitForTimeout(1000);

  // Also check terms/conditions checkboxes before clicking Create Account
  try {
    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = checkboxes.nth(i);
      if (!(await cb.isChecked().catch(() => false))) {
        await cb.check().catch(() => {});
        console.log(`[Playwright] Workday: Checked checkbox ${i}`);
      }
    }
  } catch { /* non-critical */ }

  // Explicitly click "Create Account" button
  const createAccountSelectors = [
    'button[data-automation-id="createAccountSubmitButton"]',
    'button:has-text("Create Account")',
    'button:has-text("create account")',
    'input[type="submit"][value*="Create"]',
    'a:has-text("Create Account")',
    'div[role="button"]:has-text("Create Account")',
    // Also try generic submit
    'button[type="submit"]',
  ];

  let clickedAccountBtn = false;

  // First try CSS selectors
  for (const sel of createAccountSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[Playwright] Workday: Clicking Create Account: ${sel}`);
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(500);
        await btn.click();
        clickedAccountBtn = true;
        break;
      }
    } catch { /* continue */ }
  }

  // Fallback: Use JavaScript to find and click any button with "Create Account" or "Sign In" text
  if (!clickedAccountBtn) {
    console.log("[Playwright] Workday: CSS selectors failed, trying JS click");
    clickedAccountBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || (btn as HTMLInputElement).value || "").toLowerCase();
        if (text.includes("create account") || text.includes("sign in") || text.includes("submit")) {
          (btn as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
          (btn as HTMLElement).click();
          return true;
        }
      }
      return false;
    }).catch(() => false);
    if (clickedAccountBtn) {
      console.log("[Playwright] Workday: Clicked via JS evaluation");
    }
  }

  // Ultra fallback: press Enter key which should submit the form
  if (!clickedAccountBtn) {
    console.log("[Playwright] Workday: Trying Enter key to submit");
    await page.keyboard.press("Enter");
    clickedAccountBtn = true;
  }

  if (clickedAccountBtn) {
    console.log("[Playwright] Workday: Create Account clicked, waiting 8s for next page");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(8000);
    await takeScreenshot(page, "workday-after-create-account");

    // Check if Workday is asking for an email verification code
    await handleWorkdayVerificationCode(page, profile);
  }

  // If Create Account failed or wasn't found, try Sign In
  if (!clickedAccountBtn) {
    const signInSelectors = [
      'button[data-automation-id="signInSubmitButton"]',
      'button:has-text("Sign In")',
      'button:has-text("Sign in")',
      'button:has-text("Log In")',
      'input[type="submit"][value*="Sign"]',
    ];
    for (const sel of signInSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log(`[Playwright] Workday: Clicking Sign In: ${sel}`);
          await btn.click();
          clickedAccountBtn = true;
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }
  }

  // If we clicked Create Account but got an error (account already exists), try Sign In
  if (clickedAccountBtn) {
    const errorText = await page.textContent("body").catch(() => "") || "";
    const errorLower = errorText.toLowerCase();
    if (errorLower.includes("already exists") || errorLower.includes("account already") || errorLower.includes("already registered")) {
      console.log("[Playwright] Workday: Account already exists, trying Sign In");

      // Look for "Sign In" tab or link
      const signInLink = page.locator('a:has-text("Sign In"), button:has-text("Sign In"), [data-automation-id="signInLink"]').first();
      if (await signInLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await signInLink.click();
        await stepDelay();

        // Re-fill email and password for sign-in
        try {
          const emailInput = page.locator('input[data-automation-id="email"], input[type="email"]').first();
          if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await emailInput.clear();
            await emailInput.fill(email || "");
            await humanDelay();
          }
        } catch { /* non-critical */ }

        try {
          const pwInput = page.locator('input[data-automation-id="password"], input[type="password"]').first();
          if (await pwInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await pwInput.clear();
            await pwInput.fill(accountPassword);
            await humanDelay();
          }
        } catch { /* non-critical */ }

        // Click Sign In
        const signInBtn = page.locator('button:has-text("Sign In"), button[data-automation-id="signInSubmitButton"]').first();
        if (await signInBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await signInBtn.click();
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await stepDelay();
        }
      }
    }
  }

  // If still nothing worked, try a generic continue/next button
  if (!clickedAccountBtn) {
    const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next"), button[type="submit"]').first();
    if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueBtn.click();
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await stepDelay();
    }
  }

  await takeScreenshot(page, "workday-account-complete");
}

/**
 * Handle Workday's email verification code step.
 * After creating an account, Workday sometimes sends a verification code email.
 * This function detects the verification prompt and fetches the code via IMAP
 * from the user's generated apply email.
 */
async function handleWorkdayVerificationCode(page: Page, profile?: ApplicantProfile) {
  const pageText = await page.textContent("body").catch(() => "") || "";
  const pageTextLower = pageText.toLowerCase();

  // Check if the page is asking for a verification code
  const isVerificationPage =
    pageTextLower.includes("verification code") ||
    pageTextLower.includes("verify your email") ||
    pageTextLower.includes("enter the code") ||
    pageTextLower.includes("we sent a code") ||
    pageTextLower.includes("check your email") ||
    pageTextLower.includes("enter code");

  if (!isVerificationPage) {
    console.log("[Playwright] Workday: No verification code step detected");
    return;
  }

  console.log("[Playwright] Workday: VERIFICATION CODE step detected!");
  await takeScreenshot(page, "workday-verification-code-prompt");

  // Need apply email credentials to fetch verification code via IMAP
  if (!profile?.applyEmail || !profile?.applyEmailPassword) {
    console.log("[Playwright] Workday: No apply email credentials — cannot fetch verification code");
    return;
  }

  console.log(`[Playwright] Workday: Fetching verification code from ${profile.applyEmail} via IMAP...`);

  try {
    // Dynamic import to avoid loading IMAP module when not needed
    const { fetchVerificationCode } = await import("@/lib/email/imap-client");
    const code = await fetchVerificationCode(profile.applyEmail, profile.applyEmailPassword, 90);

    if (code) {
      console.log(`[Playwright] Workday: Got verification code: ${code}`);

      // Find the verification code input field
      const codeSelectors = [
        'input[data-automation-id="verificationCode"]',
        'input[data-automation-id="code"]',
        'input[type="text"][maxlength="6"]',
        'input[type="number"]',
        'input[placeholder*="code"]',
        'input[placeholder*="Code"]',
        'input[aria-label*="code"]',
        'input[aria-label*="Code"]',
      ];

      for (const sel of codeSelectors) {
        try {
          const input = page.locator(sel).first();
          if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
            await input.click();
            await input.clear();
            await input.pressSequentially(code, { delay: 100 });
            console.log(`[Playwright] Workday: Entered verification code via: ${sel}`);

            // Click Verify/Submit button
            const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Submit"), button:has-text("Continue")').first();
            if (await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await verifyBtn.click();
              await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
              await stepDelay();
              console.log("[Playwright] Workday: Verification code submitted");
            }
            break;
          }
        } catch { /* try next selector */ }
      }
    } else {
      console.log("[Playwright] Workday: No verification code found via IMAP after 90s");
    }
  } catch (err) {
    console.log("[Playwright] Workday: Could not fetch verification code:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Fill the "My Information" step fields.
 */
async function fillWorkdayMyInformation(page: Page, profile: ApplicantProfile) {
  console.log(`[Playwright] Workday MyInfo: Filling with firstName="${profile.firstName}", lastName="${profile.lastName}", email="${profile.email}", phone="${profile.phone}", location="${profile.location}"`);

  // First name
  const firstNameFilled = await tryTypeMultiple(page, [
    'input[data-automation-id="legalNameSection_firstName"]',
    'input[data-automation-id="firstName"]',
    'input[aria-label*="First Name"]',
    'input[placeholder*="First Name"]',
  ], profile.firstName);
  console.log(`[Playwright] Workday MyInfo: First name filled: ${firstNameFilled}`);
  await humanDelay();

  // Last name
  const lastNameFilled = await tryTypeMultiple(page, [
    'input[data-automation-id="legalNameSection_lastName"]',
    'input[data-automation-id="lastName"]',
    'input[aria-label*="Last Name"]',
    'input[placeholder*="Last Name"]',
  ], profile.lastName);
  console.log(`[Playwright] Workday MyInfo: Last name filled: ${lastNameFilled}`);
  await humanDelay();

  // Email (may already be filled from account creation)
  const emailFilled = await tryTypeMultiple(page, [
    'input[data-automation-id="email"]',
    'input[data-automation-id="emailAddress"]',
    'input[type="email"]',
    'input[aria-label*="Email"]',
  ], profile.email);
  console.log(`[Playwright] Workday MyInfo: Email filled: ${emailFilled}`);
  await humanDelay();

  // Phone
  if (profile.phone) {
    // Try the phone device type dropdown first (set to "Mobile")
    try {
      const phoneTypeSelect = page.locator('select[data-automation-id*="phone"], select[aria-label*="Phone Device Type"]').first();
      if (await phoneTypeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await phoneTypeSelect.selectOption({ label: "Mobile" }).catch(() => {});
        await humanDelay();
      }
    } catch { /* non-critical */ }

    // Strip phone to digits only - Workday requires numbers only (e.g. 3124874824)
    const phoneDigits = (profile.phone || "").replace(/\D/g, "");
    console.log(`[Playwright] Workday: Phone "${profile.phone}" => digits "${phoneDigits}"`);
    const phoneFilled = await tryTypeMultiple(page, [
      'input[data-automation-id="phone-number"]',
      'input[data-automation-id="phone"]',
      'input[data-automation-id*="phoneNumber"]',
      'input[type="tel"]',
      'input[aria-label*="Phone Number"]',
      'input[aria-label*="Phone"]',
      'input[placeholder*="Phone"]',
      'input[name*="phone"]',
    ], phoneDigits);
    console.log(`[Playwright] Workday MyInfo: Phone filled: ${phoneFilled}`);
    await humanDelay();
  }

  // Address fields
  if (profile.location) {
    // Parse location "Houston, TX 77084" into city="Houston", state="TX", zip="77084"
    const locationParts = profile.location.split(",").map((s) => s.trim());
    const city = locationParts[0] || profile.location;
    const stateZip = locationParts[1] || "";
    const stateZipParts = stateZip.trim().split(/\s+/);
    const state = stateZipParts[0] || "";
    const zip = stateZipParts[1] || "";

    console.log(`[Playwright] Workday: Parsed location "${profile.location}" => city="${city}", state="${state}", zip="${zip}"`);

    // Country dropdown FIRST (try to set "United States" before filling address)
    // Workday often requires country before showing state dropdown options
    console.log("[Playwright] Workday: Setting country to United States");
    try {
      const countryInput = page.locator(
        'input[data-automation-id="addressSection_country"], ' +
        'input[data-automation-id="country"], ' +
        'input[aria-label*="Country"]'
      ).first();
      if (await countryInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await countryInput.click();
        await humanDelay();
        await countryInput.clear();
        await countryInput.fill("United States");
        await humanDelay();
        const option = page.locator('[data-automation-id="promptOption"], [role="option"]').first();
        if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
          await option.click();
          await humanDelay();
          console.log("[Playwright] Workday: Country set to United States");
        }
      } else {
        // Try select dropdown for country
        const countrySelect = page.locator('select[data-automation-id*="country"], select[aria-label*="Country"]').first();
        if (await countrySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          for (const val of ["US", "USA", "United States", "United States of America"]) {
            try {
              await countrySelect.selectOption({ label: val });
              console.log(`[Playwright] Workday: Country selected via dropdown: ${val}`);
              await humanDelay();
              break;
            } catch { /* try next */ }
          }
        }
      }
    } catch { /* non-critical */ }
    await page.waitForTimeout(1000); // Wait for state dropdown to populate after country selection

    // Address line 1
    const addressFilled = await tryTypeMultiple(page, [
      'input[data-automation-id="addressSection_addressLine1"]',
      'input[data-automation-id="addressLine1"]',
      'input[aria-label*="Address Line 1"]',
    ], profile.location);
    console.log(`[Playwright] Workday: Address Line 1 filled: ${addressFilled}`);
    await humanDelay();

    // City
    const cityFilled = await tryTypeMultiple(page, [
      'input[data-automation-id="addressSection_city"]',
      'input[data-automation-id="city"]',
      'input[aria-label="City"]',
      'input[aria-label*="City"]',
      'input[placeholder*="City"]',
    ], city);
    console.log(`[Playwright] Workday: City filled with "${city}": ${cityFilled}`);
    await humanDelay();

    // State/Region - try multiple approaches
    if (state) {
      console.log(`[Playwright] Workday: Attempting to fill state with "${state}"`);
      let stateFilled = false;

      // Approach 1: Workday searchable dropdown input
      try {
        const stateInput = page.locator(
          'input[data-automation-id="addressSection_countryRegion"], ' +
          'input[data-automation-id="state"], ' +
          'input[aria-label*="State"], ' +
          'input[aria-label*="Region"]'
        ).first();
        if (await stateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await stateInput.click();
          await humanDelay();
          await stateInput.clear();
          await stateInput.fill(state);
          await humanDelay();
          // Click first dropdown option if it appears
          const option = page.locator('[data-automation-id="promptOption"], [role="option"]').first();
          if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
            await option.click();
            await humanDelay();
            stateFilled = true;
            console.log(`[Playwright] Workday: State filled via searchable dropdown: ${state}`);
          }
        }
      } catch { /* try next approach */ }

      // Approach 2: Native select dropdown
      if (!stateFilled) {
        try {
          const stateSelect = page.locator(
            'select[data-automation-id="addressSection_countryRegion"], ' +
            'select[data-automation-id*="state"], ' +
            'select[aria-label*="State"]'
          ).first();
          if (await stateSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Try to match by value or label
            for (const val of [state, state.toUpperCase()]) {
              try {
                await stateSelect.selectOption({ value: val });
                stateFilled = true;
                console.log(`[Playwright] Workday: State selected via native select (value): ${val}`);
                break;
              } catch { /* try next */ }
            }
            if (!stateFilled) {
              // Try by label text containing the state abbreviation
              const options = stateSelect.locator("option");
              const optCount = await options.count();
              for (let j = 0; j < optCount; j++) {
                const text = (await options.nth(j).textContent().catch(() => "")) || "";
                if (text.includes(state) || text.toUpperCase().includes(state.toUpperCase())) {
                  await stateSelect.selectOption({ index: j });
                  stateFilled = true;
                  console.log(`[Playwright] Workday: State selected via native select (text match): ${text}`);
                  break;
                }
              }
            }
            await humanDelay();
          }
        } catch { /* try next approach */ }
      }

      // Approach 3: Click the dropdown button/area and select by text
      if (!stateFilled) {
        try {
          const stateDropdown = page.locator(
            'button[data-automation-id*="countryRegion"], ' +
            'button[aria-label*="State"], ' +
            '[data-automation-id="addressSection_countryRegion"]'
          ).first();
          if (await stateDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
            await stateDropdown.click();
            await humanDelay();
            // Type the state to filter options
            await page.keyboard.type(state);
            await humanDelay();
            const option = page.locator('[data-automation-id="promptOption"], [role="option"]').first();
            if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
              await option.click();
              stateFilled = true;
              console.log(`[Playwright] Workday: State selected via dropdown click+type: ${state}`);
            }
            await humanDelay();
          }
        } catch { /* non-critical */ }
      }

      if (!stateFilled) {
        console.log(`[Playwright] Workday: WARNING - Could not fill state field with "${state}"`);
      }
    }

    // Zip/Postal code
    if (zip) {
      const zipFilled = await tryTypeMultiple(page, [
        'input[data-automation-id="addressSection_postalCode"]',
        'input[data-automation-id="postalCode"]',
        'input[aria-label*="Postal Code"]',
        'input[aria-label*="Postal"]',
        'input[aria-label*="Zip"]',
        'input[placeholder*="Postal"]',
        'input[placeholder*="Zip"]',
      ], zip);
      console.log(`[Playwright] Workday: Postal Code filled with "${zip}": ${zipFilled}`);
      await humanDelay();
    }
  }

  // Scroll down to reveal any hidden fields or the Save and Continue button
  await scrollToBottom(page);
  await humanDelay();

  await takeScreenshot(page, "workday-my-information");

  // Click "Save and Continue" after filling My Information
  console.log("[Playwright] Workday: Looking for Save and Continue button after My Information");
  const saveAndContinueSelectors = [
    'button:has-text("Save and Continue")',
    'button:has-text("Next")',
    'button:has-text("Continue")',
    'button[data-automation-id="bottom-navigation-next-button"]',
  ];
  for (const sel of saveAndContinueSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[Playwright] Workday: Clicking navigation button from My Information: ${sel}`);
        await btn.click();
        await page.waitForTimeout(5000); // Wait 5 seconds for next page to load
        await takeScreenshot(page, "workday-after-my-information-nav");
        break;
      }
    } catch { /* continue */ }
  }
}

/**
 * Fill the "My Experience" step (resume upload + work history).
 */
async function fillWorkdayMyExperience(page: Page, profile: ApplicantProfile) {
  if (profile.resumePath) {
    console.log("[Playwright] Workday: Uploading resume in My Experience step");
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
      await uploadResume(page, profile.resumePath);
    }
  }

  // Wait for resume to process (Workday sometimes parses the resume)
  await stepDelay();
  await takeScreenshot(page, "workday-my-experience");
}

/**
 * Fill the "Application Questions" step with reasonable defaults.
 */
async function fillWorkdayApplicationQuestions(page: Page) {
  // Handle radio buttons: try to select "Yes" for positive questions, "No" for disqualifying ones
  try {
    const radioGroups = page.locator('[data-automation-id*="radio"], fieldset, [role="radiogroup"]');
    const groupCount = await radioGroups.count();
    for (let i = 0; i < groupCount; i++) {
      const group = radioGroups.nth(i);
      // Try to click "Yes" first, fallback to first option
      const yesOption = group.locator('label:has-text("Yes"), input[value="Yes"], input[value="yes"]').first();
      if (await yesOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await yesOption.click().catch(() => {});
        await humanDelay();
      } else {
        // Click first radio button in the group
        const firstRadio = group.locator('input[type="radio"]').first();
        if (await firstRadio.isVisible({ timeout: 1000 }).catch(() => false)) {
          await firstRadio.click().catch(() => {});
          await humanDelay();
        }
      }
    }
  } catch { /* non-critical */ }

  // Handle dropdowns/selects: select first non-empty option
  try {
    const selects = page.locator('select[data-automation-id], select[required], select[aria-required="true"]');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      try {
        const options = select.locator("option");
        const optCount = await options.count();
        // Pick the first non-empty, non-placeholder option
        for (let j = 1; j < optCount; j++) {
          const val = await options.nth(j).getAttribute("value").catch(() => "");
          if (val) {
            await select.selectOption({ index: j });
            await humanDelay();
            break;
          }
        }
      } catch { /* skip this select */ }
    }
  } catch { /* non-critical */ }

  // Handle Workday searchable dropdowns (prompts)
  try {
    const promptButtons = page.locator('button[data-automation-id*="promptSearchButton"], button[aria-label*="Search"]');
    const promptCount = await promptButtons.count();
    for (let i = 0; i < promptCount; i++) {
      try {
        const btn = promptButtons.nth(i);
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await humanDelay();
          // Click first option in the dropdown
          const option = page.locator('[data-automation-id="promptOption"], [role="option"]').first();
          if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
            await option.click();
            await humanDelay();
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* non-critical */ }

  // Handle text inputs: fill with "N/A" if empty and required
  // But NEVER fill phone/tel fields with "N/A" - those need real numbers
  try {
    const textInputs = page.locator(
      'input[type="text"][required], input[type="text"][aria-required="true"], ' +
      'textarea[required], textarea[aria-required="true"]'
    );
    const inputCount = await textInputs.count();
    for (let i = 0; i < inputCount; i++) {
      try {
        const input = textInputs.nth(i);
        const currentVal = await input.inputValue().catch(() => "");
        if (!currentVal) {
          // Check if this is a phone field - don't fill with N/A
          const automationId = await input.getAttribute("data-automation-id").catch(() => "") || "";
          const ariaLabel = await input.getAttribute("aria-label").catch(() => "") || "";
          const name = await input.getAttribute("name").catch(() => "") || "";
          const placeholder = await input.getAttribute("placeholder").catch(() => "") || "";
          const fieldInfo = (automationId + ariaLabel + name + placeholder).toLowerCase();
          if (fieldInfo.includes("phone") || fieldInfo.includes("tel") || fieldInfo.includes("mobile")) {
            console.log(`[Playwright] Skipping N/A fill for phone field: ${automationId || ariaLabel || name}`);
            continue;
          }
          await input.fill("N/A");
          await humanDelay();
        }
      } catch { /* skip */ }
    }
  } catch { /* non-critical */ }

  // Handle number inputs (e.g., years of experience): fill with "1"
  try {
    const numInputs = page.locator('input[type="number"][required], input[type="number"][aria-required="true"]');
    const numCount = await numInputs.count();
    for (let i = 0; i < numCount; i++) {
      try {
        const input = numInputs.nth(i);
        const currentVal = await input.inputValue().catch(() => "");
        if (!currentVal) {
          await input.fill("1");
          await humanDelay();
        }
      } catch { /* skip */ }
    }
  } catch { /* non-critical */ }

  await takeScreenshot(page, "workday-application-questions");
}

/**
 * Fill the "Voluntary Disclosures" step (EEO info).
 * Select "I do not wish to answer" for all demographic questions.
 */
async function fillWorkdayVoluntaryDisclosures(page: Page) {
  // Look for "I do not wish to answer" / "I don't wish to answer" / "Decline to answer" options
  const declineLabels = [
    "I do not wish to answer",
    "I don't wish to answer",
    "Decline to Self-Identify",
    "Decline to answer",
    "Prefer not to say",
    "I choose not to disclose",
    "Choose not to disclose",
    "I Do Not Wish to Disclose",
  ];

  for (const label of declineLabels) {
    try {
      const options = page.locator(`label:has-text("${label}"), input[value*="${label}"]`);
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        try {
          await options.nth(i).click();
          await humanDelay();
        } catch { /* skip */ }
      }
    } catch { /* non-critical */ }
  }

  // Handle select dropdowns - select "I do not wish to answer" or similar
  try {
    const selects = page.locator("select");
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      try {
        const options = select.locator("option");
        const optCount = await options.count();
        let selectedDecline = false;
        for (let j = 0; j < optCount; j++) {
          const text = (await options.nth(j).textContent().catch(() => "")) || "";
          const textLower = text.toLowerCase();
          if (textLower.includes("do not wish") || textLower.includes("decline") || textLower.includes("prefer not") || textLower.includes("choose not")) {
            await select.selectOption({ index: j });
            selectedDecline = true;
            await humanDelay();
            break;
          }
        }
        // If no "decline" option, select the last option (often "I do not wish to answer")
        if (!selectedDecline && optCount > 1) {
          await select.selectOption({ index: optCount - 1 }).catch(() => {});
          await humanDelay();
        }
      } catch { /* skip this select */ }
    }
  } catch { /* non-critical */ }

  // Handle Workday searchable prompts for EEO
  try {
    const promptButtons = page.locator('button[data-automation-id*="promptSearchButton"]');
    const promptCount = await promptButtons.count();
    for (let i = 0; i < promptCount; i++) {
      try {
        const btn = promptButtons.nth(i);
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await humanDelay();
          // Look for decline option
          const declineOption = page.locator('[data-automation-id="promptOption"]:has-text("do not wish"), [data-automation-id="promptOption"]:has-text("Decline"), [role="option"]:has-text("do not wish"), [role="option"]:has-text("Decline")').first();
          if (await declineOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await declineOption.click();
          } else {
            // Click first option as fallback
            const firstOption = page.locator('[data-automation-id="promptOption"], [role="option"]').first();
            if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
              await firstOption.click();
            }
          }
          await humanDelay();
        }
      } catch { /* skip */ }
    }
  } catch { /* non-critical */ }

  await takeScreenshot(page, "workday-voluntary-disclosures");
}

/**
 * Fill the "Self Identify" step (disability/veteran status).
 * Select "I do not wish to answer" or "No".
 */
async function fillWorkdaySelfIdentify(page: Page) {
  // Same approach as voluntary disclosures
  const declineLabels = [
    "I do not wish to answer",
    "I don't wish to answer",
    "I DO NOT WISH TO ANSWER",
    "No, I Don't Have a Disability",
    "No, I don't have a disability",
    "I am not a veteran",
    "I am NOT a protected veteran",
    "I am not a protected veteran",
    "Decline to Self-Identify",
    "Prefer not to answer",
    "No",
  ];

  for (const label of declineLabels) {
    try {
      const options = page.locator(`label:has-text("${label}")`);
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        try {
          const option = options.nth(i);
          if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
            await option.click();
            await humanDelay();
          }
        } catch { /* skip */ }
      }
    } catch { /* non-critical */ }
  }

  // Handle radio buttons
  try {
    const radioGroups = page.locator('fieldset, [role="radiogroup"], [data-automation-id*="radio"]');
    const groupCount = await radioGroups.count();
    for (let i = 0; i < groupCount; i++) {
      const group = radioGroups.nth(i);
      // Look for "No" or "I do not wish to answer" in the group
      let clicked = false;
      for (const label of ["I do not wish to answer", "I don't wish to answer", "No"]) {
        const option = group.locator(`label:has-text("${label}"), input[value="${label}"]`).first();
        if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
          await option.click().catch(() => {});
          clicked = true;
          await humanDelay();
          break;
        }
      }
      if (!clicked) {
        // Select last radio option as fallback (often "decline")
        const radios = group.locator('input[type="radio"]');
        const radioCount = await radios.count();
        if (radioCount > 0) {
          await radios.nth(radioCount - 1).click().catch(() => {});
          await humanDelay();
        }
      }
    }
  } catch { /* non-critical */ }

  // Handle select dropdowns
  try {
    const selects = page.locator("select");
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      try {
        const options = select.locator("option");
        const optCount = await options.count();
        for (let j = 0; j < optCount; j++) {
          const text = (await options.nth(j).textContent().catch(() => "")) || "";
          const textLower = text.toLowerCase();
          if (textLower.includes("do not wish") || textLower.includes("decline") || textLower.includes("no,") || textLower.includes("prefer not")) {
            await select.selectOption({ index: j });
            await humanDelay();
            break;
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* non-critical */ }

  await takeScreenshot(page, "workday-self-identify");
}

/**
 * Handle the "Review" step: check required checkboxes and prepare for submit.
 */
async function fillWorkdayReviewStep(page: Page) {
  // Check any required checkboxes (terms and conditions)
  try {
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      const isChecked = await checkboxes.nth(i).isChecked().catch(() => true);
      if (!isChecked) {
        await checkboxes.nth(i).check().catch(() => {});
        await humanDelay();
        console.log(`[Playwright] Workday: Checked review checkbox ${i + 1}`);
      }
    }
  } catch { /* non-critical */ }

  // Also check any checkboxes via labels
  try {
    const agreeLabels = page.locator(
      'label:has-text("I agree"), label:has-text("I certify"), label:has-text("I acknowledge"), label:has-text("I confirm")'
    );
    const labelCount = await agreeLabels.count();
    for (let i = 0; i < labelCount; i++) {
      await agreeLabels.nth(i).click().catch(() => {});
      await humanDelay();
    }
  } catch { /* non-critical */ }

  await takeScreenshot(page, "workday-review");
}

/**
 * Fill any visible form fields in a Workday step (generic fallback).
 * Used when navigating through multi-step forms for fields not covered by specific handlers.
 */
async function fillWorkdayStepFields(page: Page, profile: ApplicantProfile) {
  // Source/referral question
  try {
    const sourceSelect = page.locator('select[data-automation-id*="source"], select[aria-label*="How did you hear"]').first();
    if (await sourceSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
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

  // Fill any empty required text fields with "N/A"
  try {
    const reqInputs = page.locator('input[type="text"][required]:not([data-automation-id*="name"]):not([data-automation-id*="email"]):not([data-automation-id*="phone"])');
    const reqCount = await reqInputs.count();
    for (let i = 0; i < reqCount; i++) {
      const input = reqInputs.nth(i);
      const val = await input.inputValue().catch(() => "");
      if (!val) {
        await input.fill("N/A").catch(() => {});
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
      const currentUrl = page.url().toLowerCase();
      const urlConfirmed = currentUrl.includes("thank") || currentUrl.includes("confirm") || currentUrl.includes("success");
      const hasErrors = await page.locator('[class*="error"], [class*="invalid"], .field-error, .form-error, [role="alert"]').count().catch(() => 0);
      const isSuccess = (confirmed || urlConfirmed) && hasErrors === 0;
      return {
        success: isSuccess,
        platform: "smartrecruiters",
        message: isSuccess
          ? "Application submitted and confirmed via SmartRecruiters"
          : `SmartRecruiters form submitted but not confirmed (errors: ${hasErrors})`,
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

    // iCIMS has a specific "Apply for this job online" button that must be clicked first
    const applyBtnSelectors = [
      'a:has-text("Apply for this job online")',
      'button:has-text("Apply for this job online")',
      'a.iCIMS_ApplyButton',
      'a.iCIMS_PrimaryButton',
      '.iCIMS_ApplyButton',
      'a:has-text("Apply Now")',
      'a:has-text("Apply Online")',
      'a:has-text("Apply")',
      'button:has-text("Apply Now")',
      'button:has-text("Apply")',
    ];
    let clickedApply = false;
    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log(`[Playwright] iCIMS: Clicking apply button: ${sel}`);
          await btn.click();
          clickedApply = true;
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
          await stepDelay();
          break;
        }
      } catch { /* continue */ }
    }

    if (!clickedApply) {
      console.log("[Playwright] iCIMS: No apply button found, checking iframes");
      // Also check within iframes for the apply button
      const frames = page.frames();
      for (const frame of frames) {
        try {
          for (const sel of applyBtnSelectors) {
            const btn = frame.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
              console.log(`[Playwright] iCIMS: Clicking apply button in iframe: ${sel}`);
              await btn.click();
              clickedApply = true;
              await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
              await stepDelay();
              break;
            }
          }
          if (clickedApply) break;
        } catch { /* continue */ }
      }
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
      const currentUrl = page.url().toLowerCase();
      const urlConfirmed = currentUrl.includes("thank") || currentUrl.includes("confirm") || currentUrl.includes("success");
      const hasErrors = await page.locator('[class*="error"], [class*="invalid"], .field-error, .form-error, [role="alert"]').count().catch(() => 0);
      const isSuccess = (confirmed || urlConfirmed) && hasErrors === 0;
      return {
        success: isSuccess,
        platform: "icims",
        message: isSuccess
          ? "Application submitted and confirmed via iCIMS"
          : `iCIMS form submitted but not confirmed (errors: ${hasErrors})`,
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

      // Check for validation errors after submit
      const pageText = await page.textContent("body").catch(() => "") || "";
      const hasErrors = /required|error|invalid|please fill|missing|incomplete/i.test(pageText) &&
        !confirmed;

      if (hasErrors && !confirmed) {
        return {
          success: false,
          platform: "generic",
          message: "Form submitted but validation errors detected - application likely not completed",
        };
      }

      return {
        success: confirmed,
        platform: "generic",
        message: confirmed
          ? "Application submitted and confirmed (generic form)"
          : "Form submitted but no confirmation detected - application may not have been completed",
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
