import test from "node:test";
import assert from "node:assert/strict";
import { Vehicle } from "../src/vehicle.js";
import { VEHICLES } from "../src/vehicleCatalog.js";
import { engineVoice } from "../src/vehicleFeel.js";
function road(rough = false) {
  const point = (s, l = 0, out = {}) =>
    Object.assign(out, {
      x: 0,
      z: s,
      y: rough ? 0.06 * Math.sin(s * 0.4) : 0,
      heading: 0,
      pitch: 0,
      distance: s,
      offset: l,
      nx: 1,
      nz: 0,
      width: 8,
    });
  return {
    groundHeight: () => 0,
    getLanePosition: (s, l, out) => Object.assign(point(s, l, out), { x: l }),
    findNearestRoadPoint: (x, z, out) => point(z, x, out),
    hasRail: () => false,
    getCurvatureAtDistance: () => 0,
  };
}
const advance = (v, seconds, input = {}, hz = 60) => {
  for (let i = 0; i < seconds * hz; i++) v.update(1 / hz, input, false);
};
test("acceleration and stopping distances reflect vehicle weight and response", () => {
  const results = Object.fromEntries(
    VEHICLES.map((s) => {
      const v = new Vehicle(road(), s.id);
      advance(v, 3, { accel: true });
      const speed = v.speed;
      v.reset(40, 0);
      v.speed = 15;
      const start = v.z;
      for (let i = 0; i < 600 && v.speed > 0.1; i++)
        v.update(1 / 60, { brake: true }, false);
      return [s.id, { speed, stop: v.z - start }];
    }),
  );
  assert.ok(
    results.bike.speed > results.gt.speed &&
      results.gt.speed > results.hatch.speed &&
      results.hatch.speed > results.sedan.speed &&
      results.sedan.speed > results.suv.speed &&
      results.suv.speed > results.truck.speed,
  );
  assert.ok(
    results.gt.speed > results.truck.speed * 3,
    "GT launch should be clearly stronger than pickup",
  );
  assert.ok(
    results.truck.stop > results.gt.stop * 1.8,
    "Pickup needs visibly more stopping room",
  );
  assert.ok(results.bike.stop < results.sedan.stop);
});
test("corner response differs and body motion settles without stationary shaking", () => {
  const outcomes = {};
  for (const s of VEHICLES) {
    const v = new Vehicle(road(), s.id);
    v.speed = 8;
    advance(v, 0.6, { left: true });
    outcomes[s.id] = { steer: v.steer, roll: v.bodyRoll };
    assert.ok(Math.abs(v.bodyRoll) < 0.4);
    v.speed = 0;
    advance(v, 5);
    assert.ok(Math.abs(v.bodyRoll) < 0.0001);
    assert.ok(Math.abs(v.squat) < 0.0001);
  }
  assert.ok(outcomes.hatch.steer > outcomes.truck.steer + 0.1);
  assert.ok(outcomes.bike.roll < 0 && outcomes.suv.roll > 0);
  assert.ok(
    Math.abs(outcomes.bike.roll) > 0.2,
    "Bike should visibly lean into the corner",
  );
  assert.ok(
    outcomes.suv.roll > outcomes.gt.roll * 3,
    "SUV should visibly roll more than the firm coupe",
  );
});
test("auto-drive pace and engine timbre remain distinct between vehicle types", () => {
  const results = VEHICLES.map((s) => {
    const v = new Vehicle(road(), s.id);
    for (let i = 0; i < 1800; i++) v.update(1 / 60, {}, true);
    return { id: s.id, speed: v.speed };
  });
  assert.ok(
    results.find((v) => v.id === "gt").speed >
      results.find((v) => v.id === "truck").speed * 1.6,
  );
  assert.equal(
    new Set(VEHICLES.map((v) => JSON.stringify(v.sound.harmonics))).size,
    6,
  );
});
test("soft suspension responds differently to the same uneven road and frame rates agree", () => {
  const response = (id, hz) => {
    const v = new Vehicle(road(true), id);
    let sum = 0;
    for (let i = 0; i < 6 * hz; i++) {
      v.speed = 8;
      v.update(1 / hz, {}, false);
      sum += Math.abs(v.suspensionOffset);
    }
    return sum / (6 * hz);
  };
  assert.ok(response("truck", 60) > response("gt", 60) * 1.6);
  for (const s of VEHICLES)
    assert.ok(Math.abs(response(s.id, 30) - response(s.id, 120)) < 0.006, s.id);
});
test("six distinct engine voices retain finite bounded reverse and shift behaviour", () => {
  const voices = VEHICLES.map((s) => engineVoice(s, 12, 0.8));
  assert.equal(new Set(voices.map((v) => v.frequency)).size, 6);
  for (const s of VEHICLES) {
    assert.deepEqual(engineVoice(s, 12, 0.8), engineVoice(s, -12, 0.8));
    for (let speed = 0; speed < 45; speed += 0.5) {
      const v = engineVoice(s, speed, 1);
      assert.ok(Object.values(v).every(Number.isFinite));
      assert.ok(v.frequency > 20 && v.frequency < 220);
      assert.ok(v.gear >= 1 && v.gear <= 5);
    }
  }
});
