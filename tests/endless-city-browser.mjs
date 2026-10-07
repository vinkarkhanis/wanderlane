import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const dir = "output/endless-city",
  errors = [],
  report = {};
await mkdir(dir, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:8128");
  await page.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  await page.click("#startBtn");
  await page.click("#settingsBtn");
  await page.selectOption("#driveMode", "endless-city");
  await page.waitForFunction(() => !window.wanderlane.state.switching);
  await page.click("#resumeBtn");
  await page.waitForFunction(
    () =>
      !window.wanderlane.state.paused &&
      !document.activeElement?.closest("dialog"),
  );
  const before = await page.evaluate(() => window.wanderlane.state);
  await page.keyboard.down("w");
  await page.waitForTimeout(1800);
  await page.keyboard.up("w");
  report.manual = await page.evaluate(() => window.wanderlane.state);
  assert.ok(report.manual.speed > 1);
  assert.ok(report.manual.roadDistance > before.roadDistance + 1);
  assert.equal(report.manual.driveMode, "endless-city");
  assert.ok(report.manual.settlementBuildings > 20);
  assert.ok(report.manual.cityPlaces.some((p) => p.kind === "mall"));
  report.vehicles = [];
  for (const model of ["bike", "truck"]) {
    await page.click("#settingsBtn");
    await page.selectOption("#vehicleModel", model);
    await page.click("#resumeBtn");
    await page.waitForFunction(
      () =>
        !window.wanderlane.state.paused &&
        !document.activeElement?.closest("dialog"),
    );
    await page.keyboard.down("w");
    await page.waitForTimeout(1200);
    await page.keyboard.up("w");
    const state = await page.evaluate(() => window.wanderlane.state);
    assert.equal(state.vehicleModel, model);
    assert.ok(state.speed > 1);
    report.vehicles.push({ model, speed: state.speed });
  }
  await page.click("#autoBtn");
  await page.waitForTimeout(8500);
  report.auto = await page.evaluate(() => window.wanderlane.state);
  assert.ok(report.auto.roadDistance > report.manual.roadDistance + 25);
  assert.ok(report.auto.chunks <= 9);
  await page.screenshot({ path: `${dir}/city-drive.png` });
  await page.reload();
  await page.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  assert.equal(await page.locator("#driveMode").inputValue(), "endless-city");
  await page.click("#startBtn");
  // Exercise the production streamer far beyond the mapped Pune boundary.
  report.streaming = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { RoadPath } = await import("/src/roadPath.js");
    const { WorldManager } = await import("/src/worldManager.js");
    const path = new RoadPath("city-stream-check");
    path.urban = true;
    const world = new WorldManager(new THREE.Scene(), path, "meadow", "Low");
    const samples = [];
    try {
      for (const distance of [0, 160, 32768, 100000, 1000000, -100000]) {
        world.update(distance, 0, true, true);
        const center = Math.floor(distance / 160);
        const sidewalks = world.chunks.get(center).road.geometries;
        samples.push({
          distance,
          chunks: world.chunks.size,
          buildings: world.settlementCount,
          ahead: world.chunks.has(center + 6),
          behind: world.chunks.has(center - 2),
          upward: sidewalks
            .slice(-4)
            .every((g) => g.attributes.normal.getY(0) > 0.95),
        });
      }
    } finally {
      world.dispose();
    }
    return { samples, remainingChunks: world.chunks.size };
  });
  for (const s of report.streaming.samples) {
    assert.equal(s.chunks, 9);
    assert.ok(s.buildings > 10 && s.buildings <= 144);
    assert.ok(s.ahead && s.behind && s.upward);
  }
  assert.equal(report.streaming.remainingChunks, 0);
  await page.click("#settingsBtn");
  await page.selectOption("#driveMode", "pune");
  await page.waitForFunction(() => !window.wanderlane.state.switching);
  await page.click("#resumeBtn");
  assert.equal(
    (await page.evaluate(() => window.wanderlane.state)).driveMode,
    "pune",
  );
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      manualSpeed: report.manual.speed,
      autoTravel: report.auto.roadDistance - report.manual.roadDistance,
      streaming: report.streaming,
      errors,
    }),
  );
} finally {
  await browser.close();
}
