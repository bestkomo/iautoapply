import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();

await page.goto("https://job-boards.greenhouse.io/caredxinc/jobs/4116553009", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// Click apply
try {
  await page.click('a:has-text("Apply for this job"), a:has-text("Apply")', { timeout: 5000 });
  await page.waitForTimeout(2500);
} catch {}

// Extract all dropdown-looking elements with their labels and classes
const info = await page.evaluate(() => {
  const result = [];
  // All selects
  document.querySelectorAll('select').forEach((s, i) => {
    const l = document.querySelector(`label[for="${s.id}"]`);
    result.push({
      type: "native-select",
      idx: i,
      id: s.id || "",
      name: s.name || "",
      labelText: (l?.textContent || "").trim().substring(0, 80),
      classes: s.className,
      hasValue: !!s.value,
    });
  });
  // ALL divs that look like dropdown wrappers
  const ALL_CLASS_PATTERNS = ["select", "combobox", "dropdown", "Select", "Combobox"];
  document.querySelectorAll('div, span').forEach((d, i) => {
    const cls = d.className || "";
    if (typeof cls !== "string") return;
    const hasPattern = ALL_CLASS_PATTERNS.some(p => cls.includes(p));
    const role = d.getAttribute("role") || "";
    if (!hasPattern && role !== "combobox" && role !== "listbox") return;
    // Only include if it seems to be an interactive dropdown, not a wrapper
    const clickable = d.getAttribute("tabindex") !== null || role === "combobox" || cls.includes("control");
    if (!clickable) return;

    // Find label
    let labelText = "";
    let parent = d.parentElement;
    for (let j = 0; j < 6 && parent && !labelText; j++) {
      const lbl = parent.querySelector("label");
      if (lbl) labelText = lbl.textContent.trim();
      parent = parent.parentElement;
    }
    const ariaLabel = d.getAttribute("aria-label");
    if (!labelText && ariaLabel) labelText = ariaLabel;
    if (!labelText) return;

    result.push({
      type: "div-dropdown",
      idx: i,
      tag: d.tagName,
      role,
      classes: cls.substring(0, 150),
      labelText: labelText.substring(0, 80),
      innerText: (d.innerText || "").substring(0, 50),
    });
  });
  return result;
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
