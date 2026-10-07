import test from "node:test";
import assert from "node:assert/strict";
import { Vehicle } from "../src/vehicle.js";
import { RoadPath } from "../src/roadPath.js";
import { VEHICLES } from "../src/vehicleCatalog.js";
import { TrafficCollisions } from "../src/trafficCollisions.js";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import { CityExperience } from "../src/city/cityExperience.js";
import { discoveryTrip } from "../src/city/puneDiscovery.js";
import { journeyNavigation, bayContains } from "../src/city/puneJourney.js";

test("all garage vehicles accelerate, brake into reverse and follow the road", () => {
  for (const spec of VEHICLES) {
    const path = new RoadPath("garage-test"),
      v = new Vehicle(path, spec.id);
    for (let i = 0; i < 120; i++) v.update(1 / 60, { accel: true }, false);
    assert.ok(v.speed > 3, spec.id);
    for (let i = 0; i < 300; i++) v.update(1 / 60, { brake: true }, false);
    assert.ok(v.speed < 0, `${spec.id} reverse`);
    v.reset(40, 2);
    for (let i = 0; i < 7200; i++) v.update(1 / 60, {}, true);
    assert.ok(v.dist > 0.5, `${spec.id} auto distance`);
    assert.ok(Math.abs(v.near.offset - 2) < 0.9, `${spec.id} auto lane`);
    assert.ok([v.x, v.y, v.z, v.heading, v.roll].every(Number.isFinite));
  }
});

test("player collision dimensions distinguish a narrow bike from a pickup", () => {
  const contact = (id) => {
    const v = new Vehicle(new RoadPath("garage-contact"), id);
    Object.assign(v, { x: 0, y: 0, z: 0, heading: 0, speed: 5 });
    const traffic = [
      {
        speed: 0,
        sample: { x: 1.6, y: 0, z: 0, heading: 0 },
        car: {
          type: "car",
          bounds: { halfWidth: 0.6, halfLength: 2 },
          group: { visible: true },
        },
      },
    ];
    const collisions = new TrafficCollisions();
    collisions.update(1 / 60, v, traffic);
    return v.x;
  };
  assert.equal(contact("bike"), 0);
  assert.ok(contact("truck") < 0);
});

test("every garage vehicle can auto-park at both Pune destinations", () => {
  const base = "assets/cities/pune/";
  const manifest = JSON.parse(fs.readFileSync(base + "manifest.json"));
  const nav = JSON.parse(fs.readFileSync(base + manifest.navigation));
  for (const spec of VEHICLES)
    for (const id of ["monsoon-pashan", "baner-evening"]) {
      const path = new CityPath(journeyNavigation(nav), manifest);
      const trip = new CityExperience(path, discoveryTrip(path, id));
      const v = new Vehicle(path, spec.id);
      trip.start();
      trip.objectiveIndex = trip.definition.objectives.length - 1;
      trip.highWater = trip.travel = trip.definition.distance - 100;
      v.reset(trip.definition.arrival.s - 100, -1.6);
      trip.last = v.near.distance;
      path.getDrivePosition = (s, lane, out) =>
        trip.drivePosition(s, lane, out);
      path.arrivalSpeedLimit = (vehicle) => trip.arrivalSpeedLimit(vehicle);
      for (let i = 0; i < 7200 && trip.status !== "completed"; i++) {
        v.update(1 / 60, {}, true, "meadow", { safeSpeed: () => 9 });
        trip.update(1 / 60, v);
      }
      assert.equal(trip.status, "completed", `${spec.id}: ${id}`);
      assert.ok(Math.abs(v.speed) < 0.5);
      assert.ok(bayContains(trip.definition.arrival, v.x, v.z));
    }
});
