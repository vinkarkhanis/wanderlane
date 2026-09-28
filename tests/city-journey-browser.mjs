import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [],
  roads = new Set(),
  phases = new Set(),
  shots = new Set(),
  report = {};
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) errors.push(m.text());
});
page.on("requestfailed", (r) => {
  if (!r.failure().errorText.includes("ABORTED"))
    errors.push(r.url() + ": " + r.failure().errorText);
});
// Accelerate wall time only. The real loop still executes every 1/60 physics
// step, streaming, traffic and UI update. No mutable game-state test hooks.
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now() * 10));
});
const state = () => page.evaluate(() => window.wanderlane.state);
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.click("#tripStart");
  await page.click("#trafficBtn");
  await page.click("#trafficBtn");
  await page.click("#autoBtn");
  let completed = false,
    lastLog = -1;
  const start = Date.now();
  while (Date.now() - start < 480000) {
    await page.waitForTimeout(1000);
    const s = await state();
    roads.add(s.experience.road);
    for (const l of s.city.signals.lights) phases.add(l.phase);
    if (s.experience.objectiveIndex !== lastLog) {
      lastLog = s.experience.objectiveIndex;
      console.log(
        "Journey objective",
        lastLog,
        "at",
        Math.round(s.roadDistance),
        "elapsed",
        Math.round(s.experience.elapsed),
      );
    }
    const capture = async (name) => {
      if (!shots.has(name)) {
        shots.add(name);
        await page.screenshot({ path: `tests/chai-${name}.png` });
      }
    };
    if (s.roadDistance > 9700) await capture("baner-sunset");
    if (s.roadDistance > 10390 && s.roadDistance < 10520)
      await capture("street-life");
    if (s.roadDistance > 1600 && s.roadDistance < 1850)
      await capture("roadworks");
    if (s.roadDistance > 1940 && s.roadDistance < 2050) {
      await capture("signal-queue");
      report.junction = s;
    }
    if (s.experience.status === "completed") {
      report.arrival = s;
      await capture("arrival");
      completed = true;
      break;
    }
  }
  assert.ok(
    completed,
    "Full real main-loop journey did not complete: " +
      JSON.stringify(await state()),
  );
  assert.ok(
    report.arrival.experience.eventsSeen.includes("evening-chai-crowd"),
  );
  assert.ok(
    report.arrival.experience.eventsSeen.includes("shoulder-roadworks"),
  );
  assert.ok(roads.size >= 4);
  assert.equal(phases.size, 3);
  assert.equal(report.arrival.city.error, null);
  await page.waitForTimeout(200);
  assert.ok(
    await page
      .getByRole("button", { name: "Drive again", exact: true })
      .isVisible(),
  );
  await page.click("#tripStart");
  const restarted = await state();
  assert.equal(restarted.experience.objectiveIndex, 0);
  assert.equal(restarted.experience.hardBrakes, 0);
  assert.equal(restarted.experience.redLightViolations, 0);
  report.switches = [];
  for (let i = 0; i < 3; i++) {
    await page.click("#settingsBtn");
    await page.selectOption("#driveMode", "endless");
    await page.waitForFunction(
      () => window.wanderlane.state.driveMode === "endless",
    );
    await page.selectOption("#driveMode", "pune");
    await page.waitForFunction(
      () => window.wanderlane.state.driveMode === "pune",
    );
    // Compare identical paused views. Advancing 7 simulated seconds here made
    // GPU allocation depend on which traffic meshes entered the camera frustum.
    await page.waitForTimeout(700);
    report.switches.push(await state());
    await page.click("#resumeBtn");
  }
  assert.equal(
    new Set(report.switches.map((s) => s.geometries)).size,
    1,
    JSON.stringify(
      report.switches.map((s) => ({
        g: s.geometries,
        t: s.textures,
        chunks: s.chunks,
      })),
    ),
  );
  assert.equal(new Set(report.switches.map((s) => s.textures)).size, 1);
  assert.equal(new Set(report.switches.map((s) => s.audioNodes)).size, 1);
  assert.deepEqual(errors, []);
  Object.assign(report, {
    errors,
    roads: [...roads],
    phases: [...phases],
    shots: [...shots],
    clock: "10x RAF timestamps; fixed 60 Hz simulation; no teleports",
  });
  await writeFile(
    "tests/chai-journey-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "Complete live journey passed",
    JSON.stringify({
      arrival: report.arrival.experience,
      roads: report.roads,
      shots: report.shots,
    }),
  );
} catch (e) {
  await page.screenshot({ path: "tests/chai-failure.png" });
  await writeFile(
    "tests/chai-failure-results.json",
    JSON.stringify({ errors, state: await page.evaluate(()=>window.wanderlane?.state ?? null), failure:String(e) }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
