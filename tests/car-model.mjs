import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
const issues = [];
page.on("requestfailed", (r) =>
  issues.push(r.url() + ": " + r.failure()?.errorText),
);
page.on("pageerror", (e) => issues.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) issues.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.evaluate(async () => {
    const THREE = await import("/vendor/three.module.js");
    const { Car } = await import("/src/car.js");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x293c43);
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setSize(1200, 850);
    r.setPixelRatio(1);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.domElement.style = "position:fixed;inset:0;z-index:9999";
    document.body.appendChild(r.domElement);
    const car = new Car(scene, 0x477c7c);
    car.update(0, 0, 0, false);
    const hemi = new THREE.HemisphereLight(0xc8deea, 0x6b695b, 2);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffedd0, 3);
    sun.position.set(-4, 8, 5);
    scene.add(sun);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x33454b, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(38, 1200 / 850, 0.05, 250);
    window.preview = { scene, r, car, camera };
    camera.position.set(5, 2.5, 6);
    camera.lookAt(0, 0.8, 0);
    r.render(scene, camera);
  });
  await page.screenshot({ path: "tests/aster-front.png" });
  await page.evaluate(() => {
    const { camera, r, scene } = window.preview;
    camera.position.set(-5, 2.6, -6);
    camera.lookAt(0, 0.8, 0);
    r.render(scene, camera);
  });
  await page.screenshot({ path: "tests/aster-rear.png" });
  const resources = await page.evaluate(async () => {
    const { Car } = await import("/src/car.js");
    const { scene, r, camera, car } = window.preview;
    car.dispose();
    r.render(scene, camera);
    const baseline = { ...r.info.memory },
      cycles = [];
    for (let i = 0; i < 4; i++) {
      const candidate = new Car(scene);
      candidate.setCameraMode(3);
      candidate.update(0, 20, 1, true);
      candidate.cockpit.update(20, 0.5, true);
      r.render(scene, camera);
      candidate.dispose();
      r.render(scene, camera);
      cycles.push({ ...r.info.memory });
    }
    return { baseline, cycles };
  });
  for (const cycle of resources.cycles)
    assert.deepEqual(cycle, resources.baseline);
  assert.deepEqual(issues, []);
  console.log(
    "Front/rear model and four rendered car disposal cycles passed",
    resources,
  );
} catch (error) {
  console.error("Browser issues:", issues);
  throw error;
} finally {
  await browser.close();
}
