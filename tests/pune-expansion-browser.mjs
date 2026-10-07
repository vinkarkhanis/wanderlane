import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.GAME_URL || "http://127.0.0.1:8128",
  dir = "output/map-expansion";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  errors = [],
  report = { routes: [] };
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base);
  await page.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  await page.click("#startBtn");
  for (const id of ["sus-hills", "bavdhan", "aundh-retail"]) {
    await page.click("#settingsBtn");
    await page.selectOption("#puneRoute", id);
    await page.waitForFunction(() => !window.wanderlane.state.switching);
    await page.click("#resumeBtn");
    await page.waitForTimeout(750);
    await page.keyboard.down("w");
    await page.waitForTimeout(1500);
    await page.keyboard.down("a");
    await page.waitForTimeout(180);
    await page.keyboard.up("a");
    await page.keyboard.up("w");
    const manual = await page.evaluate(() => window.wanderlane.state);
    if (manual.speed <= 1) console.log(JSON.stringify({ id, manual, errors }));
    assert.ok(manual.speed > 1);
    assert.equal(manual.driveMode, "pune");
    assert.equal(manual.experience.available, false);
    assert.equal(manual.city.error, null);
    await page.keyboard.press("h");
    await page.click("#autoBtn");
    const before = await page.evaluate(() => window.wanderlane.state);
    await page.waitForFunction(
      (s) => window.wanderlane.state.roadDistance > s + 10,
      before.roadDistance,
      { timeout: 45000 },
    );
    const after = await page.evaluate(() => window.wanderlane.state);
    assert.ok(after.auto);
    assert.ok(after.chunks <= 25);
    assert.ok(after.city.pavementBays > 0);
    await page.screenshot({ path: `${dir}/${id}-ui.png` });
    report.routes.push({
      id,
      manualSpeed: manual.speed,
      travelled: after.roadDistance - before.roadDistance,
      city: after.city,
    });
  }
  await page.reload();
  await page.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  assert.equal(await page.locator("#puneRoute").inputValue(), "aundh-retail");
  await page.click("#startBtn");
  await page.click("#settingsBtn");
  await page.selectOption("#puneRoute", "pilot");
  await page.waitForFunction(
    () =>
      !!window.wanderlane.state.experience &&
      !window.wanderlane.state.switching,
  );
  await page.click("#resumeBtn");
  await page.selectOption("#discoveryDrive", "monsoon-pashan");
  await page.click("#tripStart");
  await page.waitForFunction(
    () => window.wanderlane.state.experience.status === "active",
  );
  report.originalJourney = await page.evaluate(
    () => window.wanderlane.state.experience.tripId,
  );
  const touch = await browser.newPage({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  touch.on("pageerror", (e) => errors.push(e.message));
  await touch.goto(base);
  await touch.waitForFunction(
    () => window.wanderlane && !window.wanderlane.state.switching,
  );
  await touch.tap("#startBtn");
  await touch.tap("#settingsBtn");
  await touch.selectOption("#puneRoute", "bavdhan");
  await touch.waitForFunction(() => !window.wanderlane.state.switching);
  await touch.tap("#resumeBtn");
  const client = await touch.context().newCDPSession(touch),
    buttons = await touch
      .locator('[data-key="accel"], [data-key="left"]')
      .evaluateAll((es) =>
        es.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }),
      );
  assert.equal(buttons.length, 2);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: buttons.map((p, i) => ({ ...p, id: i + 1 })),
  });
  await touch.waitForTimeout(900);
  const ts = await touch.evaluate(() => window.wanderlane.state);
  assert.ok(ts.speed > 1 && ts.input.accel && ts.input.left);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.screenshot({ path: `${dir}/bavdhan-touch.png` });
  report.touch = { speed: ts.speed, combined: true };
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(
    `${dir}/browser-report.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
