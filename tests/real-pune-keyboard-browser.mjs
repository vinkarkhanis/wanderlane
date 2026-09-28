import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
const m = JSON.parse(fs.readFileSync("assets/cities/pune/manifest.json"));
const path = new CityPath(
  JSON.parse(fs.readFileSync("assets/cities/pune/" + m.navigation)),
  m,
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now() * 4));
});
const held = new Set();
async function key(k, on) {
  if (on && !held.has(k)) {
    await page.keyboard.down(k);
    held.add(k);
  } else if (!on && held.has(k)) {
    await page.keyboard.up(k);
    held.delete(k);
  }
}
try {
  await page.goto("http://127.0.0.1:8123");
  await page.waitForFunction(() => window.wanderlane);
  await page.click("#startBtn");
  await page.selectOption("#discoveryDrive", "baner-evening");
  await page.click("#tripStart");
  await page.waitForFunction(
    () => window.wanderlane.state.experience.status === "active",
  );
  let previous = null,
    lastObjective = -1,
    done = null,
    maxOffset = 0;
  const start = Date.now();
  while (Date.now() - start < 600000) {
    const s = await page.evaluate(() => window.wanderlane.state);
    assert.equal(s.auto, false);
    if (s.experience.status === "completed") {
      done = s;
      break;
    }
    const t = path.getLanePosition(
      s.roadDistance + 4 + Math.abs(s.speed) * 0.55,
      -1.6,
      {},
    );
    const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const error = angle(
      Math.atan2(t.x - s.position.x, t.z - s.position.z) - s.heading,
    );
    const elapsed = previous
      ? s.experience.elapsed - previous.experience.elapsed
      : 0;
    const yaw = elapsed > 0 ? angle(s.heading - previous.heading) / elapsed : 0;
    const turn = error - 0.3 * yaw;
    const goal = Math.max(
      2.5,
      6 /
        (1 +
          Math.abs(error) * 3 +
          Math.abs(path.getCurvatureAtDistance(s.roadDistance + 12)) * 20),
    );
    await key("a", turn > 0.025);
    await key("d", turn < -0.025);
    await key("w", s.speed < goal);
    await key("s", s.speed > goal + 1);
    maxOffset = Math.max(maxOffset, Math.abs(s.offset));
    previous = s;
    if (lastObjective !== s.experience.objectiveIndex) {
      lastObjective = s.experience.objectiveIndex;
      console.log(
        "keyboard",
        lastObjective,
        Math.round(s.roadDistance),
        s.speed,
      );
    }
    await page.waitForTimeout(35);
  }
  for (const k of [...held]) await key(k, false);
  assert.ok(done, "Keyboard controller did not complete hero route");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "tests/real-pune-after/keyboard-arrival.png" });
  fs.writeFileSync(
    "tests/real-pune-validation/keyboard-browser.json",
    JSON.stringify(
      {
        done,
        maxOffset,
        errors,
        method:
          "Keyboard W/A/S/D controller, 4x RAF clock, no auto-drive or teleport",
      },
      null,
      2,
    ),
  );
  console.log("Full hero route completed with keyboard input", maxOffset);
} finally {
  await browser.close();
}
