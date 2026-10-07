import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.GAME_URL || "http://127.0.0.1:8128";
const dir = "output/garage-realism";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.wanderlane);
  await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { createVehicleModel } = await import("/src/garageVehicle.js");
    const { VEHICLES } = await import("/src/vehicleCatalog.js");
    const canvas = document.createElement("canvas");
    canvas.id = "modelReview";
    canvas.style =
      "position:fixed;inset:0;width:100vw;height:100vh;z-index:10000";
    document.body.append(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(1200, 800);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc7d0d0);
    scene.add(new THREE.HemisphereLight(0xe5f3ff, 0x66614e, 2));
    const sun = new THREE.DirectionalLight(0xfff0d9, 3.5);
    sun.position.set(-3, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -5,
      right: 5,
      top: 5,
      bottom: -5,
    });
    sun.shadow.bias = -0.0001;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb9d6ff, 1.8);
    fill.position.set(6, 3, -5);
    scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xa6b4b4, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(42, 1.5, 0.05, 200);
    const title = document.createElement("div");
    title.style =
      "position:fixed;top:36px;left:44px;z-index:10001;font:24px system-ui;color:#183638;letter-spacing:3px";
    document.body.append(title);
    let model;
    window.modelReview = (id, view) => {
      model?.dispose();
      const spec = VEHICLES.find((v) => v.id === id);
      model = createVehicleModel(scene, spec, 0x477c7c);
      model.place({
        x: 0,
        y: 0,
        z: 0,
        pitch: 0,
        heading: 0,
        roll: 0,
        speed: 0,
      });
      model.setCameraMode(0);
      model.update(0, 0, 0, false);
      const size = id === "bike" ? 0.7 : 1;
      camera.position.set(
        5 * size,
        2.9 * size,
        (view === "rear" ? -6 : 6) * size,
      );
      camera.lookAt(0, id === "bike" ? 0.95 : 0.85, 0);
      title.textContent = spec.name.toUpperCase() + " · " + view.toUpperCase();
      renderer.render(scene, camera);
      return {
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    };
  });
  const report = {};
  for (const id of ["gt", "hatch", "sedan", "suv", "bike", "truck"]) {
    for (const view of ["front", "rear"]) {
      report[`${id}-${view}`] = await page.evaluate(
        ([id, view]) => window.modelReview(id, view),
        [id, view],
      );
      await page.screenshot({ path: `${dir}/${id}-${view}.png` });
    }
    assert.equal(
      report[`${id}-front`].geometries,
      report[`${id}-rear`].geometries,
      `${id} swap leaks geometry`,
    );
    assert.equal(
      report[`${id}-front`].textures,
      report[`${id}-rear`].textures,
      `${id} swap leaks textures`,
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
