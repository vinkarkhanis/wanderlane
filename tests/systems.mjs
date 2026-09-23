import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8123");
await page.waitForFunction(() => window.wanderlane);
try {
  const results = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { RoadPath } = await import("/src/roadPath.js");
    const { Vehicle } = await import("/src/vehicle.js");
    const { Traffic } = await import("/src/traffic.js");
    const { Car } = await import("/src/car.js");
    const { WorldManager } = await import("/src/worldManager.js");
    const scene = new THREE.Scene(),
      path = new RoadPath("traffic-check"),
      vehicle = new Vehicle(path),
      traffic = new Traffic(scene, path);
    traffic.setMode(2, vehicle);
    let minimum = Infinity,
      maxOffset = 0;
    for (let i = 0; i < 18000; i++) {
      vehicle.update(1 / 60, {}, true, "meadow", traffic);
      traffic.update(1 / 60, vehicle, 0.8);
      if (i > 600)
        maxOffset = Math.max(maxOffset, Math.abs(vehicle.near.offset - 2));
      for (let a = 0; a < traffic.cars.length; a++)
        for (let b = a + 1; b < traffic.cars.length; b++) {
          const ca = traffic.cars[a],
            cb = traffic.cars[b];
          if (ca.lane === cb.lane)
            minimum = Math.min(minimum, Math.abs(ca.s - cb.s));
        }
    }
    const hero = new Car(scene);
    const bounds = new THREE.Box3()
      .setFromObject(hero.group)
      .getSize(new THREE.Vector3());
    hero.dispose();
    traffic.dispose();
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(320, 200);
    const camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 1200);
    const counts = [];
    const world = new WorldManager(scene, path, "meadow", "Low");
    for (let i = 0; i < 30; i++) {
      const s = i * 1600,
        p = path.sampleAtDistance(s);
      world.update(s, 0, false, true);
      camera.position.set(p.x, p.y + 6, p.z - 15);
      camera.lookAt(p.x, p.y, p.z + 30);
      renderer.render(scene, camera);
      counts.push({
        chunks: world.chunks.size,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      });
    }
    world.dispose();
    renderer.render(scene, camera);
    const disposed = {
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    };
    renderer.dispose();
    return {
      trafficMinimumGap: minimum,
      maxLaneError: maxOffset,
      trafficDriveKm: vehicle.dist,
      carSize: bounds.toArray(),
      chunks: counts,
      disposed,
    };
  });
  assert.ok(results.trafficMinimumGap >= 5.3);
  assert.ok(results.maxLaneError < 0.6);
  assert.ok(results.carSize[2] > 4.3 && results.carSize[2] < 4.8);
  assert.ok(results.chunks.every((c) => c.chunks === 9));
  assert.equal(results.disposed.geometries, 0);
  assert.equal(results.disposed.textures, 0);
  await writeFile(
    "tests/systems-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
