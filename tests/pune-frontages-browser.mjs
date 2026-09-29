import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "output/pune-neighbourhood";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem(
    "wanderlane-settings",
    JSON.stringify({ driveMode: "pune", quality: "Medium", muted: true }),
  );
  const raf = requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now() * 4));
});
const state = () => page.evaluate(() => window.wanderlane.state);
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.selectOption("#discoveryDrive", "baner-evening");
  await page.click("#tripStart");
  await page.waitForFunction(
    () =>
      window.wanderlane.state.experience.status === "active" &&
      window.wanderlane.state.city.frontages > 0,
  );
  await page.waitForTimeout(1000);
  const start = await state();
  await page.screenshot({ path: `${dir}/baner-start.png` });
  await page.click("#autoBtn");
  await page.waitForFunction(
    () => window.wanderlane.state.roadDistance > 10025,
    {},
    { timeout: 120000 },
  );
  await page.click("#autoBtn");
  await page.keyboard.down("s");
  await page.waitForTimeout(500);
  await page.keyboard.up("s");
  const drive = await state();
  assert.ok(drive.distance > start.distance + 0.25);
  assert.equal(drive.city.error, null);
  assert.ok(drive.city.frontages > 0);
  await page.screenshot({ path: `${dir}/baner-sunset.png` });
  while ((await state()).time !== "Day") await page.click("#timeBtn");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/baner-day.png` });
  await page.keyboard.press("f");
  await page.waitForTimeout(500);
  assert.equal((await state()).camera, 3);
  await page.screenshot({ path: `${dir}/baner-cockpit.png` });
  const switches = [];
  for (let i = 0; i < 3; i++) {
    for (const mode of ["endless", "pune"]) {
      await page.click("#settingsBtn");
      await page.selectOption("#driveMode", mode);
      await page.waitForFunction(
        (m) => window.wanderlane.state.driveMode === m,
        mode,
      );
      await page.click("#resumeBtn");
      await page.waitForTimeout(1000);
      const s = await state();
      switches.push({ mode, textures: s.textures, geometries: s.geometries });
      assert.ok(!s.city?.error);
    }
  }
  for (const mode of ["endless", "pune"]) {
    const samples = switches.filter((s) => s.mode === mode);
    assert.ok(
      samples.at(-1).textures <= samples[0].textures + 1,
      JSON.stringify(samples),
    );
    assert.ok(
      samples.at(-1).geometries <= samples[0].geometries + 5,
      JSON.stringify(samples),
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/browser-report.json`,
    JSON.stringify({ start, drive, switches, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      frontages: drive.city.frontages,
      distance: drive.distance - start.distance,
      switches,
      errors,
    }),
  );
} finally {
  await browser.close();
}
