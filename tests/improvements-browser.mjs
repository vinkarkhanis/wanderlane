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
await page.addInitScript(() =>
  localStorage.setItem(
    "wanderlane-settings",
    JSON.stringify({ driveMode: "endless", quality: "Low" }),
  ),
);
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  report.contact = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { RoadPath } = await import("/src/roadPath.js"),
      { Vehicle } = await import("/src/vehicle.js"),
      { CameraRig } = await import("/src/camera.js"),
      { WorldManager } = await import("/src/worldManager.js"),
      { Car } = await import("/src/car.js"),
      { Environment } = await import("/src/environment.js");
    const scene = new THREE.Scene(),
      path = new RoadPath("acceptance"),
      world = new WorldManager(scene, path, "meadow", "Low"),
      v = new Vehicle(path),
      rig = new CameraRig(),
      car = new Car(scene);
    world.update(800, 0, true, true);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1280, 800);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style = "position:fixed;inset:0;z-index:9999";
    document.body.appendChild(renderer.domElement);
    const env = new Environment(scene, renderer);
    env.mode = 1;
    let maxStep = 0,
      maxPitch = 0,
      maxPitchStep = 0,
      maxBoundaryPitch = 0;
    const runs = [];
    for (const angle of [0.2, 0.55, 1.1])
      for (const speed of [5, 18, 35])
        for (const entering of [false, true]) {
          v.reset(800, entering ? -6.5 : -2);
          v.heading += entering ? -angle : angle;
          v.speed = speed;
          // Settle at the starting contact height before measuring boundary motion.
          const initialSpeed = v.speed;
          v.speed = 0;
          for (let i = 0; i < 60; i++) v.update(1 / 60, {}, false);
          v.speed = initialSpeed;
          rig.snap = true;
          let previous = v.y,
            previousPitch = v.pitch;
          const surfaces = new Set();
          for (let i = 0; i < 300; i++) {
            v.update(1 / 60, {}, false);
            surfaces.add(v.surface);
            car.place(v);
            rig.update(v, 1 / 60, false, car);
            maxStep = Math.max(maxStep, Math.abs(v.y - previous));
            maxPitch = Math.max(maxPitch, Math.abs(v.pitch));
            maxPitchStep = Math.max(
              maxPitchStep,
              Math.abs(v.pitch - previousPitch),
            );
            if (Math.abs(v.near.offset) < 8)
              maxBoundaryPitch = Math.max(maxBoundaryPitch, Math.abs(v.pitch));
            previousPitch = v.pitch;
            previous = v.y;
          }
          runs.push({
            angle,
            speed,
            entering,
            offset: v.near.offset,
            surfaces: [...surfaces],
          });
        }
    const steering = [];
    for (const speed of [5, 18, 35]) {
      v.reset(800, 0);
      v.speed = speed;
      const heading = v.heading;
      for (let i = 0; i < 36; i++) {
        v.update(1 / 60, { left: true }, false);
        car.place(v);
        rig.update(v, 1 / 60, false, car);
        if (i % 6 === 0) renderer.render(scene, rig.cam);
      }
      steering.push({
        speed,
        headingChange: v.heading - heading,
        offset: v.near.offset,
      });
    }
    const jitter = new CameraRig();
    let cameraTravel = 0,
      vehicleTravel = 0,
      cy = 0,
      vy = 0;
    for (let i = 0; i < 240; i++) {
      const y = Math.sin(i * 1.3) * 0.08;
      jitter.update({ x: 0, y, z: 0, heading: 0, pitch: 0 }, 1 / 60);
      if (i > 60) {
        cameraTravel += Math.abs(jitter.cam.position.y - cy);
        vehicleTravel += Math.abs(y - vy);
      }
      cy = jitter.cam.position.y;
      vy = y;
    }
    v.reset(800, -9);
    v.speed = 0;
    for (let i = 0; i < 120; i++) {
      v.update(1 / 60, {}, false);
      env.update(v, 1 / 60, "meadow", 0, true);
    }
    window.acceptance = {
      scene,
      world,
      v,
      rig,
      car,
      renderer,
      env,
      render(mode) {
        rig.mode = mode;
        rig.snap = true;
        car.setCameraMode(mode);
        car.place(v);
        rig.update(v, 1 / 60, false, car);
        renderer.render(scene, rig.cam);
      },
    };
    window.acceptance.render(0);
    return {
      steering,
      maxStep,
      maxPitch,
      maxPitchStep,
      maxBoundaryPitch,
      cameraJitterRatio: cameraTravel / vehicleTravel,
      runs,
    };
  });
  assert.ok(report.contact.maxStep < 0.14, JSON.stringify(report.contact));
  assert.ok(
    report.contact.maxBoundaryPitch < 0.2,
    JSON.stringify(report.contact),
  );
  assert.ok(report.contact.maxPitchStep < 0.04, JSON.stringify(report.contact));
  assert.ok(
    report.contact.runs.every(
      (r) =>
        r.surfaces.includes("Asphalt") &&
        r.surfaces.some((s) => s !== "Asphalt"),
    ),
    JSON.stringify(report.contact.runs),
  );
  assert.ok(report.contact.cameraJitterRatio < 0.15);
  for (let mode = 0; mode < 4; mode++) {
    await page.evaluate((mode) => window.acceptance.render(mode), mode);
    await page.screenshot({ path: `tests/offroad-camera-${mode}.png` });
  }
  await page.evaluate(() => {
    const a = window.acceptance;
    a.world.dispose();
    a.car.dispose();
    a.renderer.dispose();
    a.renderer.domElement.remove();
  });
  await page.click("#startBtn");
  // Actual keyboard gameplay complements the controlled speed/angle runs above.
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() => window.wanderlane.state.speed > 8, null, {
    timeout: 15000,
  });
  const before = await page.evaluate(() => window.wanderlane.state);
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(650);
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyW");
  report.keyboard = {
    before,
    after: await page.evaluate(() => window.wanderlane.state),
  };
  await page.keyboard.press("KeyH");
  assert.ok((await page.evaluate(() => window.wanderlane.state)).speed < 0.1);
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  touch.on("pageerror", (e) => errors.push(e.message));
  await touch.addInitScript(() =>
    localStorage.setItem(
      "wanderlane-settings",
      JSON.stringify({ driveMode: "endless", quality: "Low" }),
    ),
  );
  await touch.goto("http://127.0.0.1:8123");
  await touch.click("#startBtn");
  const client = await touch.context().newCDPSession(touch);
  const centre = async (key, id) => {
    const b = await touch.locator(`[data-key=${key}]`).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, id };
  };
  const points = [await centre("left", 1), await centre("accel", 2)];
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await touch.waitForTimeout(1200);
  assert.equal(await touch.locator("#touch .pressed").count(), 2);
  assert.ok((await touch.evaluate(() => window.wanderlane.state)).speed > 2);
  await touch.screenshot({ path: "tests/touch-portrait.png" });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.equal(await touch.locator("#touch .pressed").count(), 0);
  await touch.setViewportSize({ width: 844, height: 390 });
  await touch.screenshot({ path: "tests/touch-landscape.png" });
  await touch.click("#settingsBtn");
  assert.equal(await touch.locator("#touch .pressed").count(), 0);
  await touch.close();
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(
    "tests/improvements-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
