import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.GAME_URL || "http://127.0.0.1:8128";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
await mkdir("output/driving-fix", { recursive: true });
try {
  for (const staleTraffic of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (staleTraffic) {
      // Reproduce the older cached module's missing camera visibility API.
      await page.route("**/src/traffic.js*", async (route) => {
        const response = await route.fetch();
        const source = (await response.text()).replace(
          /  setView\(camera, visibleRange = Infinity\) \{[\s\S]*?\n  \}/,
          "",
        );
        assert.ok(!source.includes("setView("));
        await route.fulfill({ response, body: source });
      });
    }
    const response = await page.goto(base);
    assert.equal(response.headers()["cache-control"], "no-store");
    await page.waitForFunction(() => window.wanderlane && !window.wanderlane.state.switching);
    await page.click("#startBtn");
    for (const mode of ["pune", "endless"]) {
      if (mode === "endless") {
        await page.click("#settingsBtn");
        await page.selectOption("#driveMode", mode);
        await page.waitForFunction(() => !window.wanderlane.state.switching);
        await page.click("#resumeBtn");
      }
      const before = await page.evaluate(() => window.wanderlane.state);
      await page.keyboard.down("w");
      await page.waitForTimeout(1800);
      await page.keyboard.up("w");
      const after = await page.evaluate(() => window.wanderlane.state);
      assert.equal(after.paused, false);
      assert.ok(after.speed > 1, `${mode}: throttle must accelerate`);
      assert.ok(after.roadDistance > before.roadDistance + 1, `${mode}: car must move`);
      report.push({ staleTraffic, mode, speed: after.speed, travelled: after.roadDistance - before.roadDistance });
      if (!staleTraffic && mode === "pune")
        await page.screenshot({ path: "output/driving-fix/manual-driving.png" });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile("output/driving-fix/report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
