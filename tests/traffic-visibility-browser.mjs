import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:8128");
  await page.waitForFunction(() => window.wanderlane);
  const report = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { CityPath } = await import("/src/city/cityPath.js");
    const { CityTraffic } = await import("/src/city/cityTraffic.js");
    const { Traffic } = await import("/src/traffic.js");
    const { RoadPath } = await import("/src/roadPath.js");
    const manifest = await (
      await fetch("/assets/cities/pune/manifest.json")
    ).json();
    const nav = await (
      await fetch("/assets/cities/pune/" + manifest.navigation)
    ).json();
    const path = new CityPath(nav, manifest),
      scene = new THREE.Scene();
    const delta = (a, b, l) => ((((a - b + l / 2) % l) + l) % l) - l / 2;
    let pair;
    for (let a = 0; a < path.length && !pair; a += 25)
      for (let b = a + 650; b < path.length; b += 25) {
        if (Math.abs(delta(a, b, path.length)) < 600) continue;
        const p = path.getLanePosition(a, -1.6, {}),
          q = path.getLanePosition(b, -1.6, {});
        const gap = Math.hypot(p.x - q.x, p.z - q.z);
        if (
          gap > 45 &&
          gap < 100 &&
          Math.abs(path.getCurvatureAtDistance(a)) < 0.03
        ) {
          pair = { a, b, p: { ...p }, q: { ...q }, gap };
          break;
        }
      }
    if (!pair) throw Error("No folded Pune route pair found");
    const traffic = new CityTraffic(scene, path);
    const car = traffic.createCar(0),
      c = {
        car,
        sample: {},
        s: pair.a,
        lane: -1.6,
        direction: 1,
        speed: 0,
        preferred: 0,
      };
    traffic.cars = [c];
    const player = {
      ...pair.q,
      near: { distance: pair.b, routeGap: 0, offset: -1.6 },
      speed: 0,
      flight: "ground",
    };
    const camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 1600);
    camera.position.set(player.x, player.y + 12, player.z);
    camera.lookAt(pair.p.x, pair.p.y + 1, pair.p.z);
    traffic.setView(camera);
    traffic.place(c, 0, 0);
    const oldPosition = car.group.position.clone();
    // Exercise the old distance-only recycle trigger on the real route.
    traffic.spawn(c, player);
    const legacyJump = car.group.position.distanceTo(oldPosition);
    c.s = pair.a;
    c.speed = c.preferred = 0;
    c.waiting = false;
    c.car.group.visible = true;
    c.recycleDelay = 0;
    traffic.place(c, 0, 0);
    let spawns = 0;
    const spawn = traffic.spawn.bind(traffic);
    traffic.spawn = (...args) => {
      spawns++;
      return spawn(...args);
    };
    for (let i = 0; i < 180; i++) traffic.update(1 / 60, player, 0);
    const city = {
      routeGap: Math.abs(delta(pair.a, pair.b, path.length)),
      physicalGap: pair.gap,
      legacyJump,
      spawns,
      visible: c.car.group.visible,
      movement: car.group.position.distanceTo(oldPosition),
    };
    traffic.dispose();

    const road = new RoadPath("visibility-regression"),
      endless = new Traffic(scene, road);
    const p = road.getLanePosition(40, 2, {});
    const driver = {
      ...p,
      near: { distance: 40, offset: 2 },
      speed: 0,
      flight: "ground",
    };
    const e = {
      car: endless.createCar(0),
      sample: {},
      s: 700,
      lane: 2,
      direction: 1,
      speed: 0,
      preferred: 0,
    };
    endless.cars = [e];
    endless.place(e, 0, 0);
    camera.position.set(driver.x, driver.y + 65, driver.z);
    camera.lookAt(
      e.car.group.position.x,
      e.car.group.position.y + 1,
      e.car.group.position.z,
    );
    endless.setView(camera);
    let recycled = 0;
    const originalSpawn = endless.spawn.bind(endless);
    endless.spawn = (...args) => {
      recycled++;
      return originalSpawn(...args);
    };
    for (let i = 0; i < 120; i++) endless.update(1 / 60, driver, 0);
    const onScreen = {
      spawns: recycled,
      visible: e.car.group.visible,
      distance: e.s,
    };
    camera.lookAt(driver.x, driver.y + 65, driver.z - 100);
    endless.setView(camera);
    for (let i = 0; i < 30; i++) endless.update(1 / 60, driver, 0);
    const gracePeriodSpawns = recycled;
    for (let i = 0; i < 90; i++) endless.update(1 / 60, driver, 0);
    const offScreenSpawns = recycled;
    e.s = 700;
    e.speed = e.preferred = 0;
    e.recycleDelay = 0;
    endless.place(e, 0, 0);
    camera.lookAt(
      e.car.group.position.x,
      e.car.group.position.y + 1,
      e.car.group.position.z,
    );
    endless.setView(camera, 200);
    const beforeFog = recycled;
    for (let i = 0; i < 120; i++) endless.update(1 / 60, driver, 0);
    const fogSpawns = recycled - beforeFog;
    endless.dispose();
    return { city, onScreen, gracePeriodSpawns, offScreenSpawns, fogSpawns };
  });
  assert.ok(
    report.city.legacyJump > 5,
    "old rule must reproduce a visible traffic jump",
  );
  assert.equal(report.city.spawns, 0);
  assert.equal(report.city.visible, true);
  assert.ok(report.city.movement < 0.01);
  assert.equal(report.onScreen.spawns, 0);
  assert.equal(report.onScreen.visible, true);
  assert.equal(report.gracePeriodSpawns, 0);
  assert.ok(report.offScreenSpawns > 0, "off-screen traffic still recycles");
  assert.ok(report.fogSpawns > 0, "traffic hidden beyond fog still recycles");
  assert.deepEqual(errors, []);
  await mkdir("output/traffic-visibility", { recursive: true });
  await writeFile(
    "output/traffic-visibility/report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
