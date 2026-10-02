import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "output/city-activity";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  if (!localStorage.getItem("activity-test-seeded")) {
    localStorage.setItem(
      "wanderlane-settings",
      JSON.stringify({
        driveMode: "pune",
        quality: "Medium",
        traffic: 0,
        muted: true,
      }),
    );
    localStorage.setItem("activity-test-seeded", "yes");
  }
  const raf = requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now() * 4));
});
const state = () => page.evaluate(() => window.wanderlane.state);
const report = {};
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(
    () => window.wanderlane?.state.driveMode === "pune",
  );
  await page.click("#startBtn");
  report.initial = await state();
  assert.equal(report.initial.traffic, 2);
  assert.equal(report.initial.trafficCars.length, 20);
  await page.click("#trafficBtn");
  assert.equal((await state()).traffic, 0);
  await page.reload();
  await page.waitForFunction(
    () => window.wanderlane?.state.driveMode === "pune",
  );
  await page.click("#startBtn");
  assert.equal(
    (await state()).traffic,
    0,
    "Explicit Off persists after the one-time city update",
  );
  await page.click("#trafficBtn");
  await page.click("#trafficBtn");
  await page.selectOption("#discoveryDrive", "baner-evening");
  await page.click("#tripStart");
  await page.waitForFunction(
    () =>
      window.wanderlane.state.experience.status === "active" &&
      !window.wanderlane.state.city.pending,
  );
  report.start = await state();
  assert.ok(report.start.city.actors.marketClusters >= 3);
  assert.ok(report.start.city.actors.pedestrians >= 36);
  const visible = report.start.trafficCars.filter(
    (c) => c.visible && !c.waiting,
  );
  assert.ok(visible.length >= 8, JSON.stringify(visible));
  for (const type of ["bus", "rickshaw", "scooter"])
    assert.ok(
      visible.some((c) => c.type === type),
      `Missing visible ${type}`,
    );
  await page.keyboard.down("w");
  await page.waitForTimeout(600);
  await page.keyboard.up("w");
  assert.ok((await state()).speed > 0);
  await page.click("#autoBtn");
  await page.waitForFunction(
    (s) => window.wanderlane.state.roadDistance > s + 110,
    report.start.roadDistance,
    { timeout: 120000 },
  );
  await page.screenshot({ path: `${dir}/busy-baner-sunset.png` });
  while ((await state()).time !== "Day") await page.click("#timeBtn");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/busy-baner-day.png` });
  report.drive = await state();
  assert.equal(report.drive.city.error, null);
  assert.ok(report.drive.roadDistance - report.start.roadDistance > 110);
  const resources = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const mode of ["endless", "pune"]) {
      await page.click("#settingsBtn");
      await page.selectOption("#driveMode", mode);
      await page.waitForFunction(
        (m) => window.wanderlane.state.driveMode === m,
        mode,
      );
      await page.click("#resumeBtn");
      await page.waitForTimeout(800);
      const s = await state();
      resources.push({ mode, textures: s.textures, geometries: s.geometries });
    }
  }
  for (const mode of ["endless", "pune"]) {
    const samples = resources.filter((s) => s.mode === mode);
    assert.ok(
      samples.at(-1).textures <= samples[0].textures + 1,
      JSON.stringify(samples),
    );
    assert.ok(
      samples.at(-1).geometries <= samples[0].geometries + 5,
      JSON.stringify(samples),
    );
  }
  report.resources = resources;
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      visible: visible.length,
      types: [...new Set(visible.map((c) => c.type))],
      markets: report.start.city.actors.marketClusters,
      people: report.start.city.actors.pedestrians,
      frameMs: report.drive.frameMs,
      resources,
      errors,
    }),
  );
} catch (error) {
  console.log(JSON.stringify({ state: await state(), errors }));
  await page.screenshot({ path: `${dir}/failure.png` });
  throw error;
} finally {
  await browser.close();
}
