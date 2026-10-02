import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import { CityExperience, chaiTrip } from "../src/city/cityExperience.js";
import { discoveryTrip, DiscoveryJournal } from "../src/city/puneDiscovery.js";
import {
  journeyNavigation,
  PUNE_FORK,
  JOURNEY_PLACES,
  safeJourneyPlace,
  bayContains,
} from "../src/city/puneJourney.js";
import { nearest } from "../src/city/spatial.js";
import { Vehicle } from "../src/vehicle.js";
const base = "assets/cities/pune/";
const manifest = JSON.parse(fs.readFileSync(base + "manifest.json"));
const nav = JSON.parse(fs.readFileSync(base + manifest.navigation));
const main = new CityPath(journeyNavigation(nav), manifest);
const detour = new CityPath(journeyNavigation(nav, "detour"), manifest);

test("detour uses connected, legal surface roads and reconnects without changing geography", () => {
  for (const p of [main, detour]) {
    for (let i = 0; i < p.segments.length; i++) {
      const r = p.segments[i],
        next = p.segments[(i + 1) % p.segments.length];
      assert.deepEqual(r.q, next.p);
      assert.ok(!r.oneway || r.oneway === r.dir);
    }
  }
  for (const id of PUNE_FORK.roads) {
    assert.ok(nav.roads[id].width >= 4 && !nav.roads[id].elevated);
    assert.ok(!["no", "private"].includes(nav.roads[id].tags.access));
  }
  assert.ok(
    detour.length - main.length > 130 && detour.length - main.length < 150,
  );
  for (const s of [440, 2700, 3500, 3980, 4905, 9690, 10480]) {
    const t = detour.journeyDistance(s),
      a = main.sampleAtDistance(s, {}),
      b = detour.sampleAtDistance(t, {});
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.001);
    assert.ok(Math.abs(detour.canonicalDistance(t) - s) < 0.001);
  }
  assert.equal(
    chaiTrip(detour).distance - chaiTrip(main).distance,
    detour.length - main.length,
  );
});

test("parking bays clear buildings, water, roads and have usable car space", () => {
  for (const bay of Object.values(JOURNEY_PLACES)) {
    const c = manifest.chunks.find((c) => c.id === bay.tile),
      data = JSON.parse(fs.readFileSync(base + c.file));
    assert.ok(safeJourneyPlace(bay, data, main));
    assert.ok(bayContains(bay, bay.x, bay.z));
    assert.ok(!bayContains(bay, bay.x + 20, bay.z));
    // Sample the complete pad, independently of the radius clearance check.
    for (const x of [-2, 2])
      for (const z of [-5, 5]) {
        const p = [
          bay.x + x * Math.cos(bay.yaw) + z * Math.sin(bay.yaw),
          bay.z - x * Math.sin(bay.yaw) + z * Math.cos(bay.yaw),
        ];
        for (const r of main.grid.query(...p, 20))
          assert.ok(nearest(p, r.p, r.q).d > r.width / 2 + 0.9);
      }
    assert.equal(
      safeJourneyPlace(
        bay,
        {
          ...data,
          buildings: [
            ...data.buildings,
            { bounds: [bay.x - 1, bay.z - 1, bay.x + 1, bay.z + 1] },
          ],
        },
        main,
      ),
      false,
    );
  }
});

test("arrival needs earned approach, a continuous low-speed stop, and resets on departure", () => {
  const d = discoveryTrip(main, "monsoon-pashan"),
    e = new CityExperience(main, d);
  const parked = {
    x: d.arrival.x,
    z: d.arrival.z,
    speed: 0,
    near: { distance: d.arrival.s, routeGap: 8, offset: 8, width: 8 },
  };
  e.start();
  for (let i = 0; i < 30; i++) e.update(0.1, parked);
  assert.equal(e.status, "active");
  assert.equal(e.arrivalDwell, 0);
  e.objectiveIndex = d.objectives.length - 1;
  e.highWater = d.distance - 50;
  e.update(1, { ...parked, speed: 4 });
  assert.equal(e.arrivalDwell, 0);
  e.update(1, parked);
  assert.equal(e.arrivalDwell, 1);
  e.update(0.1, { ...parked, x: parked.x + 20 });
  assert.equal(e.arrivalDwell, 0);
  for (let i = 0; i < 21; i++) e.update(0.1, parked);
  assert.equal(e.status, "completed");
  e.start();
  assert.equal(e.arrivalDwell, 0);
});

test("journal persists discoveries, rejects damaged data, and works without storage", () => {
  const store = new Map(),
    storage = {
      getItem: (k) => store.get(k),
      setItem: (k, v) => store.set(k, v),
    };
  const j = new DiscoveryJournal(storage);
  j.encounter("evening-chai-crowd");
  j.postcard("pashan-chai");
  j.complete({
    tripId: "monsoon-pashan",
    name: "Monsoon Pashan Drive",
    quality: "Smooth",
  });
  assert.deepEqual(new DiscoveryJournal(storage).snapshot, j.snapshot);
  store.set(
    "wanderlane.discovery.v1",
    '{"version":1,"drives":{},"scenes":["missing"],"postcards":["missing"]}',
  );
  assert.deepEqual(new DiscoveryJournal(storage).snapshot, {
    drives: [],
    scenes: [],
    postcards: [],
  });
  const blocked = new DiscoveryJournal({
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  });
  blocked.postcard("pashan-chai");
  assert.equal(blocked.snapshot.postcards.length, 1);
});

test("auto-drive pulls into both bays and stops without circling past the destination", () => {
  for (const choice of ["main", "detour"])
    for (const id of ["monsoon-pashan", "baner-evening"]) {
      const p = new CityPath(journeyNavigation(nav, choice), manifest);
      const e = new CityExperience(p, discoveryTrip(p, id)),
        v = new Vehicle(p);
      e.start();
      e.objectiveIndex = e.definition.objectives.length - 1;
      e.highWater = e.travel = e.definition.distance - 100;
      v.reset(e.definition.arrival.s - 100, -1.6);
      e.last = v.near.distance;
      p.getDrivePosition = (s, lane, out) => e.drivePosition(s, lane, out);
      p.arrivalSpeedLimit = (v) => e.arrivalSpeedLimit(v);
      for (let i = 0; i < 7200 && e.status !== "completed"; i++) {
        v.update(1 / 60, {}, true, "meadow", { safeSpeed: () => 9 });
        e.update(1 / 60, v);
      }
      assert.equal(e.status, "completed", `${choice}: ${id}`);
      assert.ok(Math.abs(v.speed) < 0.5);
      assert.ok(bayContains(e.definition.arrival, v.x, v.z));
    }
});
