import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = {},
  errors = [];
const baseURL = process.env.WANDERLANE_URL || "http://127.0.0.1:8123";
const evidenceDir = process.env.WANDERLANE_URL
  ? "output/flight-live"
  : "output/flight";
await mkdir(evidenceDir, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
function track(p) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
}
track(page);
const state = () => page.evaluate(() => window.wanderlane.state);
async function hold(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
try {
  await page.goto(baseURL);
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  for (const mode of ["pune", "endless"]) {
    if ((await state()).driveMode !== mode) {
      await page.click("#settingsBtn");
      await page.selectOption("#driveMode", mode);
      await page.waitForFunction(
        (m) => window.wanderlane.state.driveMode === m,
        mode,
      );
      await page.evaluate(() => document.querySelector("dialog[open]").close());
      await page.click("#c", { position: { x: 700, y: 700 } });
    }
    await page.keyboard.press("L");
    await page.waitForFunction(
      () => window.wanderlane.state.flight === "flying",
      null,
      { timeout: 20000 },
    );
    const takeoff = await state();
    assert.ok(takeoff.flightAltitude > 30);
    assert.equal(takeoff.auto, false);
    await page.keyboard.press("Space");
    assert.equal((await state()).auto, false);
    await hold("q", 1200);
    const risen = await state();
    assert.ok(risen.flightAltitude > takeoff.flightAltitude + 5);
    await page.keyboard.down("w");
    await hold("a", 2000);
    await page.keyboard.up("w");
    const steered = await state();
    assert.ok(Math.abs(steered.heading - risen.heading) > 0.6);
    assert.ok(
      Math.hypot(
        steered.position.x - risen.position.x,
        steered.position.z - risen.position.z,
      ) > 5,
    );
    await page.screenshot({ path: `${evidenceDir}/${mode}-flight.png` });
    await page.keyboard.press("F");
    assert.equal((await state()).camera, 3);
    await page.keyboard.press("F");
    await page.keyboard.press("L");
    await page.waitForFunction(
      () => window.wanderlane.state.flight === "landing",
    );
    await page.keyboard.press("L");
    assert.equal((await state()).flight, "flying");
    await page.keyboard.press("L");
    const target = (await state()).flightTarget;
    await page.waitForFunction(
      () => window.wanderlane.state.flight === "ground",
      null,
      { timeout: 30000 },
    );
    const landed = await state();
    assert.ok(
      Math.hypot(landed.position.x - target.x, landed.position.z - target.z) <
        0.15,
    );
    assert.ok(Math.abs(landed.position.y - target.y) < 0.15);
    await hold("w", 1000);
    assert.ok((await state()).speed > 2);
    await page.keyboard.press("L");
    await page.waitForTimeout(1000);
    await page.keyboard.press("H");
    assert.equal((await state()).flight, "ground");
    report[mode] = { takeoff, risen, steered, landed };
  }
  const touch = await browser.newPage({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  track(touch);
  await touch.goto(baseURL);
  await touch.waitForFunction(() => window.wanderlane);
  await touch.tap("#startBtn");
  await touch.tap("#flyBtn");
  await touch.waitForFunction(
    () => window.wanderlane.state.flight === "flying",
    null,
    { timeout: 20000 },
  );
  const cdp = await touch.context().newCDPSession(touch);
  const points = await touch.evaluate(() =>
    ["left", "accel", "rise"].map((key, i) => {
      const r = document
        .querySelector(`[data-key="${key}"]`)
        .getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, id: i + 1 };
    }),
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await touch.waitForTimeout(1200);
  const simultaneous = await touch.evaluate(() => window.wanderlane.state);
  assert.ok(
    simultaneous.input.left &&
      simultaneous.input.accel &&
      simultaneous.input.rise,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.ok(!(await touch.evaluate(() => window.wanderlane.state)).input.accel);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await touch.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.ok(!(await touch.evaluate(() => window.wanderlane.state)).input.rise);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await touch.screenshot({ path: `${evidenceDir}/touch-flight.png` });
  await touch.tap("#settingsBtn");
  const paused = await touch.evaluate(() => window.wanderlane.state);
  assert.ok(
    paused.paused &&
      !paused.input.left &&
      !paused.input.accel &&
      !paused.input.rise,
  );
  const y = paused.position.y;
  await touch.waitForTimeout(500);
  assert.equal(
    (await touch.evaluate(() => window.wanderlane.state)).position.y,
    y,
  );
  await touch.evaluate(() => document.querySelector("dialog[open]").close());
  await touch.tap("#flyBtn");
  await touch.waitForFunction(
    () => window.wanderlane.state.flight === "ground",
    null,
    { timeout: 30000 },
  );
  report.touch = {
    simultaneous,
    paused,
    landed: await touch.evaluate(() => window.wanderlane.state),
  };
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(
    `${evidenceDir}/browser-report.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    "Flight passed: Pune/endless keyboard takeoff, movement, altitude, cockpit, landing/cancel, recovery; real multi-touch and cleanup; zero browser errors.",
  );
} catch (e) {
  console.log(JSON.stringify(await state()));
  throw e;
} finally {
  await browser.close();
}
