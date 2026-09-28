import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = {},
  errors = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
watch(page);
const state = (p) => p.evaluate(() => window.wanderlane.state);
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.click("#tripStart");
  for (const key of ["w", "ArrowUp"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(600);
    await page.keyboard.up(key);
    assert.ok((await state(page)).speed > 0);
    await page.keyboard.press("h");
  }
  for (const key of ["a", "d", "ArrowLeft", "ArrowRight"]) {
    await page.keyboard.down("w");
    await page.keyboard.down(key);
    await page.waitForTimeout(350);
    await page.keyboard.up(key);
    await page.keyboard.up("w");
    await page.keyboard.press("h");
  }
  for (const key of ["s", "ArrowDown", "b"]) {
    await page.keyboard.press("h");
    await page.keyboard.down(key);
    await page.waitForTimeout(1400);
    await page.keyboard.up(key);
    assert.ok((await state(page)).speed < -0.1, `${key} reverse`);
  }
  await page.keyboard.press("h");
  await page.keyboard.press("Space");
  assert.ok((await state(page)).auto);
  await page.keyboard.press("Space");
  assert.ok(!(await state(page)).auto);
  const camera = (await state(page)).camera;
  await page.keyboard.press("c");
  assert.notEqual((await state(page)).camera, camera);
  await page.keyboard.press("f");
  assert.equal((await state(page)).camera, 3);
  await page.keyboard.press("f");
  await page.keyboard.press("g");
  assert.equal((await state(page)).traffic, 1);
  await page.keyboard.press("m");
  assert.equal((await state(page)).muted, true);
  await page.keyboard.press("m");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.wanderlane.state.paused);
  await page.click("#resumeBtn");
  report.keyboard = await state(page);
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  watch(mobile);
  await mobile.goto("http://127.0.0.1:8123");
  await mobile.waitForFunction(() => window.wanderlane);
  await mobile.click("#startBtn");
  await mobile.click("#tripStart");
  const cdp = await mobile.context().newCDPSession(mobile);
  const point = async (key, id) => {
    const b = await mobile.locator(`[data-key="${key}"]`).boundingBox();
    return {
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
      id,
      radiusX: 4,
      radiusY: 4,
      force: 1,
    };
  };
  const accel = await point("accel", 1),
    left = await point("left", 2),
    right = await point("right", 3);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [accel, left],
  });
  await mobile.waitForTimeout(650);
  assert.ok(
    await mobile
      .locator('[data-key="accel"]')
      .evaluate((e) => e.classList.contains("pressed")),
  );
  assert.ok(
    await mobile
      .locator('[data-key="left"]')
      .evaluate((e) => e.classList.contains("pressed")),
  );
  assert.ok((await state(mobile)).speed > 0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await mobile.click("#returnBtn");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [accel, right],
  });
  await mobile.waitForTimeout(500);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.equal(await mobile.locator("#touch .pressed").count(), 0);
  await mobile.click("#returnBtn");
  const brake = await point("brake", 4);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [brake],
  });
  await mobile.waitForTimeout(1500);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok((await state(mobile)).speed < 0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [accel],
  });
  await mobile.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal(await mobile.locator("#touch .pressed").count(), 0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [accel],
  });
  await mobile.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  assert.equal(await mobile.locator("#touch .pressed").count(), 0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  const overlap = async () =>
    mobile.evaluate(() => {
      const a = document.getElementById("cityTrip").getBoundingClientRect();
      return [...document.querySelectorAll("#touch button,.toolbar button")]
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return (
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
          );
        })
        .map((e) => e.textContent);
    });
  assert.deepEqual(await overlap(), []);
  await mobile.screenshot({ path: "tests/chai-mobile-portrait.png" });
  await mobile.click("#settingsBtn");
  await mobile.click("#resumeBtn");
  await mobile.click("#tripCancel");
  await mobile.click("#tripStart");
  assert.equal((await state(mobile)).experience.objectiveIndex, 0);
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.waitForTimeout(200);
  assert.deepEqual(await overlap(), []);
  await mobile.screenshot({ path: "tests/chai-mobile-landscape.png" });
  report.touch = await state(mobile);
  report.errors = errors;
  assert.deepEqual(errors, []);
  await writeFile(
    "tests/chai-input-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log("Keyboard and multi-pointer touch paths passed");
  await mobile.close();
} finally {
  await browser.close();
}
