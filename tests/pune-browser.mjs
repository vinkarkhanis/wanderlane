import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  issues = [],
  remote = [];
page.on("pageerror", (e) => issues.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) issues.push(m.text());
});
page.on("requestfailed", (r) =>
  issues.push(r.url() + ": " + r.failure().errorText),
);
page.on("request", (r) => {
  if (
    !r.url().startsWith("http://127.0.0.1:8123") &&
    !r.url().startsWith("data:")
  )
    remote.push(r.url());
});
const state = () => page.evaluate(() => window.wanderlane.state),
  report = {};
try {
  await page.goto("http://127.0.0.1:8123");
  await page.click("#startBtn");
  await page.click("#settingsBtn");
  await page.selectOption("#driveMode", "pune");
  await page.waitForFunction(
    () => window.wanderlane.state.driveMode === "pune",
    null,
    { timeout: 60000 },
  );
  await page.click("#resumeBtn");
  await page.waitForTimeout(1000);
  assert.ok(await page.locator("#mapAttribution").isVisible());
  assert.match(
    await page.locator("#mapAttribution").getAttribute("href"),
    /openstreetmap.org/,
  );
  report.initial = await state();
  assert.equal(report.initial.chunks, 25);
  assert.equal(report.initial.city.error, null);
  for (const label of ["Night", "Dawn", "Day", "Sunset"]) {
    await page.keyboard.press("KeyT");
    await page.waitForTimeout(3300);
    assert.equal((await state()).time, label);
    await page.screenshot({
      path: "tests/pune-" + label.toLowerCase() + ".png",
    });
    if (label === "Night") assert.ok((await state()).headlights[0] > 100);
  }
  await page.click("#autoBtn");
  await page.waitForTimeout(10000);
  report.auto = await state();
  assert.ok(report.auto.distance > 0.03);
  await page.click("#autoBtn");
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyH");
  assert.ok((await state()).speed < 0.1);
  for (let i = 1; i <= 3; i++) {
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(300);
    const s = await state();
    report["traffic" + (i % 3)] = s.trafficCars;
    assert.equal(s.trafficCars.length, [0, 3, 7][i % 3]);
    assert.ok(s.trafficCars.every((c) => c.lane < 0));
    for (const c of s.trafficCars.filter((c) => c.visible))
      assert.ok(Math.abs(c.s - s.roadDistance) > 40);
  }
  await page.keyboard.press("KeyF");
  await page.screenshot({ path: "tests/pune-cockpit.png" });
  assert.equal((await state()).camera, 3);
  await page.keyboard.press("KeyF");
  await page.click("#settingsBtn");
  report.seasons = [];
  for (let pass = 0; pass < 3; pass++)
    for (const season of ["Monsoon", "Winter", "Summer"]) {
      await page.selectOption("#puneSeason", season);
      await page.waitForTimeout(100);
      report.seasons.push(await state());
      if (pass === 0 && season === "Monsoon") {
        await page.click("#resumeBtn");
        await page.screenshot({ path: "tests/pune-monsoon.png" });
        await page.click("#settingsBtn");
      }
    }
  assert.equal(new Set(report.seasons.map((s) => s.geometries)).size, 1);
  assert.equal(new Set(report.seasons.map((s) => s.textures)).size, 1);
  await page.click("#resumeBtn");
  report.frames = await page.evaluate(async () => {
    const a = [];
    let t = performance.now();
    for (let i = 0; i < 120; i++) {
      await new Promise(requestAnimationFrame);
      const n = performance.now();
      a.push(n - t);
      t = n;
    }
    a.sort((x, y) => x - y);
    return { median: a[60], p95: a[114] };
  });
  await page.click("#settingsBtn");
  await page.selectOption("#driveMode", "endless");
  await page.waitForFunction(
    () => window.wanderlane.state.driveMode === "endless",
  );
  assert.ok(!(await page.locator("#mapAttribution").isVisible()));
  await page.selectOption("#driveMode", "pune");
  await page.waitForFunction(
    () => window.wanderlane.state.driveMode === "pune",
  );
  assert.equal((await state()).city.error, null);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click("#resumeBtn");
  await page.screenshot({ path: "tests/pune-mobile.png" });
  assert.ok(await page.locator("#mapAttribution").isVisible());
  assert.deepEqual(issues, []);
  assert.deepEqual(remote, []);
  report.issues = issues;
  report.remote = remote;
  await writeFile(
    "tests/pune-browser-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "Pune browser checks passed",
    JSON.stringify({
      initial: report.initial,
      frames: report.frames,
      seasons: report.seasons.length,
      issues,
    }),
  );
} finally {
  await browser.close();
}
