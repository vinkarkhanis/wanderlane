import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [],
  report = {};
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  report.refresh = await page.evaluate(async () => {
    const { VehiclePose } = await import("/src/vehiclePose.js"),
      { CameraRig } = await import("/src/camera.js"),
      THREE = await import("/vendor/three.module.js");
    return [30, 60, 90, 120, 144, 165].map((fps) => {
      const rig = new CameraRig(),
        view = new VehiclePose(),
        v = { x: 0, y: 0, z: 0, speed: 30, heading: 0, pitch: 0 },
        marker = new THREE.Vector3();
      view.capture(v);
      let accumulator = 0,
        rawPrevious = 0,
        visualPrevious = 0,
        rawError = 0,
        visualError = 0,
        minY = Infinity,
        maxY = -Infinity;
      for (let frame = 0; frame < fps * 4; frame++) {
        accumulator += 1 / fps;
        while (accumulator >= 1 / 60) {
          view.capture(v);
          v.z += 30 / 60;
          accumulator -= 1 / 60;
        }
        const pose = view.sample(v, accumulator * 60);
        rig.update(pose, 1 / fps);
        rig.cam.updateMatrixWorld();
        marker.set(pose.x, pose.y + 0.8, pose.z).project(rig.cam);
        if (frame > fps) {
          rawError = Math.max(rawError, Math.abs(v.z - rawPrevious - 30 / fps));
          visualError = Math.max(
            visualError,
            Math.abs(pose.z - visualPrevious - 30 / fps),
          );
          minY = Math.min(minY, marker.y);
          maxY = Math.max(maxY, marker.y);
        }
        rawPrevious = v.z;
        visualPrevious = pose.z;
      }
      return {
        fps,
        rawStepError: rawError,
        renderStepError: visualError,
        carScreenJitterPixels: (maxY - minY) * 400,
      };
    });
  });
  for (const run of report.refresh) {
    assert.ok(run.renderStepError < 1e-8);
    assert.ok(run.carScreenJitterPixels < 0.01);
  }
  await page.click("#startBtn");
  await page.keyboard.press("Space");
  await page.waitForTimeout(4000);
  report.pune = await page.evaluate(async () => {
    const samples = [];
    await new Promise((resolve) => {
      let previous;
      const sample = (now) => {
        const s = window.wanderlane.state;
        if (previous)
          samples.push({
            dt: now - previous.now,
            raw: Math.hypot(
              s.position.x - previous.s.position.x,
              s.position.z - previous.s.position.z,
            ),
            render: Math.hypot(
              s.renderPosition.x - previous.s.renderPosition.x,
              s.renderPosition.z - previous.s.renderPosition.z,
            ),
            speed: s.speed,
          });
        previous = { s, now };
        if (samples.length < 300) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return {
      repeatedPhysicsFrames: samples.filter((s) => s.raw < 1e-8 && s.speed > 1)
        .length,
      repeatedRenderFrames: samples.filter(
        (s) => s.render < 1e-8 && s.speed > 1,
      ).length,
      samples: samples.length,
      state: window.wanderlane.state,
    };
  });
  assert.equal(report.pune.repeatedRenderFrames, 0);
  for (let mode = 0; mode < 4; mode++) {
    await page.screenshot({ path: `tests/ride-pune-camera-${mode}.png` });
    await page.keyboard.press("KeyC");
    await page.waitForTimeout(800);
  }
  await page.keyboard.press("KeyH");
  assert.ok((await page.evaluate(() => window.wanderlane.state)).speed < 0.1);
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile("tests/ride-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
