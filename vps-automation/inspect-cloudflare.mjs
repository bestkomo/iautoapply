import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();

const url = "https://boards.greenhouse.io/cloudflare/jobs/7006451?gh_jid=7006451";
console.log("Navigating to:", url);

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

console.log("Landed on:", page.url());
console.log("Title:", await page.title());

// Look for any buttons/links that say "Apply"
const applyLinks = await page.evaluate(() => {
  const items = [];
  document.querySelectorAll('a, button').forEach(el => {
    const t = (el.textContent || '').trim();
    if (t.toLowerCase().includes('apply')) {
      items.push({ tag: el.tagName, text: t.substring(0, 80), href: el.href || '' });
    }
  });
  return items;
});
console.log("\nApply links/buttons found:");
console.log(JSON.stringify(applyLinks, null, 2));

// Check for any form fields
const inputs = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
    type: el.type || el.tagName.toLowerCase(),
    name: el.name || '',
    id: el.id || '',
    visible: el.offsetParent !== null,
  })).filter(x => x.name || x.id);
});
console.log("\nForm inputs found:", inputs.length);
console.log(JSON.stringify(inputs.slice(0, 10), null, 2));

await browser.close();
