import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "output/flower-pickup-scene";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  report = { stages: [], errors };
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    hasTouch: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "wanderlane-settings",
      JSON.stringify({
        driveMode: "pune",
        quality: "Medium",
        shadows: "Off",
        traffic: 0,
        cityActivityVersion: 1,
        muted: true,
      }),
    );
    const raf = requestAnimationFrame.bind(window);
    let clock = 0,
      last = 0;
    window.testScale = 1;
    window.requestAnimationFrame = (cb) =>
      raf((now) => {
        clock += (now - (last || now)) * window.testScale;
        last = now;
        cb(clock);
      });
  });
  await page.goto(process.env.WANDERLANE_URL || "http://127.0.0.1:8138/");
  await page.waitForFunction(() => window.wanderlane);
  await page.check('input[name="openingDrive"][value="flower-delivery"]');
  await page.click("#startBtn");
  await page.click("#autoBtn");
  await page.evaluate(() => (window.testScale = 8));
  await page.waitForFunction(
    () => window.wanderlane.state.experience.arrival.stage === "settling",
    null,
    { timeout: 90000 },
  );
  await page.evaluate(() => (window.testScale = 1));
  await page.waitForFunction(() => window.wanderlane.state.experience.pickup);
  const start = await page.evaluate(() => window.wanderlane.state);
  const stages = new Set();
  await page.keyboard.down("w");
  await page.keyboard.down("a");
  for (let i = 0; i < 130; i++) {
    const s = await page.evaluate(() => window.wanderlane.state);
    if (!s.experience.pickup) break;
    assert.equal(s.speed, 0);
    assert.ok(
      Math.hypot(
        s.position.x - start.position.x,
        s.position.z - start.position.z,
      ) < 0.01,
    );
    if (!stages.has(s.experience.pickup.stage)) {
      stages.add(s.experience.pickup.stage);
      report.stages.push(s.experience.pickup.stage);
      await page.screenshot({ path: `${dir}/stage-${stages.size}.png` });
    }
    await page.waitForTimeout(100);
  }
  await page.keyboard.up("w");
  await page.keyboard.up("a");
  assert.equal(stages.size, 4);
  await page.waitForFunction(
    () => window.wanderlane.state.experience.cargo === "onboard",
  );
  const loaded = await page.evaluate(() => window.wanderlane.state);
  await page.waitForFunction(
    (distance) => window.wanderlane.state.distance > distance + 0.015,
    loaded.distance,
    { timeout: 20000 },
  );
  await page.screenshot({ path: `${dir}/departure.png` });
  assert.equal(
    (await page.evaluate(() => window.wanderlane.state)).deliveryMoment
      .cargoLocation,
    "passenger seat",
  );
  await page.click("#autoBtn");
  await page.keyboard.down("s");
  await page.waitForFunction(() => window.wanderlane.state.speed < 0.1);
  await page.keyboard.up("s");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("#cargoLook").tap();
  await page.screenshot({ path: `${dir}/passenger-seat.png` });
  await page.locator("#cargoLook").tap();
  assert.deepEqual(errors, []);
  report.carHeld = true;
  report.departed = true;
  report.touch = true;
} finally {
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
