import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) errors.push(m.text());
});
await page.goto("http://127.0.0.1:8123");
await page.click("#startBtn");
await page.click("#terrainBtn");
await page.click("#terrainBtn");
await page.waitForTimeout(1200);
await page.screenshot({ path: "tests/snow-refined.png" });
assert.equal(await page.evaluate(() => wanderlane.state.biome), "snow");
assert.deepEqual(errors, []);
console.log("Snow foliage render passed without warnings/errors");
await browser.close();
