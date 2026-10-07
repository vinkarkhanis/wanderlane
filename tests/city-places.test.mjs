import test from "node:test";
import assert from "node:assert/strict";
import { RoadPath } from "../src/roadPath.js";
import { Vehicle } from "../src/vehicle.js";
import { terrainHeight } from "../src/heightfield.js";
import {
  cityDistrict,
  nearbyCityPlaces,
  chunkCityPlaces,
  CITY_CYCLE,
} from "../src/city/endlessCityPlaces.js";
import { settlementPlan, constrainSettlement } from "../src/settlementPlan.js";

const path = new RoadPath("aster-2026");
path.urban = true;
test("all requested place types recur on both sides at unlimited signed distances, owned once", () => {
  for (const cycle of [-200, -1, 0, 1, 200]) {
    const all = nearbyCityPlaces(path, cycle * CITY_CYCLE + 2560, 2560);
    assert.deepEqual(
      new Set(all.map((p) => p.kind)),
      new Set(["mall", "hotel", "lake", "hills", "temple", "park"]),
    );
    assert.equal(new Set(all.map((p) => p.id)).size, all.length);
    for (const p of all) {
      assert.equal(
        chunkCityPlaces(path, Math.floor(p.s / 160)).filter(
          (q) => q.id === p.id,
        ).length,
        1,
      );
      assert.ok(
        p.offset - p.depth / 2 > 8.5,
        p.name + " must leave the road and footpath clear",
      );
    }
  }
});
test("lake basin lies below water while road contact stays dry; hills have a continuous driveable grade", () => {
  assert.ok(terrainHeight(path, 960, -78) < path.height(960) - 2);
  assert.ok(terrainHeight(path, 960, -2) === path.height(960));
  assert.ok(terrainHeight(path, 1800, 120) > path.height(1800) + 20);
  for (let s = -100; s < 5300; s += 2) {
    const p = path.sampleAtDistance(s);
    assert.ok(Math.abs(p.pitch) < 0.12);
    assert.ok(Math.abs(path.height(s + 0.01) - path.height(s - 0.01)) < 0.004);
    assert.ok(Math.abs(terrainHeight(path, s, 2) - path.height(s)) < 0.001);
  }
});
test("large landmarks reserve clear parcels and solid building footprints stop a car", () => {
  for (const p of nearbyCityPlaces(path, 2500, 2500).filter((p) =>
    ["mall", "hotel", "temple"].includes(p.kind),
  )) {
    const town = settlementPlan(path, Math.floor(p.s / 160), (x, z) =>
      path.height(path.findNearestRoadPoint(x, z, {}).distance),
    );
    for (const b of town) {
      const sameSide =
        (b.x - path.sampleAtDistance(b.s).x) * p.nx +
          (b.z - path.sampleAtDistance(b.s).z) * p.nz >
        0;
      if (sameSide) assert.ok(Math.abs(b.s - p.s) >= p.width / 2 + 24);
    }
    const v = new Vehicle(path);
    v.x = p.x;
    v.z = p.z;
    v.y = path.height(p.s);
    v.speed = 10;
    constrainSettlement([{ ...p, y: v.y }], v, 1 / 60);
    assert.ok(Math.hypot(v.x - p.x, v.z - p.z) > 10);
    assert.ok(v.speed < 10);
  }
  assert.equal(cityDistrict(100).id, "market");
  assert.equal(cityDistrict(1000).id, "lake");
});
