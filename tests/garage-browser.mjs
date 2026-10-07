import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.GAME_URL || "http://127.0.0.1:8128";
const dir = "output/garage";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  report = { vehicles: [] };
const watch = (page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(20000);
  watch(page);
  await page.goto(base);
  await page.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  await page.click("#startBtn");
  const ids = ["gt", "hatch", "sedan", "suv", "bike", "truck"];
  for (const id of ids) {
    await page.click("#settingsBtn");
    await page.selectOption("#vehicleModel", id);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await page.keyboard.press("h");
    await page.keyboard.down("w");
    await page.waitForTimeout(1100);
    await page.keyboard.down("a");
    await page.waitForTimeout(250);
    await page.keyboard.up("a");
    await page.keyboard.up("w");
    const s = await page.evaluate(() => window.wanderlane.state);
    assert.equal(s.vehicleModel, id);
    assert.ok(s.speed > 1, `${id} keyboard acceleration`);
    assert.ok(Number.isFinite(s.position.y));
    report.vehicles.push({
      id,
      speed: s.speed,
      position: s.position,
      bounds: s.vehicleBounds,
    });
    await page.screenshot({ path: `${dir}/${id}.png` });
    for (let camera = 0; camera < 4; camera++) {
      if (camera) await page.keyboard.press("c");
      await page.waitForTimeout(100);
      const cameraState = await page.evaluate(() => window.wanderlane.state);
      assert.ok(cameraState.cameraPosition.every(Number.isFinite));
      if (cameraState.camera === 3) {
        assert.equal(cameraState.cockpitVisible, true);
        await page.screenshot({ path: `${dir}/${id}-cockpit.png` });
      }
    }
    // Return to chase before the next vehicle's overview.
    await page.keyboard.press("c");
    await page.keyboard.down("s");
    await page.waitForTimeout(2300);
    await page.keyboard.up("s");
    assert.ok(
      (await page.evaluate(() => window.wanderlane.state.speed)) < 0,
      `${id} reverse`,
    );
  }
  await page.reload();
  await page.waitForFunction(() => window.wanderlane);
  assert.equal(
    await page.evaluate(() => window.wanderlane.state.vehicleModel),
    "truck",
  );
  await page.click("#startBtn");
  await page.click("#settingsBtn");
  await page.selectOption("#driveMode", "endless");
  await page.waitForFunction(
    () => window.wanderlane.state.driveMode === "endless",
  );
  assert.equal(
    await page.evaluate(() => window.wanderlane.state.vehicleModel),
    "truck",
  );
  // Repeated swaps should release renderer resources after a frame.
  const memory = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const id of ids) {
      await page.selectOption("#vehicleModel", id);
      await page.waitForTimeout(80);
    }
    memory.push(
      await page.evaluate(() => ({
        geometries: window.wanderlane.state.geometries,
        textures: window.wanderlane.state.textures,
      })),
    );
  }
  assert.deepEqual(memory[2], memory[1]);
  report.memory = memory;
  await page.selectOption("#vehicleModel", "bike");
  await page.keyboard.press("Escape");
  await page.click("#autoBtn");
  await page.waitForTimeout(2500);
  assert.ok((await page.evaluate(() => window.wanderlane.state.speed)) > 1);
  report.endlessAuto = await page.evaluate(
    () => window.wanderlane.state.vehicleModel,
  );

  const touch = await browser.newPage({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  watch(touch);
  await touch.goto(base);
  await touch.waitForFunction(() => window.wanderlane);
  await touch.tap("#startBtn");
  await touch.tap("#settingsBtn");
  await touch.selectOption("#vehicleModel", "bike");
  await touch.locator("#settings button").last().tap();
  const client = await touch.context().newCDPSession(touch);
  const pedal = await touch.locator('[data-key="accel"]').boundingBox();
  const left = await touch.locator('[data-key="left"]').boundingBox();
  const points = [pedal, left].map((r, i) => ({
    x: r.x + r.width / 2,
    y: r.y + r.height / 2,
    id: i + 1,
  }));
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [points[0]],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await touch.waitForTimeout(900);
  const t = await touch.evaluate(() => window.wanderlane.state);
  assert.ok(t.input.accel && t.input.left && t.speed > 1);
  await touch.screenshot({ path: `${dir}/bike-touch.png` });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  report.touch = { speed: t.speed, combinedInput: true };
  assert.deepEqual(errors, []);
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
