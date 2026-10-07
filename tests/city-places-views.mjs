import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "output/city-places",
  errors = [],
  report = [];
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/places-review", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script></head><body style="margin:0"><div id="title" style="position:fixed;top:24px;left:30px;z-index:2;color:#f8eedc;background:#17383cce;padding:14px 20px;font:20px Arial"></div></body></html>',
    }),
  );
  await page.goto("http://127.0.0.1:8128/places-review");
  await page.evaluate(async () => {
    const T = await import("/vendor/three.module.js"),
      { RoadPath } = await import("/src/roadPath.js"),
      { WorldManager } = await import("/src/worldManager.js"),
      { Vehicle } = await import("/src/vehicle.js"),
      { createVehicleModel } = await import("/src/garageVehicle.js"),
      { CameraRig } = await import("/src/camera.js"),
      { Environment } = await import("/src/environment.js");
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(1440, 900);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene(),
      env = new Environment(scene, renderer);
    let world, car;
    window.reviewCityPlace = (kind) => {
      world?.dispose();
      car?.dispose();
      const path = new RoadPath("aster-2026");
      path.urban = true;
      const positions = {
        mall: 100,
        hotel: 420,
        lake: 910,
        hills: 1750,
        temple: 2460,
        park: 4230,
        skyline: 3300,
      };
      const v = new Vehicle(path, "gt");
      v.reset(positions[kind], -2);
      world = new WorldManager(scene, path, "meadow", "Medium");
      world.update(v.near.distance, 0, false, true);
      let terrainClearance = Infinity;
      for (const [index, chunk] of world.chunks) {
        for (let ds = 8; ds < 152; ds += 4) {
          const s = index * 160 + ds;
          for (const offset of [-4.4, -2, 0, 2, 4.4]) {
            const q = path.getLanePosition(s, offset);
            terrainClearance = Math.min(
              terrainClearance,
              q.y - chunk.terrain.userData.heightAt(q.x, q.z),
            );
          }
        }
      }
      car = createVehicleModel(scene, v.spec, 0x51736b);
      car.place(v);
      car.update(0, 0, 0, false);
      env.mode = kind === "skyline" ? 2 : 1;
      env.update(v, 0.1, "meadow", 0, false);
      const rig = new CameraRig();
      rig.update(v, 0.1, false, car);
      renderer.render(scene, rig.cam);
      const place = world.places.find(
        (p) =>
          p.kind === (kind === "skyline" ? "hotel" : kind) &&
          Math.abs(p.s - positions[kind]) < 100,
      );
      document.getElementById("title").textContent =
        (place?.name || kind) +
        " · fictional Pune-inspired place · driving camera";
      return {
        kind,
        s: v.near.distance,
        places: world.places,
        buildings: world.settlementCount,
        chunks: world.chunks.size,
        drawCalls: renderer.info.render.calls,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        terrainClearance,
      };
    };
    window.releaseCityPlaces = () => {
      world.dispose();
      car.dispose();
      renderer.render(scene, new T.PerspectiveCamera());
      return { ...renderer.info.memory, chunks: world.chunks.size };
    };
  });
  for (const kind of [
    "mall",
    "hotel",
    "lake",
    "hills",
    "temple",
    "skyline",
    "park",
  ]) {
    const r = await page.evaluate((kind) => window.reviewCityPlace(kind), kind);
    assert.ok(
      r.places.some((p) => p.kind === (kind === "skyline" ? "hotel" : kind)),
    );
    assert.equal(r.chunks, 9);
    assert.ok(
      r.terrainClearance > 0.05,
      `${kind}: green terrain must remain below asphalt`,
    );
    report.push(r);
    await page.screenshot({ path: `${dir}/${kind}.png` });
  }
  const disposed = await page.evaluate(() => window.releaseCityPlaces());
  assert.equal(disposed.chunks, 0);
  assert.ok(disposed.textures < 8);
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/views-report.json`,
    JSON.stringify({ report, disposed, errors }, null, 2),
  );
  console.log(JSON.stringify({ report, disposed, errors }));
} finally {
  await browser.close();
}
