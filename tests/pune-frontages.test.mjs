import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import { benchmarkPlan, benchmarkBays } from "../src/city/puneBenchmark.js";
import {
  NEIGHBOURHOOD,
  frontagePlan,
  frontagePoint,
  frontageClear,
} from "../src/city/puneFrontagePlan.js";
import { nearest } from "../src/city/spatial.js";
const base = "assets/cities/pune/";
const manifest = JSON.parse(fs.readFileSync(base + "manifest.json"));
const path = new CityPath(
  JSON.parse(fs.readFileSync(base + manifest.navigation)),
  manifest,
);
const chunks = manifest.chunks.map((c) =>
  JSON.parse(fs.readFileSync(base + c.file)),
);
const plan = [...benchmarkPlan(path), ...benchmarkPlan(path, NEIGHBOURHOOD)];

test("frontages retain source footprints, stable ownership and safe road clearance", () => {
  const all = chunks.flatMap((c) => frontagePlan(c, path, plan));
  assert.ok(all.length >= 10);
  assert.ok(all.some((p) => p.retail) && all.some((p) => !p.retail));
  assert.equal(new Set(all.map((p) => p.buildingId)).size, all.length);
  for (const c of chunks) {
    const before = JSON.stringify(c);
    const a = frontagePlan(c, path, plan);
    const b = frontagePlan(
      { ...c, buildings: [...c.buildings].reverse() },
      path,
      [...plan].reverse(),
    );
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(c), before);
    for (const p of a) {
      assert.ok(frontageClear(c, path, p, p.width, p.depth));
      // Finer independent sampling checks actual canopy perimeter against ALL roads.
      for (let u = -p.width / 2; u <= p.width / 2; u += 0.25) {
        const q = frontagePoint(p, u, p.depth);
        for (const r of path.grid.query(...q, 32))
          assert.ok(nearest(q, r.p, r.q).d >= r.width / 2 + 1);
      }
    }
  }
});
test("new footpaths are outside their source carriageway on both sides", () => {
  const intro = benchmarkPlan(path, NEIGHBOURHOOD);
  const bays = chunks.flatMap((c) => benchmarkBays(c, path, intro));
  assert.ok(bays.length > 50);
  assert.deepEqual(new Set(bays.map((b) => b.side)), new Set([-1, 1]));
  for (const p of bays) {
    const r = path.roads[p.roadId];
    assert.ok(nearest([p.x, p.z], r.p, r.q).d >= r.width / 2 + 1.3 - 1e-6);
  }
});
test("frontage planner rejects an obstructing building or water parcel", () => {
  const c = chunks.find((c) => frontagePlan(c, path, plan).length);
  const p = frontagePlan(c, path, plan)[0];
  const q = frontagePoint(p, 0, 0.6);
  const ring = [
    [q[0] - 1, q[1] - 1],
    [q[0] + 1, q[1] - 1],
    [q[0] + 1, q[1] + 1],
    [q[0] - 1, q[1] + 1],
  ];
  assert.equal(
    frontageClear(
      { ...c, buildings: [...c.buildings, { id: "obstacle", outer: ring }] },
      path,
      p,
      p.width,
      p.depth,
    ),
    false,
  );
  assert.equal(
    frontageClear(
      { ...c, land: [...c.land, { kind: "water", outer: ring }] },
      path,
      p,
      p.width,
      p.depth,
    ),
    false,
  );
});
