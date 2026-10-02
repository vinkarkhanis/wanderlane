import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "output/all-mode-streets";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [],
  report = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = () => page.evaluate(() => window.wanderlane.state);
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.waitForFunction(() => window.wanderlane.state.city?.frontages > 0);
  await page.waitForTimeout(1000);
  for (const id of [
    "free-roam",
    "evening-chai-run",
    "baner-evening",
    "monsoon-pashan",
  ]) {
    if (id !== "free-roam") {
      if (await page.locator("#cityTrip.trip-compact").count())
        await page.click("#tripDetails");
      if (await page.locator("#tripCancel").isVisible())
        await page.click("#tripCancel");
      await page.selectOption("#discoveryDrive", id);
      await page.click("#tripStart");
      await page.waitForFunction(
        () => window.wanderlane.state.experience.status === "active",
      );
      await page.waitForTimeout(1200);
    }
    const s = await state();
    assert.ok(s.city.frontages > 0);
    assert.ok(s.city.pavementBays > 0);
    assert.equal(s.city.error, null);
    report.push({ id, ...s });
    await page.screenshot({ path: `${dir}/${id}.png` });
  }
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const mode of ["endless", "pune"]) {
      await page.click("#settingsBtn");
      await page.selectOption("#driveMode", mode);
      await page.waitForFunction(
        (mode) => window.wanderlane.state.driveMode === mode,
        mode,
      );
      await page.click("#resumeBtn");
      await page.waitForTimeout(1000);
      const s = await state();
      if (mode === "endless") assert.ok(s.settlementBuildings > 0);
      report.push({ id: `${mode}-${cycle}`, ...s });
      if (cycle === 0) await page.screenshot({ path: `${dir}/${mode}.png` });
      if (cycle === 0 && mode === "endless") {
        for (let i = 0; i < 4; i++) {
          const biome = await state();
          assert.ok(biome.settlementBuildings > 0, biome.biome);
          await page.screenshot({ path: `${dir}/endless-${biome.biome}.png` });
          await page.click("#terrainBtn");
          await page.waitForTimeout(600);
        }
      }
    }
  }
  for (const mode of ["endless", "pune"]) {
    const samples = report.filter((s) => s.id.startsWith(mode + "-"));
    assert.ok(samples.at(-1).textures <= samples[1].textures + 1);
    assert.ok(samples.at(-1).geometries <= samples[1].geometries + 5);
  }
  await page.click("#settingsBtn");
  await page.selectOption("#quality", "Low");
  await page.click("#resumeBtn");
  await page.waitForTimeout(1000);
  const low = await state();
  assert.ok(low.city.pavementBays > 0 && low.city.frontages > 0);
  await page.keyboard.down("w");
  await page.waitForTimeout(800);
  await page.keyboard.up("w");
  assert.ok((await state()).speed > 0);
  await page.click("#returnBtn");
  await page.keyboard.press("Space");
  await page.waitForTimeout(1500);
  assert.ok((await state()).auto);
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/report.json`,
    JSON.stringify({ report, low, errors }, null, 2),
  );
  console.log(
    report.map((s) => ({
      id: s.id,
      frontages: s.city?.frontages,
      pavements: s.city?.pavementBays,
      settlements: s.settlementBuildings,
      textures: s.textures,
      geometries: s.geometries,
    })),
  );
} finally {
  await browser.close();
}
