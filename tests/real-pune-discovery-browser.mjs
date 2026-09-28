import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  external = [],
  report = {};
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    !r.url().startsWith("http://127.0.0.1:8123") &&
    !r.url().startsWith("data:")
  )
    external.push(r.url());
});
page.on("requestfailed", (r) => {
  if (!r.failure().errorText.includes("ABORTED"))
    errors.push(r.failure().errorText);
});
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now() * 10));
});
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.selectOption("#discoveryDrive", "baner-evening");
  await page.click("#tripStart");
  await page.waitForFunction(
    () => window.wanderlane.state.experience.status === "active",
  );
  await page.click("#postcardBtn");
  assert.ok(await page.locator("#postcardDialog").isVisible());
  assert.ok(
    await page.locator("#postcardImage").evaluate((e) => e.naturalWidth > 0),
  );
  assert.ok(await page.evaluate(() => window.wanderlane.state.paused));
  await page.screenshot({ path: "tests/real-pune-after/postcard.png" });
  await page.locator("#postcardDialog button").click();
  await page.click("#postcardBtn");
  await page.keyboard.press("Escape");
  assert.ok(!(await page.locator("#postcardDialog").isVisible()));
  assert.ok(!(await page.locator("#settings").isVisible()));
  assert.ok(!(await page.evaluate(() => window.wanderlane.state.paused)));
  for (const id of ["baner-evening", "monsoon-pashan"]) {
    if (id === "monsoon-pashan") {
      await page.selectOption("#discoveryDrive", id);
      await page.click("#tripStart");
      await page.waitForFunction(
        () => window.wanderlane.state.experience.status === "active",
      );
    }
    await page.click("#autoBtn");
    let last = -1;
    const start = Date.now();
    while (Date.now() - start < 420000) {
      await page.waitForTimeout(1000);
      const s = await page.evaluate(() => window.wanderlane.state);
      if (s.experience.objectiveIndex !== last) {
        console.log(
          id,
          s.experience.objectiveIndex,
          Math.round(s.roadDistance),
        );
        last = s.experience.objectiveIndex;
      }
      if (s.experience.status === "completed") {
        report[id] = s;
        break;
      }
    }
    assert.ok(report[id], `${id} did not complete`);
    await page.screenshot({ path: `tests/real-pune-after/${id}-arrival.png` });
  }
  assert.equal(report["monsoon-pashan"].journal.drives.length, 2);
  assert.equal(report["monsoon-pashan"].season, "Monsoon");
  assert.ok(report["monsoon-pashan"].journal.scenes.length >= 3);
  assert.equal(report["monsoon-pashan"].journal.postcards.length, 1);
  await page.click("#settingsBtn");
  await page.selectOption("#quality", "Low");
  await page.click("#resumeBtn");
  await page.click("#tripStart");
  await page.waitForTimeout(1200);
  report.low = await page.evaluate(() => window.wanderlane.state);
  assert.ok(
    report.low.chunks <= 9,
    JSON.stringify({
      quality: report.low.quality,
      chunks: report.low.chunks,
      pending: report.low.city.pending,
      queued: report.low.city.queued,
    }),
  );
  assert.equal(report.low.city.error, null);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    "tests/real-pune-validation/discovery-browser.json",
    JSON.stringify({ report, errors, external }, null, 2),
  );
  console.log(
    "Both discovery drives, photo, journal, Low quality and local-only requests passed",
  );
} finally {
  await browser.close();
}
