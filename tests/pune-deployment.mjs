import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  page = await browser.newPage();
const errors = [],
  bad = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) bad.push(r.url());
});
const pattern = "**/cities/pune/chunks/*.json";
try {
  await page.route(pattern, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"id":"corrupt"}',
    }),
  );
  await page.goto("http://127.0.0.1:8123/dist/");
  await page.waitForFunction(() =>
    document
      .getElementById("cityLoading")
      .textContent.includes("could not load"),
  );
  assert.equal(
    await page.evaluate(() => window.wanderlane.state.driveMode),
    "endless",
  );
  await page.click("#startBtn");
  await page.click("#settingsBtn");
  await page.unroute(pattern);
  await page.selectOption("#driveMode", "pune");
  await page.waitForFunction(
    () => window.wanderlane.state.driveMode === "pune",
  );
  await page.click("#resumeBtn");
  await page.waitForTimeout(1000);
  assert.ok(await page.locator("#mapAttribution").isVisible());
  assert.deepEqual(errors, []);
  assert.deepEqual(bad, []);
  console.log(
    "Packaged subdirectory, corrupt-chunk recovery and relative assets passed",
  );
} finally {
  await browser.close();
}
