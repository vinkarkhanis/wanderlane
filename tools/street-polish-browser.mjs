import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const stage = process.argv[2] || "after";
const dir = "output/street-polish";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  hasTouch: true,
});
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
    }),
  );
  const raf = requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now() * 4));
});
const state = () => page.evaluate(() => window.wanderlane.state);
if (stage === "before")
  await page.route("**/puneFrontages.js*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'p.detailed && quality !== "Low"',
      "false",
    );
    await route.fulfill({ response, body });
  });
if (stage === "before")
  await page.route("**/puneShopfronts.js*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replaceAll(
      'quality !== "Low"',
      "false",
    );
    await route.fulfill({ response, body });
  });
try {
  await page.goto(process.env.WANDERLANE_URL || "http://127.0.0.1:8136");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.selectOption("#discoveryDrive", "baner-evening");
  await page.click("#tripStart");
  await page.waitForFunction(() => window.wanderlane.state.city.frontages > 0);
  while ((await state()).time !== "Day") await page.click("#timeBtn");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/${stage}-start.png` });
  if (stage === "before") process.exitCode = 0;
  else {
    const start = await state();
    await page.keyboard.down("w");
    await page.waitForTimeout(1500);
    await page.keyboard.up("w");
    assert.ok(
      (await state()).distance > start.distance,
      "keyboard acceleration advances vehicle",
    );
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
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${dir}/after-shops.png` });
    await page.keyboard.press("f");
    await page.screenshot({ path: `${dir}/after-cockpit.png` });
    const drive = await state();
    assert.equal(drive.city.error, null);
    assert.ok(drive.city.detailedFrontages > 0);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.screenshot({ path: `${dir}/after-mobile.png` });
    const pedal = await page
      .locator('#touch button[data-key="accel"]')
      .boundingBox();
    assert.ok(pedal, "touch pedal visible");
    const cdp = await page.context().newCDPSession(page);
    const beforeTouch = (await state()).distance;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: pedal.x + pedal.width / 2, y: pedal.y + pedal.height / 2 },
      ],
    });
    await page.waitForTimeout(900);
    assert.ok((await state()).input.accel);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.ok((await state()).distance > beforeTouch);
    await page.waitForTimeout(100);
    assert.ok(!(await state()).input.accel);
    const switches = [];
    for (const quality of ["Low", "High", "Medium"]) {
      await page.click("#settingsBtn");
      await page.selectOption("#quality", quality);
      await page.click("#resumeBtn");
      await page.waitForTimeout(1000);
      await page.waitForFunction(
        (q) =>
          window.wanderlane.state.quality === q &&
          window.wanderlane.state.city.pending === 0 &&
          window.wanderlane.state.city.queued === 0,
        quality,
      );
      const s = await state();
      assert.equal(s.city.error, null);
      switches.push({
        quality,
        geometries: s.geometries,
        textures: s.textures,
        drawCalls: s.drawCalls,
        frontages: s.city.detailedFrontages,
      });
    }
    assert.deepEqual(errors, []);
    await writeFile(
      `${dir}/report.json`,
      JSON.stringify({ drive, switches, errors }, null, 2),
    );
    console.log(JSON.stringify({ switches, errors }));
  }
} finally {
  await browser.close();
}
