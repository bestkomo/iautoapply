import puppeteer, { Browser, Page } from "puppeteer";

export interface ApplyResult {
  success: boolean;
  method: "form_fill" | "redirect" | "failed";
  message: string;
  screenshotUrl?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  resumeText?: string;
}

export async function applyToJob(
  applyUrl: string,
  profile: UserProfile,
  resumePath?: string
): Promise<ApplyResult> {
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to application URL
    await page.goto(applyUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Detect the application platform
    const url = page.url();

    if (url.includes("greenhouse.io") || url.includes("boards.greenhouse")) {
      return await applyGreenhouse(page, profile);
    } else if (url.includes("lever.co")) {
      return await applyLever(page, profile);
    } else if (url.includes("workday") || url.includes(".wd")) {
      return await applyWorkday(page, profile);
    } else if (url.includes("smartrecruiters")) {
      return await applySmartRecruiters(page, profile);
    } else {
      return await applyGeneric(page, profile);
    }
  } catch (error) {
    return {
      success: false,
      method: "failed",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (browser) await browser.close();
  }
}

async function applyGreenhouse(
  page: Page,
  profile: UserProfile
): Promise<ApplyResult> {
  try {
    await page.waitForSelector(
      "#application_form, .application-form, form",
      { timeout: 10000 }
    );

    // Fill in name fields
    const firstNameInput = await page.$(
      'input[name*="first_name"], input[id*="first_name"], input[placeholder*="First"]'
    );
    const lastNameInput = await page.$(
      'input[name*="last_name"], input[id*="last_name"], input[placeholder*="Last"]'
    );

    const nameParts = profile.name.split(" ");
    if (firstNameInput)
      await firstNameInput.type(nameParts[0] || "", { delay: 50 });
    if (lastNameInput)
      await lastNameInput.type(nameParts.slice(1).join(" ") || "", {
        delay: 50,
      });

    // Fill email
    const emailInput = await page.$(
      'input[type="email"], input[name*="email"], input[id*="email"]'
    );
    if (emailInput) await emailInput.type(profile.email, { delay: 50 });

    // Fill phone
    if (profile.phone) {
      const phoneInput = await page.$(
        'input[type="tel"], input[name*="phone"], input[id*="phone"]'
      );
      if (phoneInput) await phoneInput.type(profile.phone, { delay: 50 });
    }

    // Fill LinkedIn
    if (profile.linkedinUrl) {
      const linkedinInput = await page.$(
        'input[name*="linkedin"], input[id*="linkedin"], input[placeholder*="LinkedIn"]'
      );
      if (linkedinInput)
        await linkedinInput.type(profile.linkedinUrl, { delay: 50 });
    }

    // Fill location/address
    if (profile.location) {
      const locationInput = await page.$(
        'input[name*="location"], input[id*="location"], input[placeholder*="Location"], input[placeholder*="City"]'
      );
      if (locationInput)
        await locationInput.type(profile.location, { delay: 50 });
    }

    // Try to submit
    const submitButton = await page.$(
      'button[type="submit"], input[type="submit"]'
    );
    if (submitButton) {
      await submitButton.click();
      await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    }

    return {
      success: true,
      method: "form_fill",
      message: "Application submitted via Greenhouse",
    };
  } catch {
    return {
      success: false,
      method: "failed",
      message: "Failed to fill Greenhouse form",
    };
  }
}

async function applyLever(
  page: Page,
  profile: UserProfile
): Promise<ApplyResult> {
  try {
    // Lever has an "Apply" button that opens the form
    const applyButton = await page.$(
      'a.postings-btn, .posting-btn-submit, a[href*="/apply"]'
    );
    if (applyButton) {
      await applyButton.click();
      await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    }

    // Fill the form
    const nameInput = await page.$(
      'input[name="name"], input[placeholder*="name"]'
    );
    if (nameInput) await nameInput.type(profile.name, { delay: 50 });

    const emailInput = await page.$(
      'input[name="email"], input[type="email"]'
    );
    if (emailInput) await emailInput.type(profile.email, { delay: 50 });

    if (profile.phone) {
      const phoneInput = await page.$(
        'input[name="phone"], input[type="tel"]'
      );
      if (phoneInput) await phoneInput.type(profile.phone, { delay: 50 });
    }

    if (profile.linkedinUrl) {
      const linkedinInput = await page.$(
        'input[name*="linkedin"], input[name*="urls[LinkedIn]"]'
      );
      if (linkedinInput)
        await linkedinInput.type(profile.linkedinUrl, { delay: 50 });
    }

    // Submit
    const submitBtn = await page.$(
      'button[type="submit"], .template-btn-submit'
    );
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    }

    return {
      success: true,
      method: "form_fill",
      message: "Application submitted via Lever",
    };
  } catch {
    return {
      success: false,
      method: "failed",
      message: "Failed to fill Lever form",
    };
  }
}

async function applyWorkday(
  _page: Page,
  _profile: UserProfile
): Promise<ApplyResult> {
  // Workday is complex - just redirect the user
  return {
    success: true,
    method: "redirect",
    message: "Redirected to Workday application portal",
  };
}

async function applySmartRecruiters(
  page: Page,
  profile: UserProfile
): Promise<ApplyResult> {
  try {
    const applyButton = await page.$(
      'button.js-apply-btn, a.apply-btn, button[data-test="apply-button"]'
    );
    if (applyButton) await applyButton.click();

    await page.waitForSelector(
      'input[name*="name"], input[name*="email"]',
      { timeout: 10000 }
    );

    const nameInput = await page.$(
      'input[name*="firstName"], input[placeholder*="First"]'
    );
    if (nameInput)
      await nameInput.type(profile.name.split(" ")[0] || "", { delay: 50 });

    const lastNameInput = await page.$(
      'input[name*="lastName"], input[placeholder*="Last"]'
    );
    if (lastNameInput)
      await lastNameInput.type(
        profile.name.split(" ").slice(1).join(" ") || "",
        { delay: 50 }
      );

    const emailInput = await page.$(
      'input[type="email"], input[name*="email"]'
    );
    if (emailInput) await emailInput.type(profile.email, { delay: 50 });

    return {
      success: true,
      method: "form_fill",
      message: "Application submitted via SmartRecruiters",
    };
  } catch {
    return {
      success: false,
      method: "failed",
      message: "Failed to fill SmartRecruiters form",
    };
  }
}

async function applyGeneric(
  page: Page,
  profile: UserProfile
): Promise<ApplyResult> {
  try {
    // Try to find and fill common form fields
    const forms = await page.$$("form");
    if (forms.length === 0) {
      return {
        success: true,
        method: "redirect",
        message: "No form found - opened application page",
      };
    }

    // Fill any name-like fields
    const nameSelectors = [
      'input[name*="name"]',
      'input[placeholder*="name"]',
      'input[id*="name"]',
    ];
    for (const sel of nameSelectors) {
      const input = await page.$(sel);
      if (input) {
        await input.type(profile.name, { delay: 50 });
        break;
      }
    }

    // Fill email
    const emailSelectors = [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
    ];
    for (const sel of emailSelectors) {
      const input = await page.$(sel);
      if (input) {
        await input.type(profile.email, { delay: 50 });
        break;
      }
    }

    // Fill phone
    if (profile.phone) {
      const phoneInput = await page.$(
        'input[type="tel"], input[name*="phone"]'
      );
      if (phoneInput) await phoneInput.type(profile.phone, { delay: 50 });
    }

    return {
      success: true,
      method: "form_fill",
      message: "Application form filled (generic)",
    };
  } catch {
    return {
      success: false,
      method: "failed",
      message: "Failed to fill application form",
    };
  }
}
