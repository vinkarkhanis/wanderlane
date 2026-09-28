import test from "node:test";
import assert from "node:assert/strict";
import {
  CitySignals,
  signalPhase,
  signalOffset,
} from "../src/city/citySignals.js";
test("phases, durations and node offsets are deterministic", () => {
  const id = 2476292433,
    offset = signalOffset(id),
    counts = { red: 0, amber: 0, green: 0 };
  for (let t = 0; t < 36; t++) counts[signalPhase(id, t - offset)]++;
  assert.deepEqual(counts, { red: 15, amber: 3, green: 18 });
  assert.equal(signalPhase(id, 100), signalPhase(id, 136));
  assert.notEqual(signalOffset(id), signalOffset(id + 1));
});
test("red stopping boundary, green release, large dt and single crossing", () => {
  const s = new CitySignals({
    length: 1000,
    nav: { signals: [] },
    segments: [],
  });
  s.items = [{ id: 1, s: 100, node: [0, 0] }];
  s.time = 22 - signalOffset(1);
  assert.equal(s.speedLimit(97, 2), 0);
  assert.ok(s.speedLimit(60, 2) > 0);
  s.reset(99);
  const v = { near: { distance: 101, routeGap: 0 }, speed: 10 };
  assert.equal(s.update(0.2, v), 1);
  assert.equal(s.update(0.2, v), 0);
  s.time = 0 - signalOffset(1);
  assert.equal(s.speedLimit(97, 2), 9);
  s.update(100, { near: { distance: 900, routeGap: 0 }, speed: 0 });
  assert.ok(Number.isFinite(s.time));
  s.dispose();
  assert.equal(s.items.length, 0);
});
test("adjacent roads, bridge levels and opposing headings do not earn violations", () => {
  const s = new CitySignals({
    length: 1000,
    nav: { signals: [] },
    segments: [],
    getLanePosition: () => ({
      x: 0,
      z: 100,
      y: 0,
      nx: 1,
      nz: 0,
      width: 7,
      heading: 0,
    }),
  });
  s.items = [{ id: 1, s: 100, node: [0, 100] }];
  for (const pose of [
    { x: 8, y: 0, heading: 0 },
    { x: 0, y: 8, heading: 0 },
    { x: 0, y: 0, heading: Math.PI },
  ]) {
    s.time = 22 - signalOffset(1);
    s.reset(99);
    assert.equal(
      s.update(0.2, {
        ...pose,
        z: 101,
        near: { distance: 101, routeGap: 0 },
        speed: 10,
      }),
      0,
    );
  }
  s.time = 22 - signalOffset(1);
  s.reset(99);
  assert.equal(
    s.update(0.2, {
      x: 0,
      y: 0,
      z: 101,
      heading: 0,
      near: { distance: 101, routeGap: 0 },
      speed: 10,
    }),
    1,
  );
});
