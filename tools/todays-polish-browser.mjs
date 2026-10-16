import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const dir = "output/todays-polish";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.WANDERLANE_URL || "http://127.0.0.1:8138";
const errors = [],
  report = {};
try {
  for (const [choice, mobile, savedMode] of [
    ["free", false, "endless-city"],
    ["evening-chai-run", false, "endless"],
    ["flower-delivery", true, "pune"],
  ]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 430, height: 932 }
        : { width: 1440, height: 900 },
      hasTouch: mobile,
      isMobile: mobile,
      reducedMotion: mobile ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      (mode) =>
        localStorage.setItem(
          "wanderlane-settings",
          JSON.stringify({ driveMode: mode, quality: "Medium", muted: true }),
        ),
      savedMode,
    );
    await page.goto(url);
    await page.waitForFunction(() => window.wanderlane);
    await page.locator(`input[value="${choice}"][name="openingDrive"]`).check();
    // All cards must be readable without horizontal scrolling; the start
    // control must remain reachable on short screens as well as portrait.
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: `${dir}/${choice}-opening.png` });
    if (mobile) {
      await page.setViewportSize({ width: 932, height: 430 });
      await page.locator("#startBtn").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${dir}/opening-landscape.png` });
      await page.setViewportSize({ width: 430, height: 932 });
    }
    await page.locator("#startBtn").click();
    await page.waitForSelector("#loading", { state: "detached" });
    const s = await page.evaluate(() => window.wanderlane.state);
    assert.equal(s.paused, false);
    assert.equal(s.driveMode, choice === "free" ? savedMode : "pune");
    if (choice !== "free") {
      assert.equal(s.experience.tripId, choice);
      assert.equal(s.experience.status, "active");
      assert.equal(s.city.error, null);
      assert.ok(s.city.detailedFrontages > 0);
    }
    if (mobile) {
      const before = s.distance;
      const box = await page.locator('[data-key="accel"]').boundingBox();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
      });
      await page.waitForTimeout(700);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      assert.ok(
        (await page.evaluate(() => window.wanderlane.state)).distance > before,
      );
      assert.equal(await page.locator("#touch .pressed").count(), 0);
    } else {
      await page.keyboard.down("w");
      await page.waitForTimeout(600);
      await page.keyboard.up("w");
      assert.ok((await page.evaluate(() => window.wanderlane.state)).speed > 0);
    }
    await page.screenshot({ path: `${dir}/${choice}-drive.png` });
    if (choice === "flower-delivery") {
      report.quality = [];
      for (const quality of ["Low", "High", "Medium"]) {
        await page.click("#settingsBtn");
        await page.selectOption("#quality", quality);
        await page.click("#resumeBtn");
        await page.waitForFunction(
          () =>
            window.wanderlane.state.city.pending === 0 &&
            window.wanderlane.state.city.buildings > 0,
        );
        const q = await page.evaluate(() => window.wanderlane.state);
        assert.equal(q.city.error, null);
        assert.equal(q.experience.status, "active");
        assert.equal(q.city.detailedFrontages > 0, quality !== "Low");
        report.quality.push(quality);
      }
    }
    report[choice] = {
      mode: s.driveMode,
      trip: s.experience.tripId ?? null,
      touch: mobile,
      detailedFrontages: s.city?.detailedFrontages ?? 0,
    };
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    `${dir}/opening-report.json`,
    JSON.stringify({ ...report, errors }, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
