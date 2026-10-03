import test from "node:test";
import assert from "node:assert/strict";
import { RoadPath } from "../src/roadPath.js";
import { Vehicle } from "../src/vehicle.js";
import { TrafficCollisions } from "../src/trafficCollisions.js";

function run(v, seconds, input = {}, traffic = null, biome = "meadow") {
  for (let i = 0; i < seconds * 60; i++)
    v.update(1 / 60, input, false, biome, traffic);
}
for (const biome of ["meadow", "snow", "desert", "canyon"]) {
  test(`${biome}: takeoff, steer, altitude bounds, road landing and driving`, () => {
    const v = new Vehicle(new RoadPath("flight"));
    const start = { x: v.x, y: v.y, z: v.z };
    v.toggleFlight();
    run(v, 8, {}, null, biome);
    assert.equal(v.flight, "flying");
    assert.equal(v.x, start.x);
    assert.equal(v.z, start.z);
    assert.ok(v.y > start.y + 30);
    run(v, 3, { accel: true, left: true, rise: true }, null, biome);
    assert.ok(Math.hypot(v.x - start.x, v.z - start.z) > 10);
    assert.ok(v.flightHeight > 60);
    run(v, 15, { descend: true }, null, biome);
    assert.ok(v.flightAltitude >= 18 - 0.01);
    let reservations = 0;
    v.toggleFlight();
    const target = { ...v.flightTarget };
    run(
      v,
      40,
      {},
      {
        clearNear() {
          reservations++;
        },
      },
      biome,
    );
    assert.equal(v.flight, "ground");
    assert.ok(reservations > 0);
    assert.ok(Math.hypot(v.x - target.x, v.z - target.z) < 0.02);
    assert.ok(Math.abs(v.y - target.y) < 0.1);
    run(v, 2, { accel: true }, null, biome);
    assert.ok(v.speed > 4);
  });
}
test("landing waits for streamed road, can be cancelled, reset clears flight", () => {
  const path = new RoadPath("waiting"),
    v = new Vehicle(path);
  path.flightLandingReady = () => false;
  v.toggleFlight();
  run(v, 8);
  v.toggleFlight();
  run(v, 20);
  assert.equal(v.flight, "landing");
  assert.ok(v.flightAltitude >= 18);
  v.toggleFlight();
  assert.equal(v.flight, "flying");
  v.toggleFlight();
  path.flightLandingReady = () => true;
  run(v, 30);
  assert.equal(v.flight, "ground");
  v.toggleFlight();
  v.reset();
  assert.equal(v.flight, "ground");
  assert.equal(v.flightTarget, null);
});
test("airborne player cannot receive road traffic impulses", () => {
  const c = new TrafficCollisions();
  const v = new Vehicle(new RoadPath("collision"));
  v.toggleFlight();
  c.update(1 / 60, v, []);
  assert.equal(c.snapshot.count, 0);
  assert.equal(v.impactVX, 0);
});
test("cancelling near-touchdown climbs smoothly instead of snapping into the air", () => {
  const v = new Vehicle(new RoadPath("cancel-low"));
  v.toggleFlight();
  run(v, 8);
  v.toggleFlight();
  while (v.flight === "landing" && v.flightAltitude > 3)
    v.update(1 / 60, {}, false);
  assert.equal(v.flight, "landing");
  const y = v.y;
  v.toggleFlight();
  v.update(1 / 60, {}, false);
  assert.equal(v.flight, "takeoff");
  assert.ok(v.y - y <= 0.16);
});
test("city landing uses horizontal road proximity, legal one-way direction and rooftop clearance", () => {
  const path = new RoadPath("city-flight");
  const nearest = path.findNearestRoadPoint.bind(path);
  path.findNearestRoadPoint = (x, z, out = {}, height) => {
    assert.ok(height === undefined || Math.abs(height) < 10);
    nearest(x, z, out);
    out.roadId = 0;
    return out;
  };
  const v = new Vehicle(path);
  path.city = true;
  path.bounds = [-1000, -1000, 1000, 1000];
  path.roads = [{ oneway: -1, width: 8 }];
  path.flightFloor = () => 90;
  v.toggleFlight();
  run(v, 12);
  assert.equal(v.flight, "flying");
  assert.ok(v.y >= 89.8);
  v.x += 15;
  v.toggleFlight();
  const target = { ...v.flightTarget };
  assert.ok(
    Math.abs(target.heading - (nearest(v.x, v.z).heading + Math.PI)) < 1e-6,
  );
  // Ground physics uses height hints after touchdown; retain the strict spy only in air.
  let cleared = false;
  for (let i = 0; i < 3000 && v.flight !== "ground"; i++) {
    v.update(1 / 60, {}, false, "meadow", {
      clearNear() {
        cleared = true;
      },
    });
  }
  assert.equal(v.flight, "ground");
  assert.ok(cleared);
  assert.ok(Math.abs(v.y - target.y) < 0.01);
});
