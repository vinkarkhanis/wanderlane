import test from "node:test";
import assert from "node:assert/strict";
import { RoadPath } from "../src/roadPath.js";
import { Vehicle } from "../src/vehicle.js";
import { PHYS } from "../src/config.js";
const path = new RoadPath("verification");
test("deterministic, continuous road samples and nearest lookup across signed chunk and period boundaries", () => {
  const same = new RoadPath("verification"),
    different = new RoadPath("other");
  assert.equal(path.zTable.length, 8193);
  assert.notEqual(
    path.sampleAtDistance(90).x,
    different.sampleAtDistance(90).x,
  );
  for (const s of [
    -33000, -160, -0.01, 0, 160, 1000, 32767.99, 32768, 150000, 1000000,
  ]) {
    const p = path.sampleAtDistance(s);
    assert.deepEqual(p, same.sampleAtDistance(s));
    const q = path.sampleAtDistance(s + 0.01);
    assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 0.0101);
    assert.ok(Math.abs(p.heading - q.heading) < 0.0001);
    const lane = path.getLanePosition(s, 2);
    const nearest = path.findNearestRoadPoint(lane.x, lane.z);
    assert.ok(Math.abs(nearest.distance - s) < 0.02);
    assert.ok(Math.abs(nearest.offset - 2) < 0.001);
    assert.ok(Math.abs(p.curvature) < 0.007);
  }
});
test("100 km auto drive stays in lane, with bounded route memory", () => {
  const v = new Vehicle(path);
  let max = 0;
  for (let i = 0; i < 280000; i++) {
    v.update(1 / 60, {}, true);
    if (i > 600) max = Math.max(max, Math.abs(v.near.offset - 2));
  }
  assert.ok(v.dist > 100);
  assert.ok(max < 0.5, `lane error ${max}`);
  assert.equal(path.zTable.length, 8193);
});
test("left lane auto drive, manual override, and return to road", () => {
  const v = new Vehicle(path);
  v.lane = -2;
  for (let i = 0; i < 5000; i++) v.update(1 / 60, {}, true);
  assert.ok(Math.abs(v.near.offset + 2) < 0.4);
  const heading = v.heading;
  for (let i = 0; i < 30; i++) v.update(1 / 60, { left: true }, true);
  assert.notEqual(v.heading, heading);
  v.x += 25;
  path.findNearestRoadPoint(v.x, v.z, v.near);
  v.reset();
  assert.equal(v.speed, 0);
  assert.ok(Math.abs(path.findNearestRoadPoint(v.x, v.z).offset + 2) < 0.02);
});
test("braking transitions into reverse; the dedicated reverse control works", () => {
  const v = new Vehicle(path);
  for (let i = 0; i < 120; i++) v.update(1 / 60, { accel: true }, false);
  assert.ok(v.speed > 5);
  for (let i = 0; i < 300; i++) v.update(1 / 60, { brake: true }, false);
  assert.ok(v.speed < 0);
  assert.ok(v.speed >= -PHYS.reverseSpeed);
  const direct = new Vehicle(path);
  for (let i = 0; i < 60; i++)
    direct.update(1 / 60, { reverse: true }, false);
  assert.ok(direct.speed < 0);
});
test("off-road surface slows the car and all biomes remain finite", () => {
  for (const biome of ["meadow", "desert", "snow", "canyon"]) {
    const v = new Vehicle(path);
    const p = path.getLanePosition(200, 25);
    Object.assign(v, { x: p.x, z: p.z, speed: 25 });
    v.update(1 / 60, {}, false, biome);
    assert.notEqual(v.surface, "Asphalt");
    assert.ok(v.speed < 25);
    assert.ok(Number.isFinite(v.y));
  }
});
test("frame rates yield comparable relaxed auto driving", () => {
  const results = [30, 60, 120].map((fps) => {
    const v = new Vehicle(path);
    for (let i = 0; i < fps * 120; i++) v.update(1 / fps, {}, true);
    return v;
  });
  for (const v of results) {
    assert.ok(Math.abs(v.dist - results[1].dist) < 0.01);
    assert.ok(Math.abs(v.near.offset - results[1].near.offset) < 0.1);
  }
});

test("canyon guardrail contact reduces speed and keeps the car inside the rail", () => {
  const v = new Vehicle(path);
  const p = path.getLanePosition(230, 4.4);
  Object.assign(v, { x: p.x, z: p.z, speed: 20 });
  v.update(1 / 60, {}, false, "canyon");
  const nearest = path.findNearestRoadPoint(v.x, v.z);
  assert.ok(nearest.offset <= 4.21);
  assert.ok(v.speed < 20);
});
