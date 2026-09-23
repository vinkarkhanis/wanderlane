import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(180000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  const report = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js"),
      { CityPath } = await import("/src/city/cityPath.js"),
      { CityWorld } = await import("/src/city/cityWorld.js"),
      { CityTraffic } = await import("/src/city/cityTraffic.js"),
      { Vehicle } = await import("/src/vehicle.js"),
      { Car } = await import("/src/car.js"),
      { Environment } = await import("/src/environment.js");
    const base = new URL("/assets/cities/pune/", location.href),
      manifest = await (await fetch(new URL("manifest.json", base))).json(),
      nav = await (await fetch(new URL(manifest.navigation, base))).json();
    const scene = new THREE.Scene(),
      path = new CityPath(nav, manifest),
      world = new CityWorld(scene, path, manifest, base, "Summer", "Medium"),
      vehicle = new Vehicle(path);
    vehicle.lane = -1.6;
    vehicle.reset(40, -1.6);
    path.groundHeight = (x, z) => world.heightAt(x, z);
    path.resolveContacts = (v, dt) => world.constrain(v, dt);
    await world.ready(vehicle);
    let last = vehicle.near.distance,
      laps = 0,
      maxGap = 0,
      cell = "",
      maxChunks = 0,
      frames = 0;
    for (let i = 0; i < 160000; i++) {
      const key =
        Math.floor(vehicle.x / 256) + "," + Math.floor(vehicle.z / 256);
      if (key !== cell) {
        await world.ready(vehicle);
        cell = key;
        maxChunks = Math.max(maxChunks, world.chunks.size);
      }
      vehicle.update(1 / 60, {}, true);
      maxGap = Math.max(maxGap, vehicle.near.routeGap);
      if (last > path.length - 100 && vehicle.near.distance < 100) {
        laps++;
        frames = i;
        break;
      }
      last = vehicle.near.distance;
    }
    const traffic = new CityTraffic(scene, path);
    traffic.setMode(2, vehicle);
    const activeTraffic = traffic.cars.filter((c) => c.car.group.visible);
    if (activeTraffic.length < 5)
      throw Error("Too few safe traffic spawns: " + activeTraffic.length);
    for (const c of activeTraffic) {
      if (path.nearJunction(c.s)) throw Error("Spawn inside junction");
      if (Math.hypot(c.sample.x - vehicle.x, c.sample.z - vehicle.z) < 85)
        throw Error("Spawn too close to player");
    }
    let minGap = Infinity;
    for (let i = 0; i < 6000; i++) {
      vehicle.update(1 / 60, {}, true, "meadow", traffic);
      traffic.update(1 / 60, vehicle, 0.8);
      for (let a = 0; a < traffic.cars.length; a++)
        for (let b = a + 1; b < traffic.cars.length; b++) {
          if (traffic.cars[a].waiting || traffic.cars[b].waiting) continue;
          const ca = traffic.cars[a].sample,
            cb = traffic.cars[b].sample;
          minGap = Math.min(minGap, Math.hypot(ca.x - cb.x, ca.z - cb.z));
        }
    }
    traffic.dispose();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1440, 900);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style = "position:fixed;inset:0;z-index:9998";
    document.body.appendChild(renderer.domElement);
    const caption = document.createElement("div");
    caption.style =
      "position:fixed;bottom:8px;left:20px;color:white;background:#163034;padding:8px;font:12px sans-serif;z-index:9999";
    caption.textContent =
      "Pune pilot · Synthetic terrain · Map data © OpenStreetMap contributors, available under ODbL 1.0.";
    document.body.appendChild(caption);
    const env = new Environment(scene, renderer),
      cam = new THREE.PerspectiveCamera(58, 1440 / 900, 0.1, 1600),
      car = new Car(scene, 0x477c7c);
    env.mode = 1;
    const render = () => {
      for (let i = 0; i < 120; i++)
        env.update(vehicle, 1 / 60, "meadow", 0, true);
      world.update(vehicle, 0, true, env.night);
      car.place(vehicle, true);
      cam.position.set(
        vehicle.x - Math.sin(vehicle.heading) * 9,
        vehicle.y + 4,
        vehicle.z - Math.cos(vehicle.heading) * 9,
      );
      cam.lookAt(
        vehicle.x + Math.sin(vehicle.heading) * 15,
        vehicle.y + 1,
        vehicle.z + Math.cos(vehicle.heading) * 15,
      );
      renderer.render(scene, cam);
    };
    vehicle.reset(2400, -1.6);
    await world.ready(vehicle);
    render();
    window.cityPreview = {
      world,
      path,
      vehicle,
      renderer,
      cam,
      car,
      env,
      scene,
      render,
    };
    return {
      laps,
      frames,
      maxGap,
      maxChunks,
      minTrafficGap: minGap,
      city: world.stats,
    };
  });
  assert.equal(report.laps, 1, "auto failed with streamed building contacts");
  assert.ok(report.maxChunks <= 25);
  assert.ok(report.minTrafficGap > 4.5);
  await page.screenshot({ path: "tests/pune-dense.png" });
  await page.evaluate(async () => {
    const p = window.cityPreview;
    const { project } = await import("/src/city/projection.js");
    const [x, z] = project(18.5357, 73.7851, p.path.manifest.origin);
    p.vehicle.x = x;
    p.vehicle.z = z;
    p.vehicle.y = 0;
    await p.world.ready(p.vehicle);
    for (let i = 0; i < 120; i++)
      p.env.update(p.vehicle, 1 / 60, "meadow", 0, true);
    p.car.group.visible = false;
    p.cam.position.set(x + 220, 115, z + 220);
    p.cam.lookAt(x, 0, z);
    p.renderer.render(p.scene, p.cam);
  });
  await page.screenshot({ path: "tests/pune-lake.png" });
  report.memory = await page.evaluate(async () => {
    const p = window.cityPreview,
      counts = [];
    for (let i = 0; i < 12; i++) {
      p.vehicle.reset(i % 2 ? 2400 : 40, -1.6);
      await p.world.ready(p.vehicle);
      p.world.setSeason(["Summer", "Monsoon", "Winter"][i % 3]);
      p.render();
      counts.push({ ...p.renderer.info.memory, chunks: p.world.chunks.size });
    }
    p.world.dispose();
    p.car.dispose();
    p.renderer.render(p.scene, p.cam);
    return { counts, disposed: { ...p.renderer.info.memory } };
  });
  assert.deepEqual(report.memory.counts[4], report.memory.counts[10]);
  assert.deepEqual(report.memory.counts[5], report.memory.counts[11]);
  assert.deepEqual(errors, []);
  await writeFile(
    "tests/pune-world-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log("Pune world checks", JSON.stringify(report));
} finally {
  await browser.close();
}
