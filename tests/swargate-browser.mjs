import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.GAME_URL || "http://127.0.0.1:8136",
  dir = "output/swargate-station";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  await page.click("#startBtn");
  await page.click("#settingsBtn");
  await page.selectOption("#puneRoute", "sinhgad-swargate");
  await page.waitForFunction(() => !window.wanderlane.state.switching);
  await page.click("#resumeBtn");
  for (
    let i = 0;
    i < 4 && (await page.locator("#timeBtn").innerText()) !== "Day";
    i++
  )
    await page.click("#timeBtn");
  await page.waitForFunction(
    () => window.wanderlane.state.city.busStations.length === 1,
  );
  const initial = await page.evaluate(() => window.wanderlane.state);
  assert.equal(initial.city.busStations[0].buses, 6);
  assert.equal(initial.city.busStations[0].passengers, 26);
  await page.keyboard.down("w");
  await page.waitForTimeout(1000);
  await page.keyboard.up("w");
  const manual = await page.evaluate(() => window.wanderlane.state.speed);
  assert.ok(manual > 1);
  await page.keyboard.press("h");
  await page.click("#autoBtn");
  const phases = [];
  for (const s of [80, 150, 220, 300, 1100, 1240]) {
    await page.waitForFunction(
      (s) => window.wanderlane.state.roadDistance >= s,
      s,
      { timeout: 180000 },
    );
    const state = await page.evaluate(() => window.wanderlane.state);
    assert.equal(state.city.error, null);
    assert.ok(Number.isFinite(state.position.y));
    await page.screenshot({ path: `${dir}/driving-${s}.png` });
    phases.push({
      s: state.roadDistance,
      position: state.position,
      frameMs: state.frameMs,
      station: state.city.busStations,
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/browser-report.json`,
    JSON.stringify({ manualSpeed: manual, phases, errors }, null, 2),
  );
  console.log(JSON.stringify({ manualSpeed: manual, phases, errors }, null, 2));
} finally {
  await browser.close();
}
