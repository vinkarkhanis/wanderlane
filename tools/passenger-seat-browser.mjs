import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "output/passenger-seat";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  report = { vehicles: [], errors };
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
  await page.evaluate(() => (window.testScale = 10));
  await page.waitForFunction(
    () => window.wanderlane.state.experience.cargo === "onboard",
    null,
    { timeout: 90000 },
  );
  await page.evaluate(() => (window.testScale = 1));
  await page.click("#autoBtn");
  await page.keyboard.down("s");
  await page.waitForFunction(() => window.wanderlane.state.speed < 0.05);
  await page.keyboard.up("s");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/gt-exterior.png` });
  for (const id of ["gt", "hatch", "sedan", "suv", "truck", "bike"]) {
    if (id !== "gt") {
      await page.click("#settingsBtn");
      await page.selectOption("#vehicleModel", id);
      await page.click("#resumeBtn");
    }
    await page.waitForFunction(
      () => window.wanderlane.state.deliveryMoment.cargoLocation !== null,
    );
    const s = await page.evaluate(() => window.wanderlane.state);
    assert.equal(s.experience.cargo, "onboard");
    assert.equal(
      s.deliveryMoment.cargoLocation,
      id === "bike" ? "rear pillion" : "passenger seat",
    );
    if (id !== "bike") {
      await page.click("#cargoLook");
      await page.waitForFunction(() => window.wanderlane.state.passengerLook);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/${id}-passenger.png` });
      assert.equal(
        (await page.evaluate(() => window.wanderlane.state)).camera,
        3,
      );
      await page.click("#cargoLook");
      assert.equal(
        (await page.evaluate(() => window.wanderlane.state)).passengerLook,
        false,
      );
    } else assert.equal(await page.locator("#cargoLook").isVisible(), false);
    report.vehicles.push({ id, cargo: s.deliveryMoment.cargoLocation });
  }
  await page.click("#settingsBtn");
  await page.selectOption("#vehicleModel", "gt");
  await page.click("#resumeBtn");
  await page.click("#cargoLook");
  await page.keyboard.press("f");
  assert.equal(
    (await page.evaluate(() => window.wanderlane.state)).passengerLook,
    false,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("#cargoLook").tap();
  await page.waitForFunction(() => window.wanderlane.state.passengerLook);
  await page.screenshot({ path: `${dir}/touch-passenger.png` });
  await page.locator("#cargoLook").tap();
  await page.click("#tripDetails");
  await page.click("#tripCancel");
  await page.waitForFunction(
    () => window.wanderlane.state.deliveryMoment.cargoLocation === null,
  );
  assert.equal(await page.locator("#cargoLook").isVisible(), false);
  assert.deepEqual(errors, []);
  report.touch = true;
  report.cancelCleanup = true;
} finally {
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
