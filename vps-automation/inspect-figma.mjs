import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();

await page.goto("https://boards.greenhouse.io/figma/jobs/5971689004", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

try {
  await page.click('a:has-text("Apply for this job")', { timeout: 5000 });
  await page.waitForTimeout(3000);
} catch {}

// Scroll to load all fields
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const result = [];
  document.querySelectorAll('[class*="select__control"]').forEach((div, idx) => {
    // Look for ALL possible value indicators
    const singleValue = div.querySelector('[class*="singleValue"], [class*="single-value"], [class*="Single-value"]');
    const placeholder = div.querySelector('[class*="placeholder"], [class*="Placeholder"]');
    const input = div.querySelector('input');

    // Find label
    let labelText = "";
    let parent = div.parentElement;
    for (let j = 0; j < 6 && parent && !labelText; j++) {
      const lbl = parent.querySelector("label");
      if (lbl) labelText = lbl.textContent.trim();
      parent = parent.parentElement;
    }

    result.push({
      idx,
      className: div.className.substring(0, 100),
      hasSingleValue: !!singleValue,
      singleValueText: singleValue?.textContent?.trim() || null,
      hasPlaceholder: !!placeholder,
      placeholderText: placeholder?.textContent?.trim() || null,
      innerText: div.innerText?.substring(0, 80) || "",
      labelText: labelText.substring(0, 100),
    });
  });
  return result;
});

console.log("Figma form - all select__control divs:");
console.log(JSON.stringify(info, null, 2));
await browser.close();
