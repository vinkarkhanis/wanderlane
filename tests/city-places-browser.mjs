import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "output/city-places",
  errors = [],
  report = { districts: [] };
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.GAME_URL || "http://127.0.0.1:8128";
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
  await page.selectOption("#driveMode", "endless-city");
  await page.waitForFunction(() => !window.wanderlane.state.switching);
  await page.click("#resumeBtn");
  for (const [area, kind] of [
    ["market", "mall"],
    ["lake", "lake"],
    ["hills", "hills"],
    ["temple", "temple"],
    ["hotel", "hotel"],
    ["avenue", "park"],
  ]) {
    await page.click("#settingsBtn");
    await page.selectOption("#cityArea", area);
    await page.click("#resumeBtn");
    await page.waitForFunction(
      () =>
        !window.wanderlane.state.paused &&
        !document.activeElement?.closest("dialog"),
    );
    const before = await page.evaluate(() => window.wanderlane.state);
    assert.ok(before.cityPlaces.some((p) => p.kind === kind));
    await page.keyboard.down("w");
    await page.waitForTimeout(1400);
    await page.keyboard.up("w");
    const manual = await page.evaluate(() => window.wanderlane.state);
    if (!(manual.speed > 1))
      console.log(JSON.stringify({ area, before, manual, errors }));
    assert.ok(manual.speed > 1);
    assert.ok(manual.roadDistance > before.roadDistance + 1);
    await page.keyboard.press("h");
    await page.click("#autoBtn");
    const s = await page.evaluate(() => window.wanderlane.state.roadDistance);
    await page.waitForFunction(
      (s) => window.wanderlane.state.roadDistance > s + 12,
      s,
    );
    const after = await page.evaluate(() => window.wanderlane.state);
    assert.ok(after.auto && !after.paused);
    assert.ok(after.chunks <= 9);
    assert.equal(await page.locator("#journeyMap").isVisible(), true);
    assert.ok(
      (await page.locator("#routeStatus").innerText()).includes(
        after.cityDistrict,
      ),
    );
    await page.screenshot({ path: `${dir}/${area}-gameplay.png` });
    report.districts.push({
      area,
      manualSpeed: manual.speed,
      autoTravel: after.roadDistance - s,
      places: after.cityPlaces,
      frameMs: after.frameMs,
    });
    await page.click("#autoBtn");
  }
  await page.reload();
  await page.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  assert.equal(await page.locator("#cityArea").inputValue(), "avenue");
  assert.equal(await page.locator("#driveMode").inputValue(), "endless-city");
  report.savedArea = "avenue";
  const touch = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
  });
  touch.setDefaultTimeout(90000);
  touch.on("pageerror", (e) => errors.push(e.message));
  await touch.goto(base);
  await touch.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  await touch.click("#startBtn");
  await touch.click("#settingsBtn");
  await touch.selectOption("#driveMode", "endless-city");
  await touch.waitForFunction(() => !window.wanderlane.state.switching);
  await touch.selectOption("#cityArea", "lake");
  await touch.click("#resumeBtn");
  const client = await touch.context().newCDPSession(touch);
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 2,
  });
  const buttons = await touch
    .locator('[data-key="accel"], [data-key="left"]')
    .evaluateAll((bs) =>
      bs.map((b) => {
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }),
    );
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: buttons.map((p, i) => ({ ...p, id: i + 1 })),
  });
  await touch.waitForTimeout(700);
  const state = await touch.evaluate(() => window.wanderlane.state);
  assert.ok(state.speed > 1 && state.input.accel && state.input.left);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.waitForTimeout(50);
  const released = await touch.evaluate(() => window.wanderlane.state.input);
  assert.ok(!released.accel && !released.left);
  await touch.screenshot({ path: `${dir}/lake-touch.png` });
  report.touch = { speed: state.speed, combined: true, released: true };
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(
    `${dir}/browser-report.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
