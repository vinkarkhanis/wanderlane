import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "output/vehicle-feel";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [],
  report = { vehicles: [], errors };
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(() => {
  localStorage.setItem(
    "wanderlane-settings",
    JSON.stringify({
      driveMode: "endless",
      vehicle: "gt",
      quality: "Low",
      muted: false,
      master: 0.7,
      engine: 0.8,
      ambience: 0,
      music: 0,
      musicMood: "off",
    }),
  );
  const original = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...args) {
    if (dest === this.context.destination) {
      window.engineAnalyser = this.context.createAnalyser();
      window.engineAnalyser.fftSize = 4096;
      window.engineAnalyser.smoothingTimeConstant = 0;
      original.call(this, window.engineAnalyser);
    }
    return original.call(this, dest, ...args);
  };
});
const state = () => page.evaluate(() => window.wanderlane.state);
async function audio() {
  return page.evaluate(() => {
    const a = window.engineAnalyser;
    const samples = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(samples);
    const bins = new Float32Array(a.frequencyBinCount);
    a.getFloatFrequencyData(bins);
    let power = 0,
      moment = 0;
    for (let i = 0; i < bins.length; i++) {
      const p = 10 ** (bins[i] / 10);
      power += p;
      moment += (p * i * a.context.sampleRate) / a.fftSize;
    }
    return {
      rms: Math.sqrt(samples.reduce((s, n) => s + n * n, 0) / samples.length),
      centroid: moment / power,
    };
  });
}
async function settings(action) {
  await page.click("#settingsBtn");
  await action();
  await page.click("#resumeBtn");
  await page.waitForTimeout(250);
}
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:8126");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await settings(() => page.selectOption("#traffic", { index: 0 }));
  for (const id of ["gt", "hatch", "sedan", "suv", "bike", "truck"]) {
    await settings(() => page.selectOption("#vehicleModel", id));
    await page.keyboard.press("h");
    await page.keyboard.down("w");
    await page.waitForFunction(() => window.wanderlane.state.speed >= 6, null, {
      timeout: 30000,
    });
    await page.keyboard.down("a");
    await page.waitForTimeout(450);
    const s = await state(),
      pcm = await audio();
    await page.keyboard.up("a");
    await page.keyboard.up("w");
    assert.equal(s.drivingFeel.engine.model, id);
    assert.ok(s.speed > 2);
    assert.ok(pcm.rms > 0.005);
    assert.ok(Math.abs(s.drivingFeel.bodyRoll) > 0.001);
    assert.ok(Math.abs(s.drivingFeel.camera.sway) > 0.0001);
    assert.ok(
      Math.abs(s.drivingFeel.camera.sway) < 0.17 &&
        Math.abs(s.drivingFeel.camera.push) < 0.09,
    );
    report.vehicles.push({
      id,
      speed: s.speed,
      feel: s.drivingFeel,
      pcm,
      audioNodes: s.audioNodes,
      framing: {
        fov: s.cameraFov,
        height: s.cameraPosition[1] - s.position.y,
        distance: Math.hypot(
          s.cameraPosition[0] - s.position.x,
          s.cameraPosition[2] - s.position.z,
        ),
      },
    });
    await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
    console.log(id, JSON.stringify({ engine: s.drivingFeel.engine, pcm }));
    await page.screenshot({ path: `${dir}/${id}-corner.png` });
    await page.keyboard.press("f");
    await page.waitForTimeout(200);
    assert.ok((await state()).cameraPosition.every(Number.isFinite));
    await page.keyboard.press("f");
    await page.keyboard.press("h");
    await page.click("#autoBtn");
    const lane = [];
    for (let frame = 0; frame < 10; frame++) {
      await page.waitForTimeout(300);
      const a = await state();
      lane.push({ offset: a.offset, surface: a.surface, speed: a.speed });
    }
    assert.ok(
      lane.every(
        (a) => a.surface === "Asphalt" && Math.abs(a.offset - 2) < 0.65,
      ),
      `${id} stays in lane with its own pace`,
    );
    report.vehicles.at(-1).autoDrive = lane;
    await page.click("#autoBtn");
  }
  assert.equal(
    new Set(report.vehicles.map((v) => v.audioNodes)).size,
    1,
    "Audio graph reused by garage",
  );
  const spectral = report.vehicles.map((v) => v.pcm.centroid);
  assert.ok(
    Math.max(...spectral) - Math.min(...spectral) > 30,
    "Captured engine tones differ",
  );
  await settings(() => page.check("#reducedMotion"));
  await page.keyboard.down("w");
  await page.waitForTimeout(500);
  await page.keyboard.up("w");
  assert.deepEqual((await state()).drivingFeel.camera, {
    sway: 0,
    push: 0,
    bump: 0,
  });
  await page.click("#settingsBtn");
  await page.waitForTimeout(800);
  assert.ok((await audio()).rms < 0.0001, "Pause silences the voice");
  await page.click("#resumeBtn");
  await page.keyboard.press("m");
  await page.waitForTimeout(800);
  assert.ok((await audio()).rms < 0.0001, "Mute silences the voice");
  await page.keyboard.press("m");
  await settings(async () => {
    await page.uncheck("#reducedMotion");
    await page.selectOption("#driveMode", "pune");
    await page.waitForFunction(
      () =>
        window.wanderlane.state.driveMode === "pune" &&
        !window.wanderlane.state.switching,
    );
    await page.selectOption("#weather", "Monsoon");
    await page.selectOption("#rainIntensity", "Heavy");
  });
  await page.waitForTimeout(800);
  assert.ok((await state()).weather.active);
  assert.equal((await state()).drivingFeel.engine.model, "truck");
  await page.screenshot({ path: `${dir}/truck-monsoon.png` });
  assert.deepEqual(errors, []);
  report.complete = true;
  report.reducedMotion =
    report.pauseSilence =
    report.muteSilence =
    report.monsoon =
      true;
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
