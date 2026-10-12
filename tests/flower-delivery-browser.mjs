import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "output/flower-delivery";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  report = {};
const url = process.env.WANDERLANE_URL ?? "http://127.0.0.1:8126";
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf(() => cb(performance.now() * 10));
  });
  await page.goto(url);
  await page.waitForFunction(
    () => window.wanderlane && window.wanderlane.state.experience,
  );
  await page.click("#startBtn");
  for (const route of ["main", "detour"]) {
    if (route === "detour") await page.click("#tripCancel");
    await page.selectOption("#discoveryDrive", "flower-delivery");
    await page.selectOption("#journeyRoute", route);
    await page.click("#tripStart");
    await page.waitForFunction(
      () =>
        window.wanderlane.state.experience.status === "active" &&
        !window.wanderlane.state.city.pending,
    );
    assert.equal(
      (await page.evaluate(() => window.wanderlane.state)).season,
      "Monsoon",
    );
    await page.screenshot({ path: `${dir}/${route}-start.png` });
    if (route === "main") {
      await page.keyboard.down("w");
      await page.waitForTimeout(450);
      await page.keyboard.up("w");
      assert.ok((await page.evaluate(() => window.wanderlane.state)).speed > 0);
    }
    const cueBefore = (await page.evaluate(() => window.wanderlane.state))
      .arrivalCueCount;
    await page.click("#autoBtn");
    let pickedUp = false,
      pickupShot = false,
      arrivalShot = false;
    const started = Date.now();
    let nextLog = 0;
    while (Date.now() - started < 360000) {
      await page.waitForTimeout(200);
      const s = await page.evaluate(() => window.wanderlane.state);
      if (
        s.experience.cargo === "awaiting pickup" &&
        s.experience.arrival.stage === "settling" &&
        !pickupShot
      ) {
        pickupShot = true;
        await page.screenshot({ path: `${dir}/${route}-pickup.png` });
      }
      if (s.experience.cargo === "onboard" && !pickedUp) {
        pickedUp = true;
        await page.screenshot({ path: `${dir}/${route}-flowers-onboard.png` });
      }
      if (
        s.experience.cargo === "onboard" &&
        s.experience.arrival.stage === "settling" &&
        !arrivalShot
      ) {
        arrivalShot = true;
        await page.screenshot({ path: `${dir}/${route}-parking.png` });
      }
      if (Date.now() - started > nextLog) {
        console.log(
          route,
          s.experience.cargo,
          Math.round(s.roadDistance),
          s.experience.objectiveIndex,
          Math.round(s.experience.remaining),
        );
        nextLog += 20000;
      }
      if (s.experience.status === "completed") {
        report[route] = {
          pickedUp,
          pickupShot,
          arrivalShot,
          trip: s.experience,
        };
        assert.equal(s.arrivalCueCount, cueBefore + 1);
        assert.equal(s.auto, false);
        break;
      }
    }
    assert.ok(report[route], "delivery must finish on the real road");
    assert.ok(pickedUp && pickupShot && arrivalShot);
    assert.equal(report[route].trip.cargo, "delivered");
    assert.equal(report[route].trip.routeChoice, route);
    await page.screenshot({ path: `${dir}/${route}-arrival.png` });
    await page.click("#postcardBtn");
    await page.waitForSelector("#postcardDialog[open]");
    const image = page.locator("#postcardImage");
    assert.equal(await image.evaluate((e) => e.naturalWidth), 1200);
    const card = await image.getAttribute("src");
    await writeFile(
      `${dir}/${route}-postcard.png`,
      Buffer.from(card.split(",")[1], "base64"),
    );
    await page.locator("#postcardDialog button").click();
    await page.locator("#discoveryJournal summary").click();
    await page.waitForSelector("#journalPhotos img");
    await page.screenshot({ path: `${dir}/${route}-scrapbook.png` });
    await page.locator("#discoveryJournal summary").click();
  }
  const before = await page.evaluate(() => window.wanderlane.state.journal);
  assert.equal(before.photos[0].route, "detour");
  await page.reload();
  await page.waitForFunction(() => window.wanderlane);
  assert.deepEqual(
    await page.evaluate(() => window.wanderlane.state.journal),
    before,
  );
  report.persistence = true;
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await context.newPage();
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(url);
  await mobile.waitForFunction(
    () => window.wanderlane && window.wanderlane.state.experience,
  );
  await mobile.locator("#startBtn").tap();
  await mobile.selectOption("#discoveryDrive", "flower-delivery");
  await mobile.locator("#tripStart").tap();
  await mobile.waitForFunction(
    () => window.wanderlane.state.experience.status === "active",
  );
  const cdp = await context.newCDPSession(mobile);
  const boxes = await Promise.all([
    mobile.locator('[data-key="accel"]').boundingBox(),
    mobile.locator('[data-key="left"]').boundingBox(),
  ]);
  const points = boxes.map((b, id) => ({
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
    id,
  }));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await mobile.waitForTimeout(400);
  assert.ok((await mobile.evaluate(() => window.wanderlane.state)).speed > 0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.equal(await mobile.locator("#touch .pressed").count(), 0);
  await mobile.screenshot({ path: `${dir}/touch-portrait.png` });
  await mobile.setViewportSize({ width: 932, height: 430 });
  await mobile.screenshot({ path: `${dir}/touch-landscape.png` });
  report.touch = true;
  assert.deepEqual(errors, []);
  report.errors = errors;
} finally {
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
