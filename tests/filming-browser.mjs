import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const out = "output/filming-upgrade";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const report = { errors: [], clips: [] };
const url = process.env.WANDERLANE_URL ?? "http://127.0.0.1:8125";
const read = (p) => p.evaluate(() => window.wanderlane.state);
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true,
  });
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "wanderlane-settings",
      JSON.stringify({
        driveMode: "endless",
        quality: "Medium",
        shadows: "Off",
        muted: false,
        endlessWeather: "Monsoon",
        vehicle: "sedan",
        traffic: 1,
        reduced: false,
        musicMood: "off",
      }),
    ),
  );
  await page.goto(url);
  await page.waitForFunction(() => window.wanderlane);
  await page.check('input[name="openingDrive"][value="free"]');
  await page.click("#startBtn");
  await page.keyboard.down("w");
  await page.waitForTimeout(1200);
  await page.keyboard.up("w");
  assert.ok((await read(page)).speed > 2, "normal keyboard driving works");
  await page.click("#autoBtn");
  await page.click("#filmBtn");
  await page.selectOption("#filmShot", "tracking");
  await page.check("#filmClean");
  for (const format of ["landscape", "portrait"]) {
    await page.selectOption("#filmFormat", format);
    await page.selectOption(
      "#filmLength",
      format === "portrait" ? "30" : "600",
    );
    await page.check("#filmCaptions");
    await page.waitForTimeout(1000);
    const before = await read(page);
    const size = await page.locator("#c").evaluate((c) => [c.width, c.height]);
    assert.ok(
      Math.abs(size[0] / size[1] - (format === "portrait" ? 9 / 16 : 16 / 9)) <
        0.005,
    );
    await page.click("#filmRecord");
    await page.waitForFunction(() => window.wanderlane.state.filming.recording);
    await page.keyboard.press("i");
    await page.waitForTimeout(format === "portrait" ? 30500 : 8500);
    await page.locator("#c").screenshot({ path: `${out}/${format}.png` });
    await page.keyboard.press("i");
    const recording = await read(page);
    if (format === "landscape") await page.click("#filmRecord");
    else
      assert.equal(
        recording.filming.recording,
        false,
        "recording stops automatically at its real-time limit",
      );
    await page.waitForSelector("#filmDownload:visible");
    const downloaded = page.waitForEvent("download");
    await page.click("#filmDownload");
    const file = await downloaded;
    await file.saveAs(`${out}/${format}.webm`);
    assert.ok(recording.distance > before.distance);
    assert.ok(
      recording.filming.frames > 80,
      "records changing rendered frames",
    );
    report.clips.push({
      format,
      size,
      fps: recording.filming.capturedFps,
      frames: recording.filming.frames,
      frameMs: recording.frameMs,
    });
  }
  await page.selectOption("#filmShot", "roadside");
  await page.waitForTimeout(1200);
  assert.ok((await read(page)).cameraPosition.every(Number.isFinite));
  await page.selectOption("#filmShot", "cockpit");
  await page.waitForTimeout(400);
  assert.equal((await read(page)).weather.windshield, true);
  await page.keyboard.press("Escape");
  assert.equal((await read(page)).filming.clean, false);
  assert.equal(await page.locator("#settings").evaluate((d) => d.open), false);
  await page.click("#filmClose");
  assert.equal((await read(page)).filming.open, false);
  const canvas = await page.locator("#c").boundingBox();
  assert.equal(canvas.width, 1280);
  await page.keyboard.press("f");
  await page.waitForTimeout(700);
  assert.equal((await read(page)).weather.windshield, true);
  assert.ok((await read(page)).weather.detail.roof > 0);
  const nodes = (await read(page)).audioNodes;
  await page.click("#settingsBtn");
  await page.selectOption("#driveMode", "pune");
  await page.waitForFunction(
    () =>
      window.wanderlane.state.driveMode === "pune" &&
      !window.wanderlane.state.switching,
  );
  await page.click("#resumeBtn");
  await page.click("#filmBtn");
  await page.selectOption("#filmShot", "story");
  await page.click("#filmClose");
  assert.equal(
    (await read(page)).audioNodes,
    nodes,
    "audio graph stays bounded after switching worlds",
  );
  await page.click("#settingsBtn");
  await page.check("#reducedMotion");
  await page.click("#resumeBtn");
  await page.click("#filmBtn");
  await page.selectOption("#filmShot", "tracking");
  await page.waitForTimeout(200);
  assert.equal((await read(page)).reduced, true);
  await page.click("#filmClose");
  const mobile = await browser.newPage({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  });
  mobile.on("pageerror", (e) => report.errors.push(e.message));
  await mobile.goto(url);
  await mobile.waitForFunction(() => window.wanderlane);
  await mobile.check('input[name="openingDrive"][value="free"]');
  await mobile.locator("#startBtn").tap();
  await mobile.locator("#filmBtn").tap();
  await mobile.selectOption("#filmFormat", "portrait");
  await mobile.locator("#filmClean").check();
  await mobile.locator("#filmClose").tap();
  const cdp = await mobile.context().newCDPSession(mobile);
  const pedal = await mobile.locator('[data-key="accel"]').boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: pedal.x + pedal.width / 2, y: pedal.y + pedal.height / 2, id: 7 },
    ],
  });
  await mobile.waitForTimeout(400);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.equal(await mobile.locator("#touch .pressed").count(), 0);
  await mobile.screenshot({ path: `${out}/touch.png` });
  report.touch = true;
  assert.deepEqual(report.errors, []);
  report.complete = true;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
