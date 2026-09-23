import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const issues = [];
page.on("requestfailed", (r) =>
  issues.push(r.url() + ": " + r.failure()?.errorText),
);
page.on("console", (m) => {
  if (["warning", "error"].includes(m.type())) issues.push(m.text());
});
page.on("pageerror", (e) => issues.push(e.message));
try {
  await page.goto("http://127.0.0.1:8123");
  assert.match(await page.title(), /Wanderlane/i);
  await page.setViewportSize({ width: 390, height: 844 });
  const welcome = await page.locator("h1").boundingBox();
  assert.ok(welcome.x >= 0 && welcome.x + welcome.width <= 390);
  assert.equal(await page.locator("h1").textContent(), "WANDERLANE");
  await page.screenshot({ path: "tests/wanderlane-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click("#startBtn");
  const cabin = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { Cockpit } = await import("/src/cockpit.js");
    const { CAR_ANCHORS } = await import("/src/carGeometry.js");
    const c = new Cockpit(new THREE.Group());
    const result = { wheel: c.wheel.position.x, eye: CAR_ANCHORS.cockpit[0] };
    c.update(-2, 0, false);
    result.reverse = c.lastReverse;
    c.dispose();
    return result;
  });
  assert.ok(
    cabin.wheel < 0,
    "Right-hand driver is negative local X when facing +Z",
  );
  assert.equal(cabin.wheel, cabin.eye);
  assert.equal(cabin.reverse, true);
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "tests/cockpit.png" });
  console.log(await page.evaluate(() => window.wanderlane.state));
  assert.ok(await page.evaluate(() => window.wanderlane.state.cockpitVisible));
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("KeyA");
  assert.ok(
    Math.abs(
      await page.evaluate(() => window.wanderlane.state.steeringWheelAngle),
    ) > 0.1,
  );
  assert.ok(
    await page.evaluate(() => window.wanderlane.state.instrumentSpeed > 0),
  );
  await page.screenshot({ path: "tests/cockpit-steer.png" });
  await page.keyboard.press("KeyH");
  await page.keyboard.press("KeyT");
  await page.waitForTimeout(3300);
  await page.screenshot({ path: "tests/cockpit-night.png" });
  await page.keyboard.press("KeyF");
  assert.equal(await page.evaluate(() => window.wanderlane.state.camera), 0);
  assert.deepEqual(issues, []);
  console.log("Car/cockpit checks passed");
} catch (error) {
  console.error("Browser issues:", issues);
  throw error;
} finally {
  await browser.close();
}
