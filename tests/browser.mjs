import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  warnings = [],
  remote = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (!r.url().startsWith("http://127.0.0.1") && !r.url().startsWith("data:"))
    remote.push(r.url());
});
const state = () => page.evaluate(() => window.wanderlane.state);
const report = {};
try {
  await page.goto("http://127.0.0.1:8123");
  await page.click("#startBtn");
  await page.waitForTimeout(400);
  assert.equal((await state()).chunks, 9);
  report.initial = await state();
  await page.keyboard.press("Space");
  await page.waitForTimeout(12000);
  report.auto = await state();
  assert.ok(report.auto.distance > 0.15);
  assert.ok(Math.abs(report.auto.offset - 2) < 0.6);
  await page.keyboard.press("Space");
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1700);
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyW");
  report.manual = await state();
  await page.keyboard.press("KeyH");
  await page.waitForTimeout(250);
  assert.ok((await state()).speed < 0.1);
  assert.ok(Math.abs((await state()).offset - 2) < 0.1);
  for (let i = 0; i < 4; i++) {
    await page.click("#camBtn");
    await page.waitForTimeout(200);
    const s = await state();
    report["camera" + s.camera] = s.cameraPosition;
    await page.screenshot({ path: `tests/camera-${s.camera}.png` });
  }
  const biomeMemory = [];
  for (let round = 0; round < 3; round++)
    for (let i = 0; i < 4; i++) {
      await page.click("#terrainBtn");
      await page.waitForTimeout(100);
      const s = await state();
      biomeMemory.push({
        biome: s.biome,
        geometries: s.geometries,
        textures: s.textures,
        chunks: s.chunks,
      });
      if (round === 0) await page.screenshot({ path: `tests/${s.biome}.png` });
    }
  report.biomeMemory = biomeMemory;
  for (let i = 0; i < 4; i++)
    assert.equal(biomeMemory[i].geometries, biomeMemory[i + 8].geometries);
  for (let i = 0; i < 4; i++) {
    await page.click("#timeBtn");
    await page.waitForTimeout(3300);
    const s = await state();
    report[s.time] = { headlights: s.headlights };
    await page.screenshot({ path: `tests/${s.time.toLowerCase()}.png` });
    if (s.time === "Night") assert.ok(s.headlights[0] > 85);
  }
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(100);
    const s = await state();
    assert.equal(s.trafficCars.length, [0, 3, 7][s.traffic]);
    for (const c of s.trafficCars)
      assert.ok(Math.abs(c.s - s.roadDistance) > 50);
    report["traffic" + s.traffic] = s.trafficCars;
  }
  await page.keyboard.press("KeyV");
  assert.equal(await page.locator("#colorBtn").textContent(), "Pearl");
  await page.keyboard.press("KeyM");
  assert.ok((await state()).muted);
  await page.keyboard.press("Escape");
  assert.ok(await page.locator("#settings").evaluate((d) => d.open));
  for (const q of ["Low", "High", "Medium"]) {
    await page.selectOption("#quality", q);
    await page.waitForTimeout(100);
    assert.equal((await state()).quality, q);
  }
  for (const q of ["Off", "High", "Medium"])
    await page.selectOption("#shadows", q);
  await page.locator("#reducedMotion").check();
  await page.locator("#masterVolume").fill("0.2");
  await page.locator("#engineVolume").fill("0.2");
  await page.locator("#ambienceVolume").fill("0.2");
  await page.selectOption("#lane", "-2");
  await page.fill("#seed", "a-fresh-horizon");
  await page.click("#seedBtn");
  assert.equal((await state()).seed, "a-fresh-horizon");
  await page.click("#resumeBtn");
  await page.waitForFunction(() => window.wanderlane.state.paused === false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "tests/mobile.png" });
  assert.ok(await page.locator("#settingsBtn").isVisible());
  await page.click("#settingsBtn");
  await page.screenshot({ path: "tests/mobile-settings.png" });
  await page.click("#resumeBtn");
  await page.waitForFunction(() => window.wanderlane.state.paused === false);
  // Keyboard actions use the same hooks as the toolbar, without key-repeat toggles.
  for (const key of ["KeyR", "KeyT", "KeyC"]) {
    const before = await state();
    await page.keyboard.press(key);
    const after = await state();
    const field = { KeyR: "biome", KeyT: "time", KeyC: "camera" }[key];
    assert.notEqual(after[field], before[field]);
  }
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.wanderlane.state.paused);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !window.wanderlane.state.paused);
  const touchPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await touchPage.goto("http://127.0.0.1:8123");
  await touchPage.click("#startBtn");
  assert.ok(await touchPage.locator("#touch").isVisible());
  const accelerator = touchPage.locator('[data-key="accel"]');
  const buttonBounds = await accelerator.boundingBox();
  await touchPage.mouse.move(
    buttonBounds.x + buttonBounds.width / 2,
    buttonBounds.y + buttonBounds.height / 2,
  );
  await touchPage.mouse.down();
  await touchPage.waitForTimeout(700);
  await touchPage.mouse.up();
  assert.ok(await touchPage.evaluate(() => window.wanderlane.state.speed > 0));
  await touchPage.screenshot({ path: "tests/touch.png" });
  await touchPage.close();
  report.errors = errors;
  report.warnings = warnings;
  report.remote = remote;
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(remote, []);
  console.log("Browser checks passed", JSON.stringify(report));
  await writeFile(
    "tests/browser-results.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
