import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import {
  BENCHMARK,
  benchmarkPlan,
  benchmarkBays,
  clearParcel,
  renderBenchmark,
} from "../src/city/puneBenchmark.js";
const m = JSON.parse(fs.readFileSync("assets/cities/pune/manifest.json"));
const path = new CityPath(
  JSON.parse(fs.readFileSync("assets/cities/pune/" + m.navigation)),
  m,
);
test("200 m benchmark bays remain deterministic and clear imported obstacles", () => {
  const plan = benchmarkPlan(path);
  assert.deepEqual(plan, benchmarkPlan(path));
  let count = 0;
  for (const c of m.chunks) {
    const data = JSON.parse(fs.readFileSync("assets/cities/pune/" + c.file));
    const bays = benchmarkBays(data, path, plan);
    count += bays.length;
    for (const p of bays) {
      assert.ok(p.s >= BENCHMARK.start && p.s < BENCHMARK.start + 200);
      assert.ok(clearParcel(data, path, p.x, p.z, 1.68, p.roadId));
      assert.ok(!path.nearJunction(p.s));
    }
    const parts = [];
    renderBenchmark(
      bays,
      data,
      path,
      (...args) => parts.push(args),
      { pavement: 1, concrete: 2, drain: 3, trim: 4, forecourt: 5 },
      () => 0,
    );
    for (const [x, y, z, w, h, d, yaw] of parts) {
      assert.ok([x, y, z, w, h, d, yaw].every(Number.isFinite));
      assert.ok(w > 0 && h > 0 && d > 0);
    }
  }
  assert.ok(count > 60);
  console.log("Validated pavement bays:", count);
});
