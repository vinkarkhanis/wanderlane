import test from "node:test";
import assert from "node:assert/strict";
import { RoadPath } from "../src/roadPath.js";
import { Vehicle } from "../src/vehicle.js";
import { settlementPlan } from "../src/settlementPlan.js";

test("endless city has deterministic road-clear district buildings, including distant blocks", () => {
  const path = new RoadPath("pune-city");
  path.urban = true;
  for (const index of [-10000, -1, 0, 1, 8, 204, 10000]) {
    const plan = settlementPlan(path, index, (x, z) =>
      path.height(path.findNearestRoadPoint(x, z, {}).distance),
    );
    assert.ok(plan.length >= 0 && plan.length <= 16);
    assert.deepEqual(
      plan,
      settlementPlan(path, index, (x, z) =>
        path.height(path.findNearestRoadPoint(x, z, {}).distance),
      ),
    );
    for (const p of plan)
      assert.ok(
        Math.abs(path.findNearestRoadPoint(p.x, p.z, {}).offset) - p.depth / 2 >
          8,
      );
    assert.equal(path.hasRail(index * 160, "canyon"), false);
    const before = path.sampleAtDistance((index + 1) * 160 - 0.001);
    const after = path.sampleAtDistance((index + 1) * 160 + 0.001);
    assert.ok(
      Math.hypot(after.x - before.x, after.z - before.z, after.y - before.y) <
        0.003,
    );
  }
});

test("city auto driving continues across the repeating waveform boundary without a stop or teleport", () => {
  const path = new RoadPath("pune-city");
  path.urban = true;
  const vehicle = new Vehicle(path, "truck");
  vehicle.reset(32700, -2);
  let maxGap = 0,
    largestStep = 0;
  for (let i = 0; i < 12000; i++) {
    const x = vehicle.x,
      z = vehicle.z;
    vehicle.update(1 / 60, {}, true, "meadow");
    largestStep = Math.max(
      largestStep,
      Math.hypot(vehicle.x - x, vehicle.z - z),
    );
    maxGap = Math.max(maxGap, Math.abs(vehicle.near.offset));
  }
  assert.ok(vehicle.near.distance > 34500);
  assert.ok(vehicle.speed > 5);
  assert.ok(largestStep < 0.25);
  assert.ok(maxGap < 3);
});
