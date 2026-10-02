import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) errors.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:8123");
  await page
    .waitForFunction(() => window.wanderlane)
    .catch(async (error) => {
      console.error(
        "Startup diagnostics",
        errors,
        await page.evaluate(() => ({
          ready: document.readyState,
          button: document.getElementById("startBtn").textContent,
          body: document.body.innerText.slice(-600),
        })),
      );
      throw error;
    });
  assert.equal(
    await page.evaluate(() => window.wanderlane.state.audioNodes),
    0,
  );
  await page.click("#startBtn");
  await page.click("#settingsBtn");
  const report = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js"),
      { CityPath } = await import("/src/city/cityPath.js"),
      { CityWorld } = await import("/src/city/cityWorld.js"),
      { CityTraffic } = await import("/src/city/cityTraffic.js"),
      { CitySignals, signalOffset } = await import("/src/city/citySignals.js"),
      { Environment } = await import("/src/environment.js");
    const base = new URL("/assets/cities/pune/", location.href),
      m = await (await fetch(new URL("manifest.json", base))).json(),
      n = await (await fetch(new URL(m.navigation, base))).json();
    const path = new CityPath(n, m),
      scene = new THREE.Scene(),
      world = new CityWorld(scene, path, m, base, "Summer", "Medium"),
      lights = new CitySignals(path),
      traffic = new CityTraffic(scene, path);
    scene.background = new THREE.Color(0xb59a8b);
    const light = lights.items[0],
      player = {
        ...path.getLanePosition(light.s - 220, -1.6),
        near: { distance: light.s - 220, routeGap: 0 },
        speed: 0,
      };
    world.signals = lights;
    await world.ready(player);
    traffic.signals = lights;
    lights.time = 22 - signalOffset(light.id);
    traffic.setMode(2, player);
    const initial = traffic.cars
      .filter((c) => !c.waiting)
      .map((c) => ({
        s: c.s,
        type: c.car.type,
        halfLength: c.car.bounds.halfLength,
        junction: path.nearJunction(c.s),
        distance: Math.hypot(c.sample.x - player.x, c.sample.z - player.z),
      }));
    for (let i = 0; i < traffic.cars.length; i++) {
      const c = traffic.cars[i];
      c.s = light.s - 12 - i * 16;
      c.speed = 4;
      c.waiting = false;
      c.car.group.visible = true;
      traffic.place(c, 0, 0);
    }
    for (let i = 0; i < 1200; i++) traffic.update(1 / 60, player, 0.25);
    const stopped = traffic.cars.map((c) => ({
      s: c.s,
      speed: c.speed,
      type: c.car.type,
      halfLength: c.car.bounds.halfLength,
    }));
    // Exercise a slow-frame catch-up; front bounds must still hold.
    traffic.update(2, player, 0.25);
    const catchup = traffic.cars.map((c) => ({
      s: c.s,
      speed: c.speed,
      halfLength: c.car.bounds.halfLength,
    }));
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1440, 900);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.id = "cityFixture";
    renderer.domElement.style = "position:fixed;inset:0;z-index:9999";
    document.body.append(renderer.domElement);
    const env = new Environment(scene, renderer),
      cam = new THREE.PerspectiveCamera(48, 1440 / 900, 0.1, 700);
    env.mode = 2;
    const p = path.getLanePosition(light.s - 28, -1.6);
    cam.position.set(
      p.x + p.nx * 25 - p.tx * 24,
      p.y + 14,
      p.z + p.nz * 25 - p.tz * 24,
    );
    cam.lookAt(p.x, p.y + 1, p.z);
    world.update(player, 0, true, 0.25, true);
    world.signalView.update(lights.time);
    env.update(player, 1, "meadow", 0, true);
    renderer.render(scene, cam);
    window.cityFixture = {
      renderer,
      scene,
      world,
      lights,
      traffic,
      player,
      env,
      cam,
      light,
    };
    return { initial, stopped, catchup, heads: world.signalView.heads.size };
  });
  assert.ok(report.heads >= 1);
  assert.equal(new Set(report.initial.map((c) => c.type)).size, 4);
  for (const c of report.initial) {
    assert.equal(c.junction, false);
    assert.ok(c.distance >= 42);
  }
  for (let i = 0; i < report.initial.length; i++)
    for (let j = i + 1; j < report.initial.length; j++)
      assert.ok(
        Math.abs(report.initial[i].s - report.initial[j].s) >
          report.initial[i].halfLength + report.initial[j].halfLength,
      );
  assert.ok(report.stopped[0].speed < 0.05);
  for (const list of [report.stopped, report.catchup])
    for (let i = 1; i < list.length; i++)
      assert.ok(
        list[i - 1].s - list[i].s >=
          list[i - 1].halfLength + list[i].halfLength + 1.99,
      );
  await page.evaluate(() => document.getElementById("settings").close());
  await page.screenshot({ path: "tests/chai-mixed-traffic-red.png" });
  report.green = await page.evaluate(async () => {
    const f = window.cityFixture,
      { signalOffset } = await import("/src/city/citySignals.js");
    f.lights.time = -signalOffset(f.light.id);
    for (let i = 0; i < 180; i++) f.traffic.update(1 / 60, f.player, 0.25);
    f.world.signalView.update(f.lights.time);
    f.renderer.render(f.scene, f.cam);
    return f.traffic.cars.map((c) => c.speed);
  });
  assert.ok(report.green[0] > 1);
  await page.screenshot({ path: "tests/chai-mixed-traffic-green.png" });
  report.budgets = await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { CityTraffic } = await import("/src/city/cityTraffic.js");
    const f = window.cityFixture,
      scene = new THREE.Scene(),
      probe = new CityTraffic(scene, f.world.path),
      counts = {};
    for (const quality of ["Low", "Medium", "High"]) {
      probe.quality = quality;
      counts[quality] = [];
      for (const mode of [0, 1, 2]) {
        probe.setMode(mode, f.player);
        counts[quality].push(probe.cars.length);
      }
    }
    probe.dispose();
    if (scene.children.length)
      throw Error("Quality traffic probe leaked scene objects");
    return counts;
  });
  assert.deepEqual(report.budgets, {
    Low: [0, 6, 12],
    Medium: [0, 9, 20],
    High: [0, 12, 28],
  });
  report.dispose = await page.evaluate(() => {
    const f = window.cityFixture;
    let resources = 0,
      disposed = 0;
    for (const c of [...f.traffic.cars, ...f.traffic.pool])
      for (const r of [
        c.car.box,
        c.car.wheelGeometry,
        c.car.wheels,
        ...c.car.materials,
        ...(c.car.modelGeometries || []),
      ]) {
        resources++;
        r.addEventListener("dispose", () => disposed++);
      }
    f.traffic.dispose();
    f.world.dispose();
    f.lights.dispose();
    f.renderer.dispose();
    f.renderer.domElement.remove();
    delete window.cityFixture;
    return { resources, disposed };
  });
  assert.equal(report.dispose.resources, report.dispose.disposed);
  report.audio = await page.evaluate(async () => {
    const { AudioSystem } = await import("/src/audio.js"),
      a = new AudioSystem(),
      v = { speed: 8, throttle: 0.2, surface: "Asphalt" };
    await a.start();
    const settle = () => new Promise((r) => setTimeout(r, 600));
    a.update(v, 0.3, false, { time: 4, district: "Baner", season: "Summer" });
    await settle();
    const city = a.cityNoiseGain.gain.value,
      nodes = a.nodes.length;
    a.update(v, 0.3, false, null);
    await settle();
    const endless = a.cityNoiseGain.gain.value;
    a.update(v, 0.3, true, { time: 4, district: "Baner", season: "Summer" });
    await settle();
    const paused = a.gain.gain.value;
    a.muted = true;
    a.update(v, 0.3, false, { time: 4, district: "Baner", season: "Summer" });
    await settle();
    const muted = a.gain.gain.value;
    a.muted = false;
    a.ambience = 0;
    a.engine = 0;
    a.update(v, 0.3, false, { time: 4, district: "Baner", season: "Monsoon" });
    await settle();
    const ambience = a.cityNoiseGain.gain.value,
      engine = a.motorGain.gain.value;
    for (let i = 0; i < 20; i++)
      a.update(
        v,
        0,
        false,
        i % 2
          ? null
          : { time: i, district: "Pashan approach", season: "Winter" },
      );
    const finalNodes = a.nodes.length;
    await a.ctx.close();
    return {
      city,
      endless,
      paused,
      muted,
      ambience,
      engine,
      nodes,
      finalNodes,
    };
  });
  assert.ok(report.audio.city > 0.01);
  for (const k of ["endless", "paused", "muted", "ambience", "engine"])
    assert.ok(report.audio[k] < 0.005, k + JSON.stringify(report.audio));
  assert.equal(report.audio.nodes, report.audio.finalNodes);
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(
    "tests/chai-systems-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "Mixed fleet, queue, bounds, disposal and city audio passed",
    JSON.stringify(report),
  );
} finally {
  await browser.close();
}
