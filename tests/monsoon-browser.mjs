import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.WANDERLANE_URL || "http://127.0.0.1:8125";
const out = "output/monsoon";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  report = {};
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
const state = (p) => p.evaluate(() => window.wanderlane.state);
async function settings(p, callback) {
  await p.click("#settingsBtn");
  await callback();
  await p.click("#resumeBtn");
  await p.waitForTimeout(450);
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createGain;
    window.weatherGains = [];
    AudioContext.prototype.createGain = function (...args) {
      const node = original.apply(this, args);
      window.weatherGains.push(node);
      return node;
    };
  });
  watch(page);
  await page.goto(base);
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await settings(page, () => page.selectOption("#weather", "Monsoon"));
  assert.equal((await state(page)).weather.active, true);
  assert.equal(await page.locator("#puneSeason").inputValue(), "Monsoon");
  await settings(page, () => page.selectOption("#weather", "Clear"));
  assert.equal((await state(page)).weather.active, false);
  await page.selectOption("#discoveryDrive", "monsoon-pashan");
  await page.click("#tripStart");
  await settings(page, async () => {
    await page.selectOption("#puneSeason", "Monsoon");
    await page.selectOption("#traffic", { index: 0 });
  });
  await page.waitForFunction(
    () =>
      !window.wanderlane.state.city.pending &&
      !window.wanderlane.state.city.queued,
  );
  assert.equal((await state(page)).weather.intensity, "Heavy");
  assert.equal((await state(page)).weather.rainCount, 2800);
  assert.equal((await state(page)).weather.splashCount, 48);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/heavy-rain.png` });
  const heavyGain = (await state(page)).weather.rainGain;
  await settings(page, () => page.selectOption("#rainIntensity", "Light"));
  assert.equal((await state(page)).weather.rainCount, 720);
  assert.equal((await state(page)).weather.splashCount, 24);
  assert.ok((await state(page)).weather.rainGain < heavyGain * 0.6);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/light-rain.png` });
  await settings(page, () => page.selectOption("#rainIntensity", "Heavy"));
  assert.ok((await state(page)).weather.rainGain > 0.01);
  assert.deepEqual(errors, []);
  report.rainRms = await page.evaluate(async () => {
    const gain = window.weatherGains[4],
      analyser = gain.context.createAnalyser();
    analyser.fftSize = 2048;
    gain.connect(analyser);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    gain.disconnect(analyser);
    analyser.disconnect();
    return Math.sqrt(
      samples.reduce((sum, value) => sum + value * value, 0) / samples.length,
    );
  });
  assert.ok(report.rainRms > 0.001, "rain graph emits audio samples");
  const nodes = (await state(page)).audioNodes;
  await page.keyboard.down("w");
  await page.waitForTimeout(1800);
  await page.keyboard.up("w");
  assert.ok((await state(page)).speed > 2);
  assert.ok((await state(page)).weather.sprayCount > 0);
  await page.screenshot({ path: `${out}/pune-rain.png` });
  await page.keyboard.press("f");
  await page.waitForTimeout(500);
  assert.ok((await state(page)).weather.windshield);
  await page.screenshot({ path: `${out}/pune-cockpit.png` });
  await page.keyboard.press("h");
  await page.waitForFunction(
    () => window.wanderlane.state.weather.sprayCount === 0,
  );
  assert.equal((await state(page)).weather.sprayCount, 0);
  await page.click("#settingsBtn");
  const frozen = (await state(page)).weather.time;
  await page.waitForTimeout(350);
  assert.equal((await state(page)).weather.time, frozen);
  await page.click("#resumeBtn");
  for (const [quality, count] of [
    ["Low", 1200],
    ["High", 4800],
    ["Medium", 2800],
  ]) {
    await settings(page, () => page.selectOption("#quality", quality));
    assert.equal((await state(page)).weather.rainCount, count);
  }
  await settings(page, () => page.check("#reducedMotion"));
  assert.equal((await state(page)).weather.rainCount, 0);
  assert.equal((await state(page)).weather.windshield, false);
  assert.equal((await state(page)).weather.splashCount, 0);
  assert.ok((await state(page)).weather.rainGain > 0);
  await settings(page, () => page.uncheck("#reducedMotion"));
  await settings(page, () => page.selectOption("#vehicleModel", "bike"));
  assert.equal((await state(page)).weather.windshield, false);
  await settings(page, () => page.selectOption("#vehicleModel", "gt"));
  assert.equal((await state(page)).weather.windshield, true);
  await settings(page, () => page.selectOption("#puneSeason", "Summer"));
  assert.equal((await state(page)).weather.active, false);
  assert.ok((await state(page)).weather.rainGain < 0.005);
  for (const mode of ["endless", "endless-city", "pune", "endless"]) {
    await settings(page, async () => {
      await page.selectOption("#driveMode", mode);
      await page.waitForFunction(
        (m) => window.wanderlane.state.driveMode === m,
        mode,
      );
      if (mode !== "pune") await page.selectOption("#weather", "Monsoon");
    });
    assert.equal((await state(page)).audioNodes, nodes);
    assert.equal((await state(page)).weather.active, mode !== "pune");
    assert.equal(await page.locator("#windshieldRain").count(), 1);
  }
  await page.keyboard.press("f");
  await page.keyboard.down("w");
  await page.waitForTimeout(1500);
  await page.keyboard.up("w");
  await page.screenshot({ path: `${out}/endless-rain.png` });
  for (let i = 0; i < 4 && (await state(page)).time !== "Night"; i++)
    await page.keyboard.press("t");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/endless-night.png` });
  await page.keyboard.press("m");
  assert.equal((await state(page)).muted, true);
  await page.keyboard.press("m");
  await settings(page, async () => {
    await page.locator("#ambienceVolume").fill("0");
    await page.locator("#ambienceVolume").dispatchEvent("input");
  });
  assert.ok((await state(page)).weather.rainGain < 0.005);
  report.desktop = await state(page);
  await settings(page, () => page.selectOption("#rainIntensity", "Light"));
  await page.reload();
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  assert.equal((await state(page)).weather.active, true);
  assert.equal((await state(page)).weather.intensity, "Light");
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(mobile);
  await mobile.goto(base);
  await mobile.waitForFunction(() => window.wanderlane);
  await mobile.click("#startBtn");
  await mobile.selectOption("#discoveryDrive", "monsoon-pashan");
  await mobile.click("#tripStart");
  await settings(mobile, async () => {
    await mobile.selectOption("#weather", "Monsoon");
    await mobile.selectOption("#quality", "Low");
  });
  const cdp = await mobile.context().newCDPSession(mobile);
  const points = await mobile.evaluate(() =>
    ["accel", "left"].map((key, i) => {
      const b = document
        .querySelector(`[data-key="${key}"]`)
        .getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, id: i + 1 };
    }),
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await mobile.waitForTimeout(900);
  assert.ok((await state(mobile)).speed > 0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.equal(await mobile.locator("#touch .pressed").count(), 0);
  await mobile.click("#returnBtn");
  assert.equal((await state(mobile)).weather.rainCount, 1200);
  await mobile.click("#camBtn");
  await mobile.click("#camBtn");
  await mobile.click("#camBtn");
  await mobile.waitForFunction(
    () => window.wanderlane.state.weather.windshield,
  );
  assert.ok((await state(mobile)).weather.windshield);
  await mobile.screenshot({ path: `${out}/mobile-portrait.png` });
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: `${out}/mobile-landscape.png` });
  report.mobile = await state(mobile);
  report.errors = errors;
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log("Monsoon browser checks passed; evidence in output/monsoon.");
} finally {
  await browser.close();
}
