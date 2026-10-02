import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage(
      mobile
        ? {
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          }
        : { viewport: { width: 1280, height: 720 } },
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8123");
    await page.waitForFunction(() => window.wanderlane);
    assert.equal(
      await page.evaluate(() => window.wanderlane.state.audioNodes),
      0,
    );
    await page.locator("#startBtn").click();
    await page.waitForFunction(
      () => window.wanderlane.state.audioStatus === "Sound enabled",
    );
    const nodes = await page.evaluate(() => window.wanderlane.state.audioNodes);
    await page.locator("#settingsBtn").click();
    for (const mood of ["chill", "ambient", "night", "off", "chill"]) {
      await page.selectOption("#musicMood", mood);
      assert.equal(
        await page.evaluate(() => window.wanderlane.state.musicMood),
        mood,
      );
      assert.equal(
        await page.evaluate(() => window.wanderlane.state.audioNodes),
        nodes,
      );
    }
    await page.locator("#musicVolume").fill("0.32");
    await page.locator("#musicVolume").dispatchEvent("input");
    await page.reload();
    await page.waitForFunction(() => window.wanderlane);
    assert.equal(
      await page.evaluate(() => window.wanderlane.state.musicMood),
      "chill",
    );
    assert.equal(
      await page.evaluate(() => window.wanderlane.state.musicVolume),
      0.32,
    );
    assert.equal(
      await page.evaluate(() => window.wanderlane.state.audioNodes),
      0,
    );
    await page.locator("#startBtn").click();
    const pcm = await page.evaluate(async () => {
      const { AudioSystem } = await import("/src/audio.js");
      const audio = new AudioSystem();
      await audio.start();
      audio.engine = 0;
      audio.ambience = 0;
      audio.musicMood = "chill";
      const analyser = audio.ctx.createAnalyser();
      analyser.fftSize = 2048;
      audio.gain.connect(analyser);
      const vehicle = { speed: 0, throttle: 0, surface: "Asphalt" };
      const timer = setInterval(() => audio.update(vehicle, 0, false), 25);
      const sample = () => {
        const values = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(values);
        return Math.sqrt(
          values.reduce((sum, n) => sum + n * n, 0) / values.length,
        );
      };
      await new Promise((r) => setTimeout(r, 1800));
      const playing = sample();
      clearInterval(timer);
      audio.update(vehicle, 0, true);
      await new Promise((r) => setTimeout(r, 1500));
      const paused = sample();
      audio.muted = true;
      audio.update(vehicle, 0, false);
      await new Promise((r) => setTimeout(r, 300));
      const muted = sample();
      await audio.ctx.close();
      return { playing, paused, muted };
    });
    assert.ok(pcm.playing > 0.001, JSON.stringify(pcm));
    assert.ok(pcm.paused < pcm.playing * 0.01, JSON.stringify(pcm));
    assert.ok(pcm.muted < pcm.playing * 0.01, JSON.stringify(pcm));
    if (!mobile) {
      await page.keyboard.down("w");
      await page.waitForTimeout(600);
      await page.keyboard.up("w");
    }
    assert.deepEqual(errors, []);
    report.push({ mobile, nodes, pcm, errors });
    await mkdir("output/audio", { recursive: true });
    await page.locator("#settingsBtn").click();
    await page.screenshot({
      path: `output/audio/${mobile ? "touch" : "desktop"}.png`,
    });
    await page.close();
  }
  await writeFile(
    "output/audio/browser-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
