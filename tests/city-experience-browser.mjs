import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) errors.push(m.text());
});
page.on("requestfailed", (r) => {
  if (!r.failure().errorText.includes("ABORTED"))
    errors.push(r.url() + r.failure().errorText);
});
const state = () => page.evaluate(() => window.wanderlane.state);
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.click("#tripStart");
  await page.waitForFunction(
    () => window.wanderlane.state.experience.status === "active",
  );
  const first = await state();
  assert.equal(first.city.error, null);
  assert.equal(first.experience.objectiveIndex, 0);
  await page.keyboard.down("w");
  await page.waitForTimeout(2000);
  await page.keyboard.up("w");
  assert.ok((await state()).speed > 1);
  await page.click("#autoBtn");
  await page.waitForTimeout(5000);
  assert.ok((await state()).experience.progress > first.experience.progress);
  await page.screenshot({ path: "tests/chai-start.png" });
  const signals = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { CityPath } = await import("/src/city/cityPath.js"),
      { CitySignals, signalOffset } = await import("/src/city/citySignals.js"),
      { CityTraffic } = await import("/src/city/cityTraffic.js");
    const m = await (await fetch("/assets/cities/pune/manifest.json")).json(),
      n = await (await fetch("/assets/cities/pune/" + m.navigation)).json();
    const path = new CityPath(n, m),
      lights = new CitySignals(path),
      scene = new THREE.Scene(),
      traffic = new CityTraffic(scene, path);
    const light = lights.items[1],
      player = {
        near: { distance: light.s - 250, routeGap: 0 },
        x: 0,
        z: 0,
        speed: 0,
      };
    traffic.signals = lights;
    traffic.setMode(2, player);
    lights.time = 22 - signalOffset(light.id);
    for (let i = 0; i < traffic.cars.length; i++) {
      const c = traffic.cars[i];
      c.s = light.s - 20 - i * 35;
      c.speed = 8;
      c.waiting = false;
      c.car.group.visible = true;
      traffic.place(c, 0, 0);
    }
    for (let i = 0; i < 600; i++) traffic.update(1 / 60, player, 0);
    const stopped = traffic.cars[0].speed,
      stopGap = light.s - traffic.cars[0].s;
    const gaps = traffic.cars
      .slice(1)
      .map(
        (c, i) =>
          traffic.cars[i].s -
          c.s -
          c.car.bounds.halfLength -
          traffic.cars[i].car.bounds.halfLength,
      );
    lights.time = 0 - signalOffset(light.id);
    for (let i = 0; i < 180; i++) traffic.update(1 / 60, player, 0);
    const resumed = traffic.cars[0].speed;
    traffic.dispose();
    lights.dispose();
    return { stopped, stopGap, gaps, resumed, children: scene.children.length };
  });
  assert.ok(signals.stopped < 0.1, JSON.stringify(signals));
  assert.ok(signals.stopGap > 2);
  assert.ok(signals.gaps.every((g) => g >= 1.99));
  assert.ok(signals.resumed > 1);
  assert.equal(signals.children, 0);
  if (await page.locator("#cityTrip.trip-compact").count())
    await page.click("#tripDetails");
  await page.click("#tripCancel");
  await page.click("#tripStart");
  assert.equal((await state()).experience.hardBrakes, 0);
  await page.click("#settingsBtn");
  await page.selectOption("#driveMode", "endless");
  await page.waitForFunction(
    () => window.wanderlane.state.driveMode === "endless",
  );
  assert.equal((await state()).experience.available, false);
  await page.selectOption("#driveMode", "pune");
  await page.waitForFunction(
    () => window.wanderlane.state.driveMode === "pune",
  );
  assert.equal((await state()).experience.status, "idle");
  assert.deepEqual(errors, []);
  await writeFile(
    "tests/chai-p0-results.json",
    JSON.stringify({ signals, errors, state: await state() }, null, 2),
  );
  console.log("Chai P0 browser passed", signals);
} finally {
  await browser.close();
}
