import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) console.log(m.type(), m.text());
});
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto("http://127.0.0.1:8123");
await page.waitForTimeout(1500);
await page.screenshot({ path: "tests/start.png" });
await page.click("#startBtn");
await page.waitForTimeout(1200);
await page.screenshot({ path: "tests/drive.png" });
console.log(await page.evaluate(() => window.wanderlane?.state));
await browser.close();
