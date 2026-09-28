import test from "node:test";
import assert from "node:assert/strict";
import {
  CityExperience,
  wrappedDistance,
  scoreTrip,
} from "../src/city/cityExperience.js";
const path = {
  length: 1000,
  segment: () => ({ tags: { name: "Baner Road", "name:mr": "बाणेर रस्ता" } }),
};
const definition = {
  id: "test",
  start: 950,
  distance: 150,
  objectives: [
    { s: 980, distance: 30, label: "First" },
    { s: 30, distance: 80, label: "Second" },
    { s: 100, distance: 150, label: "Last" },
  ],
};
const vehicle = (s) => ({
  near: { distance: s, routeGap: 0, offset: 0, width: 7 },
  speed: 10,
  braking: false,
});
test("wrapped distance, ordered objectives, seam and exactly-once arrival", () => {
  assert.equal(wrappedDistance(950, 100, 1000), 150);
  const e = new CityExperience(path, definition);
  e.start();
  assert.equal(e.snapshot.objectiveIndex, 0);
  for (let s = 951; s <= 1100; s++) e.update(0.1, vehicle(s % 1000));
  assert.equal(e.status, "completed");
  assert.equal(e.objectiveIndex, 3);
  const elapsed = e.elapsed;
  e.update(2, vehicle(120));
  assert.equal(e.elapsed, elapsed);
});
test("reverse, projection jumps and departures do not skip objectives", () => {
  const e = new CityExperience(path, definition);
  e.start();
  e.update(0.1, vehicle(955));
  assert.equal(e.highWater, 0); // implausible projection jump
  e.update(0.1, {
    ...vehicle(100),
    near: { distance: 100, routeGap: 40, offset: 30, width: 7 },
  });
  e.update(0.1, vehicle(101));
  assert.equal(e.objectiveIndex, 0);
  assert.equal(e.routeDepartures, 1);
  const progress = e.highWater;
  e.update(0.1, vehicle(100));
  assert.equal(e.highWater, progress);
});
test("restart, cancellation, disposal and snapshot isolation", () => {
  const e = new CityExperience(path, definition);
  e.start();
  e.encounter("chai");
  e.snapshot.eventsSeen.push("bad");
  assert.deepEqual(e.eventsSeen, ["chai"]);
  e.hardBrakes = 3;
  e.start();
  assert.equal(e.hardBrakes, 0);
  assert.deepEqual(e.eventsSeen, []);
  e.cancel();
  e.update(1, vehicle(951));
  assert.equal(e.elapsed, 0);
  e.dispose();
  e.start();
  assert.equal(e.status, "cancelled");
});
test("quality is explainable and deterministic", () => {
  assert.equal(scoreTrip({}).quality, "Smooth");
  assert.equal(scoreTrip({ hardBrakes: 2 }).quality, "Mostly smooth");
  assert.equal(scoreTrip({ redLightViolations: 2 }).quality, "Eventful");
});
