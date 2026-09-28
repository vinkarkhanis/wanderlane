import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  const report = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { CityPath } = await import("/src/city/cityPath.js");
    const { CityWorld } = await import("/src/city/cityWorld.js");
    const { STREET_SCENES } = await import("/src/city/puneStreetDetails.js");
    const base = new URL("/assets/cities/pune/", location.href);
    const m = await (await fetch(new URL("manifest.json", base))).json();
    const n = await (await fetch(new URL(m.navigation, base))).json();
    const path = new CityPath(n, m),
      scene = new THREE.Scene();
    const p = STREET_SCENES.find((p) => p.kind === "shops");
    const world = new CityWorld(scene, path, m, base, "Summer", "Medium");
    const player = { ...path.getLanePosition(p.s, -1.6), speed: 0 };
    await world.ready(player);
    const record = [...world.actors.active].find((r) => r.p.id === p.id);
    if (!record) throw Error("Missing shop scene");
    world.actors.pose(record, 0);
    const a = Array.from(record.people.instanceMatrix.array);
    world.actors.update(p, 6, false, 0, "Summer");
    const b = Array.from(record.people.instanceMatrix.array);
    world.actors.update(p, 7, true, 0, "Summer");
    const frozen = Array.from(record.people.instanceMatrix.array);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1440, 900);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style = "position:fixed;inset:0;z-index:99999";
    document.body.append(renderer.domElement);
    scene.background = new THREE.Color(0xc6cfcc);
    scene.add(new THREE.HemisphereLight(0xfff5e4, 0x697567, 2.5));
    const sun = new THREE.DirectionalLight(0xffebcf, 3);
    sun.position.set(-100, 200, 100);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(48, 1440 / 900, 0.1, 500);
    const co = Math.cos(p.yaw),
      si = Math.sin(p.yaw);
    cam.position.set(
      p.x - 18 * si + 3 * co,
      record.y + 4,
      p.z - 18 * co - 3 * si,
    );
    cam.lookAt(p.x, record.y + 1.3, p.z);
    renderer.render(scene, cam);
    window.shopFixture = { world, renderer, scene, cam, record, p };
    return {
      count: record.count,
      shops: world.actors.snapshot.shops,
      moved: a.some((v, i) => v !== b[i]),
      frozen: b.every((v, i) => v === frozen[i]),
      drawCalls: renderer.info.render.calls,
    };
  });
  assert.equal(report.count, 8);
  assert.equal(report.shops, 6);
  assert.ok(report.moved);
  assert.ok(report.frozen);
  await page.screenshot({
    path: "tests/real-pune-after/neighbourhood-shops.png",
  });
  const disposal = await page.evaluate(() => {
    const f = window.shopFixture;
    f.world.dispose();
    f.renderer.render(f.scene, f.cam);
    return f.world.actors.active.size;
  });
  assert.equal(disposal, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
