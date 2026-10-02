import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const dir = "output/shop-visibility";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem(
    "wanderlane-settings",
    JSON.stringify({
      driveMode: "pune",
      quality: "Medium",
      muted: true,
      traffic: "Off",
      cityActivityVersion: 1,
    }),
  );
  const raf = requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now() * 4));
});
const state = () => page.evaluate(() => window.wanderlane.state);
try {
  await page.goto(process.env.WANDERLANE_URL || "http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.selectOption("#discoveryDrive", "baner-evening");
  await page.click("#tripStart");
  await page.waitForSelector("#cityTrip.trip-compact");
  assert.equal(
    await page.locator("#tripDetails").getAttribute("aria-expanded"),
    "false",
  );
  await page.click("#tripDetails");
  assert.ok(await page.locator("#tripCancel").isVisible());
  await page.click("#tripDetails");
  await page.click("#autoBtn");
  await page.waitForFunction(
    () => window.wanderlane.state.roadDistance > 9724,
    {},
    { timeout: 60000 },
  );
  await page.click("#autoBtn");
  await page.keyboard.down("s");
  await page.waitForFunction(() => window.wanderlane.state.speed <= 0.5);
  await page.keyboard.up("s");
  await page.screenshot({ path: `${dir}/chai-board.png` });
  await page.click("#autoBtn");
  await page.waitForFunction(
    () => window.wanderlane.state.roadDistance > 10458,
    {},
    { timeout: 180000 },
  );
  await page.click("#autoBtn");
  await page.keyboard.down("s");
  await page.waitForFunction(() => window.wanderlane.state.speed <= 0.5);
  await page.keyboard.up("s");
  const shops = await state();
  assert.ok(shops.city.actors.shops >= 6);
  assert.ok(shops.city.actors.pedestrians > 0);
  assert.equal(shops.city.error, null);
  await page.screenshot({ path: `${dir}/shops-sunset.png` });
  while ((await state()).time !== "Day") await page.click("#timeBtn");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/shops-day.png` });
  await page.keyboard.press("f");
  await page.screenshot({ path: `${dir}/shops-cockpit.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: `${dir}/shops-mobile-landscape.png` });
  await page.click("#tripDetails");
  assert.ok(await page.locator("#tripCancel").isVisible());
  await page.click("#tripDetails");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${dir}/shops-mobile-portrait.png` });
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/report.json`,
    JSON.stringify({ shops, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      shops: shops.city.actors.shops,
      pedestrians: shops.city.actors.pedestrians,
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
