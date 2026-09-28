import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [],
  report = {};
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.click("#settingsBtn");
  await page.evaluate(() => document.querySelector("dialog[open]").close());
  await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js"),
      { CityPath } = await import("/src/city/cityPath.js"),
      { CityWorld } = await import("/src/city/cityWorld.js"),
      { CityTraffic } = await import("/src/city/cityTraffic.js"),
      { Vehicle } = await import("/src/vehicle.js"),
      { Car } = await import("/src/car.js"),
      { Environment } = await import("/src/environment.js"),
      { resetTrafficImpact } = await import("/src/trafficCollisions.js");
    const base = new URL("/assets/cities/pune/", location.href),
      manifest = await (await fetch(new URL("manifest.json", base))).json(),
      nav = await (await fetch(new URL(manifest.navigation, base))).json();
    const path = new CityPath(nav, manifest),
      scene = new THREE.Scene(),
      world = new CityWorld(scene, path, manifest, base, "Summer", "Medium"),
      v = new Vehicle(path),
      traffic = new CityTraffic(scene, path),
      car = new Car(scene);
    v.reset(9775);
    const start = path.getLanePosition(9775, -1.6, {});
    Object.assign(v, start);
    v.x += start.nx * 0.9;
    v.z += start.nz * 0.9;
    v.speed = 24;
    path.findNearestRoadPoint(v.x, v.z, v.near, v.y);
    await world.ready(v);
    traffic.setMode(1, v);
    traffic.cars.forEach((c, i) => {
      resetTrafficImpact(c);
      c.waiting = false;
      c.car.group.visible = true;
      c.s = 9788 + i * 30;
      c.preferred = c.speed = 0;
      traffic.place(c, 0, 0.25);
    });
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1440, 900);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style = "position:fixed;inset:0;z-index:9999";
    document.body.append(renderer.domElement);
    scene.background = new THREE.Color(0xb7a895);
    const env = new Environment(scene, renderer);
    env.mode = 2;
    const cam = new THREE.PerspectiveCamera(48, 1.6, 0.1, 700),
      p = path.getLanePosition(9788, -1.6, {});
    cam.position.set(
      p.x + p.nx * 16 - p.tx * 15,
      p.y + 9,
      p.z + p.nz * 16 - p.tz * 15,
    );
    cam.lookAt(p.x, p.y + 1, p.z);
    const render = () => {
      car.place(v);
      car.update(0, v.speed, 0.25, v.braking);
      world.update(v, 0, true, 0.25, true);
      env.update(v, 1, "meadow", 0, true);
      renderer.render(scene, cam);
    };
    window.crashFixture = {
      traffic,
      v,
      path,
      world,
      car,
      renderer,
      scene,
      cam,
      env,
      render,
      resetTrafficImpact,
    };
    render();
  });
  await page.screenshot({ path: "tests/collision-before.png" });
  report.impact = await page.evaluate(() => {
    const f = window.crashFixture;
    let at = -1,
      maxYaw = 0,
      maxSlide = 0,
      frontSpeed = 0;
    for (let i = 0; i < 90; i++) {
      f.v.update(1 / 60, {}, false, "meadow", f.traffic);
      f.traffic.update(1 / 60, f.v, 0.25);
      if (at < 0 && f.traffic.collisions.count) at = i;
      maxYaw = Math.max(
        maxYaw,
        Math.abs(f.v.impactYaw),
        ...f.traffic.cars.map((c) => Math.abs(c.impactHeading)),
      );
      maxSlide = Math.max(
        maxSlide,
        ...f.traffic.cars.map((c) => Math.hypot(c.impactX, c.impactZ)),
      );
      frontSpeed = Math.max(frontSpeed, f.traffic.cars[0].speed);
      if (at >= 0 && i > at + 24) break;
    }
    f.render();
    return {
      at,
      maxYaw,
      maxSlide,
      frontSpeed,
      collisions: f.traffic.collisions.snapshot,
    };
  });
  assert.ok(report.impact.at >= 0, JSON.stringify(report.impact));
  assert.ok(report.impact.maxYaw > 0.05);
  assert.ok(report.impact.maxSlide > 0.05);
  assert.ok(report.impact.frontSpeed > 1);
  await page.screenshot({ path: "tests/collision-glancing.png" });
  report.recovery = await page.evaluate(() => {
    const f = window.crashFixture;
    f.path.resetNearest(f.v);
    const reset = {
      yaw: f.v.impactYaw,
      slide: Math.hypot(f.v.impactVX, f.v.impactVZ),
    };
    f.v.reset(9750);
    f.traffic.cars.forEach((c) => (c.preferred = c.car.spec.speed));
    for (let i = 0; i < 1200; i++) f.traffic.update(1 / 60, f.v, 0.25);
    const offsets = f.traffic.cars.map((c) => Math.hypot(c.impactX, c.impactZ));
    const stable = f.traffic.cars.every(
      (c) => Number.isFinite(c.sample.x) && Number.isFinite(c.speed),
    );
    f.render();
    return { reset, offsets, stable };
  });
  assert.deepEqual(report.recovery.reset, { yaw: 0, slide: 0 });
  assert.ok(report.recovery.stable);
  assert.ok(Math.max(...report.recovery.offsets) < 0.01);
  report.ai = await page.evaluate(() => {
    const f = window.crashFixture,
      [a, b] = f.traffic.cars;
    f.traffic.collisions.reset();
    f.traffic.cars.forEach((c) => f.resetTrafficImpact(c));
    // Stage an off-centre AI contact. No player is anywhere near it.
    a.s = 9775;
    b.s = 9775 + a.car.bounds.halfLength + b.car.bounds.halfLength - 0.35;
    for (const c of [a, b]) {
      c.waiting = false;
      c.car.group.visible = true;
    }
    a.lane = b.lane = -1.6;
    a.speed = 20;
    b.speed = 0;
    const pose = f.path.getLanePosition(a.s, -1.6, {});
    a.impactX = pose.nx * 0.8;
    a.impactZ = pose.nz * 0.8;
    f.traffic.place(a, 0, 0.25);
    f.traffic.place(b, 0, 0.25);
    f.traffic.resolveCollisions(1 / 60, f.v, 0.25);
    const hit = f.traffic.collisions.snapshot;
    const yawImpulse = b.impactYaw;
    for (let i = 0; i < 20; i++) f.traffic.update(1 / 60, f.v, 0.25);
    return {
      hit,
      yawImpulse,
      rotation: b.impactHeading,
      speed: b.speed,
      playerDistance: f.v.near.distance,
      s: b.s,
    };
  });
  assert.ok(report.ai.hit.count > 0);
  assert.equal(report.ai.hit.last.player, false);
  assert.ok(Math.abs(report.ai.yawImpulse) > 0.05, JSON.stringify(report.ai));
  assert.ok(report.ai.speed > 0);
  report.disposal = await page.evaluate(() => {
    const f = window.crashFixture;
    f.traffic.dispose();
    f.car.dispose();
    f.world.dispose();
    f.renderer.dispose();
    f.renderer.domElement.remove();
    return {
      cars: f.traffic.cars.length,
      cooldowns: f.traffic.collisions.cooldowns.size,
    };
  });
  assert.deepEqual(report.disposal, { cars: 0, cooldowns: 0 });
  assert.deepEqual(errors, []);
  // Real gameplay path: visible controls and keyboard only, no teleport or
  // mutable application hooks. Feedback steering aims at the first traffic car.
  await page.reload();
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.click("#tripStart");
  await page.keyboard.press("g");
  await page.keyboard.down("w");
  let held = "",
    previous = null;
  for (let i = 0; i < 240; i++) {
    const s = await page.evaluate(() => window.wanderlane.state);
    if (s.collisions.count) {
      report.keyboard = { hit: s.collisions, impact: s.impact };
      break;
    }
    const c = s.trafficCars[0].position,
      target = Math.atan2(c.x - s.position.x, c.z - s.position.z),
      error = Math.atan2(
        Math.sin(target - s.heading),
        Math.cos(target - s.heading),
      );
    const yaw =
      previous === null
        ? 0
        : Math.atan2(
            Math.sin(s.heading - previous),
            Math.cos(s.heading - previous),
          ) / 0.08;
    previous = s.heading;
    const command = error * 4 - yaw * 0.6,
      key = Math.abs(command) < 0.04 ? "" : command > 0 ? "a" : "d";
    if (key !== held) {
      if (held) await page.keyboard.up(held);
      if (key) await page.keyboard.down(key);
      held = key;
    }
    await page.waitForTimeout(80);
  }
  if (held) await page.keyboard.up(held);
  await page.keyboard.up("w");
  assert.ok(
    report.keyboard?.hit.count > 0,
    "Keyboard drive must actually hit traffic",
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: "tests/collision-keyboard.png" });
  await page.keyboard.press("h");
  assert.deepEqual(await page.evaluate(() => window.wanderlane.state.impact), {
    lateralSpeed: 0,
    yawRate: 0,
  });
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(
    "tests/collision-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
