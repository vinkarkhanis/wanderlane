import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import { RoadPath } from "../src/roadPath.js";
import { cityStreetBays } from "../src/city/puneBenchmark.js";
import { frontagePlan } from "../src/city/puneFrontagePlan.js";
import { junctionNodes } from "../src/city/puneEdges.js";
import {
  settlementChunk,
  settlementPlan,
  settlementContains,
  constrainSettlement,
} from "../src/settlementPlan.js";
const base = "assets/cities/pune/",
  m = JSON.parse(fs.readFileSync(base + "manifest.json"));
const city = new CityPath(JSON.parse(fs.readFileSync(base + m.navigation)), m),
  junctions = junctionNodes(city);

test("street details exist at free-roam spawn and every Pune journey start", () => {
  for (const s of [40, 9690, 2700, 5000]) {
    const p = city.sampleAtDistance(s),
      x = Math.floor(p.x / 256),
      z = Math.floor(p.z / 256);
    const chunks = m.chunks.filter((c) => {
      const [a, b] = c.id.split(",").map(Number);
      return Math.abs(a - x) <= 1 && Math.abs(b - z) <= 1;
    });
    for (const quality of ["Low", "Medium", "High"]) {
      let bays = 0,
        fronts = 0;
      for (const c of chunks) {
        const data = JSON.parse(fs.readFileSync(base + c.file));
        const a = cityStreetBays(data, city, junctions, quality);
        assert.deepEqual(
          a,
          cityStreetBays(
            { ...data, roads: [...data.roads].reverse() },
            city,
            junctions,
            quality,
          ),
        );
        assert.ok(a.every((p) => !city.roads[p.roadId].elevated));
        bays += a.length;
        fronts += frontagePlan(data, city).length;
      }
      assert.ok(
        bays > 0 && fronts > 0,
        JSON.stringify({ s, quality, bays, fronts }),
      );
    }
  }
});
test("Endless settlements are occasional, deterministic, road-clear and collidable", () => {
  for (const seed of ["aster-2026", "pune", "42"]) {
    const path = new RoadPath(seed);
    for (const i of [-8, 0, 8, 16]) {
      const plan = settlementPlan(path, i, () => 0);
      assert.equal(plan.length, 8);
      assert.deepEqual(
        plan,
        settlementPlan(path, i, () => 0),
      );
      for (const p of plan) {
        assert.ok(settlementContains(plan, p.x, p.z));
        assert.ok(
          Math.abs(path.findNearestRoadPoint(p.x, p.z, {}).offset) > 10,
        );
        const v = { x: p.x, z: p.z, y: 0, speed: 10 };
        constrainSettlement(plan, v, 1 / 60);
        assert.ok(!settlementContains(plan, v.x, v.z));
        assert.ok(v.speed < 10);
      }
    }
    for (const i of [1, 2, 3, 4, 5, 6, 7]) {
      assert.equal(settlementChunk(i), false);
      assert.deepEqual(
        settlementPlan(path, i, () => 0),
        [],
      );
    }
    assert.deepEqual(
      settlementPlan(path, 0, () => NaN),
      [],
    );
    assert.deepEqual(
      settlementPlan(path, 0, (x, z) => x * 100 + z * 100),
      [],
    );
  }
});
