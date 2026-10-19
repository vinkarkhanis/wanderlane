import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "output/map-expansion",
  baseURL = process.env.GAME_URL || "http://127.0.0.1:8128";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.route("**/expansion-review", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script></head><body style="margin:0"><div id="title" style="position:fixed;top:24px;left:30px;z-index:2;color:#f8eedc;background:#17383cce;padding:14px 20px;font:20px Arial"></div></body></html>',
    }),
  );
  await page.goto(baseURL + "/expansion-review");
  await page.evaluate(async () => {
    const T = await import("/vendor/three.module.js"),
      { CityPath } = await import("/src/city/cityPath.js"),
      { CityWorld } = await import("/src/city/cityWorld.js"),
      { Vehicle } = await import("/src/vehicle.js"),
      { createVehicleModel } = await import("/src/garageVehicle.js"),
      { CameraRig } = await import("/src/camera.js"),
      { Environment } = await import("/src/environment.js");
    const base = new URL("/assets/cities/pune/", location.href),
      m = await (await fetch(new URL("manifest.json", base))).json(),
      nav = await (await fetch(new URL(m.navigation, base))).json();
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(1280, 800);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    let world, car;
    const scene = new T.Scene(),
      env = new Environment(scene, renderer);
    env.mode = 1;
    window.review = async (id, target, stationLook) => {
      world?.dispose();
      car?.dispose();
      const route = nav.explorationRoutes.find((r) => r.id === id) || nav.route,
        path = new CityPath({ ...nav, route, exploration: id !== "mall" }, m);
      world = new CityWorld(scene, path, m, base, "Summer", "Medium");
      const v = new Vehicle(path, "truck");
      v.lane = -1.6;
      let s = 40;
      if (target) {
        const x =
          (((target[1] - m.origin.lon) * Math.PI) / 180) *
          6371008.8 *
          Math.cos((m.origin.lat * Math.PI) / 180);
        const z = (((m.origin.lat - target[0]) * Math.PI) / 180) * 6371008.8;
        s = path.routeNearest(x, z).s;
      }
      if (id === "sus-hills" || id === "bavdhan") {
        const seg = path.segments.reduce((a, b) => (a.y0 > b.y0 ? a : b));
        s = seg.s + seg.length * 0.5;
      }
      v.reset(s, -1.6);
      if (id === "mall") {
        const n = path.findNearestRoadPoint(1660, -1090, {});
        v.x = n.x;
        v.z = n.z;
        v.y = n.y;
        v.heading = n.heading;
      }
      await world.ready(v);
      path.groundHeight = (x, z) => world.heightAt(x, z);
      car = createVehicleModel(scene, v.spec, 0x51736b);
      car.place(v);
      car.setCameraMode(0);
      car.update(0, 0, 0, false);
      env.update(v, 8, "meadow", 0, false);
      const rig = new CameraRig();
      rig.update(v, 0.1, false, car);
      if (id === "mall") {
        rig.cam.position.set(1765, 12, -1110);
        rig.cam.lookAt(1680, 7, -1100);
      }
      if (stationLook) {
        const { stationFrame } = await import("/src/city/swargatePlan.js");
        const f = stationFrame(m.origin),
          y = world.heightAt(f.x, f.z);
        const street = path.surfacePoint(f.x - 69, f.z - 22, {});
        rig.cam.position.set(
          f.x - 69,
          Math.max(y + 6, street.y + 4.5),
          f.z - 22,
        );
        rig.cam.lookAt(f.x - 2, y + 3.2, f.z + 1);
      }
      renderer.render(scene, rig.cam);
      document.getElementById("title").textContent =
        id === "mall"
          ? "Westend Mall · mapped footprint, stylized architecture"
          : route.name + " · stylized scenery / synthetic elevations";
      return {
        id,
        position: { x: v.x, y: v.y, z: v.z },
        chunks: world.chunks.size,
        stats: world.stats,
        geometries: renderer.info.memory.geometries,
        drawCalls: renderer.info.render.calls,
      };
    };
    window.releaseReview = () => {
      world.dispose();
      car.dispose();
      renderer.render(scene, new T.PerspectiveCamera());
      return renderer.info.memory;
    };
  });
  const report = [];
  const views =
    process.env.ROUTE_ID === "sinhgad-swargate"
      ? [
          { id: "sinhgad-swargate", name: "swargate-start" },
          {
            id: "sinhgad-swargate",
            name: "swargate-terminal",
            target: [18.50018, 73.85845],
            stationLook: true,
          },
          {
            id: "sinhgad-swargate",
            name: "sinhgad-flyover",
            target: [18.4855, 73.8281],
          },
          {
            id: "sinhgad-swargate",
            name: "parvati-streets",
            target: [18.4895, 73.846],
          },
        ]
      : [
          "sus-hills",
          "bavdhan",
          "aundh-retail",
          "mall",
          "sinhgad-swargate",
        ].map((id) => ({ id, name: id }));
  for (const view of views) {
    report.push({
      name: view.name,
      ...(await page.evaluate(
        ({ id, target, stationLook }) => window.review(id, target, stationLook),
        view,
      )),
    });
    await page.screenshot({ path: `${dir}/${view.name}-view.png` });
  }
  const disposed = await page.evaluate(() => window.releaseReview());
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/views-report.json`,
    JSON.stringify(
      {
        report,
        disposed,
        errors,
        view: "Production models and streamed world, inspection positions; not a gameplay recording",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ report, disposed, errors }, null, 2));
} finally {
  await browser.close();
}
