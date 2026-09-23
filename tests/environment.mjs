import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const issues = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) issues.push(m.text());
});
page.on("pageerror", (e) => issues.push(e.message));
try {
  await page.goto("http://127.0.0.1:8123");
  await page.click("#startBtn");
  const timings = {};
  for (const quality of ["Low", "Medium", "High"]) {
    await page.click("#settingsBtn");
    await page.selectOption("#quality", quality);
    await page.click("#resumeBtn");
    await page.waitForTimeout(500);
    timings[quality] = await page.evaluate(async () => {
      const frames = [];
      let last = performance.now();
      await new Promise((resolve) => {
        function sample(now) {
          frames.push(now - last);
          last = now;
          if (frames.length < 120) requestAnimationFrame(sample);
          else resolve();
        }
        requestAnimationFrame(sample);
      });
      frames.sort((a, b) => a - b);
      return {
        medianMs: frames[60],
        p95Ms: frames[114],
        ...window.wanderlane.state,
      };
    });
  }
  const memory = [];
  for (let cycle = 0; cycle < 2; cycle++)
    for (let i = 0; i < 4; i++) {
      await page.click("#terrainBtn");
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => window.wanderlane.state);
      memory.push({
        biome: state.biome,
        geometries: state.geometries,
        textures: state.textures,
      });
      if (cycle === 0)
        await page.screenshot({ path: `tests/vegetation-${state.biome}.png` });
    }
  for (let i = 0; i < 4; i++) assert.deepEqual(memory[i], memory[i + 4]);
  await page.click("#settingsBtn");
  await page.locator("#reducedMotion").check();
  await page.click("#resumeBtn");
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => window.wanderlane.state.reduced));
  assert.deepEqual(issues, []);
  const report = { timings, memory, issues };
  await writeFile(
    "tests/environment-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (error) {
  console.error("Browser issues:", issues);
  throw error;
} finally {
  await browser.close();
}
