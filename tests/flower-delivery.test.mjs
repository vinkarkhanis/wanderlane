import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import { journeyNavigation } from "../src/city/puneJourney.js";
import { CityExperience } from "../src/city/cityExperience.js";
import { flowerTrip } from "../src/city/flowerDelivery.js";
import { DiscoveryJournal } from "../src/city/puneDiscovery.js";
import { Vehicle } from "../src/vehicle.js";
const base = "assets/cities/pune/";
const manifest = JSON.parse(fs.readFileSync(base + "manifest.json"));
const nav = JSON.parse(fs.readFileSync(base + manifest.navigation));
test("both routes require a parked pickup before an earned courtyard delivery", () => {
  for (const route of ["main", "detour"]) {
    const path = new CityPath(journeyNavigation(nav, route), manifest);
    const d = flowerTrip(path),
      e = new CityExperience(path, d);
    const pickup = d.objectives[0].stop;
    const parked = (p) => ({
      x: p.x,
      z: p.z,
      speed: 0,
      near: { distance: p.s, routeGap: 8, offset: 8, width: 8 },
    });
    e.start();
    e.update(3, parked(d.arrival));
    assert.equal(e.snapshot.cargo, "awaiting pickup");
    e.highWater = 75;
    e.update(1, parked(pickup));
    assert.equal(e.objectiveIndex, 0);
    e.update(0.1, { ...parked(pickup), speed: 2 });
    assert.equal(e.arrivalDwell, 0);
    e.update(2.1, parked(pickup));
    assert.equal(e.snapshot.pickup.stage, "collecting bouquet");
    assert.equal(e.snapshot.cargo, "awaiting pickup");
    e.update(9.1, parked(pickup));
    assert.equal(e.snapshot.cargo, "onboard");
    assert.equal(e.status, "active");
    assert.equal(e.arrivalDwell, 0);
    const offRoadBefore = e.offRoadTime;
    e.update(1, parked(pickup));
    assert.equal(
      e.offRoadTime,
      offRoadBefore,
      "leaving a valid pickup bay is not an off-road violation",
    );
    e.update(1, { ...parked(pickup), x: pickup.x + 60 });
    assert.equal(
      e.offRoadTime,
      offRoadBefore + 1,
      "off-road travel away from the pickup still counts",
    );
    e.update(3, parked(d.arrival));
    assert.equal(e.status, "active");
    e.objectiveIndex = 3;
    e.highWater = d.distance - 50;
    e.update(2.1, parked(d.arrival));
    assert.equal(e.snapshot.cargo, "delivered");
    e.start();
    assert.equal(e.snapshot.cargo, "awaiting pickup");
    e.cancel();
    assert.equal(e.snapshot.status, "cancelled");
  }
});

test("pickup holds the parked car through collection and loading, then departs clear of the shop", () => {
  for (const model of ["gt", "truck", "bike"]) {
    const p = new CityPath(journeyNavigation(nav), manifest);
    const e = new CityExperience(p, flowerTrip(p));
    const v = new Vehicle(p, model);
    e.start();
    v.reset(e.definition.start, -1.6);
    p.getDrivePosition = (s, lane, out) => e.drivePosition(s, lane, out);
    p.arrivalSpeedLimit = (v) => e.arrivalSpeedLimit(v);
    p.interactionHold = () => e.pickupElapsed !== null;
    const bay = e.definition.objectives[0].stop;
    const stages = new Set();
    let anchor = null,
      held = 0,
      departed = false;
    for (let i = 0; i < 12000; i++) {
      v.update(
        1 / 60,
        e.pickupElapsed !== null
          ? { accel: true, reverse: true, left: true }
          : {},
        true,
        "meadow",
        { safeSpeed: () => 9 },
      );
      e.update(1 / 60, v);
      if (e.pickupElapsed !== null) {
        anchor ??= { x: v.x, z: v.z };
        stages.add(e.snapshot.pickup.stage);
        held++;
        assert.ok(
          Math.hypot(v.x - anchor.x, v.z - anchor.z) < 0.01,
          "car stays parked even with held inputs",
        );
        assert.ok(Math.abs(v.speed) < 0.5);
      }
      const dx = v.x - bay.x,
        dz = v.z - bay.z;
      const across = dx * Math.cos(bay.yaw) - dz * Math.sin(bay.yaw),
        along = dx * Math.sin(bay.yaw) + dz * Math.cos(bay.yaw);
      // The shop's nearest edge is 2.72m to the passenger side of the bay.
      if (Math.abs(along) < 4)
        assert.ok(
          across + v.bounds.halfWidth < 2.72,
          `${model} clears the side stall`,
        );
      if (e.snapshot.cargo === "onboard" && v.near.distance > bay.s + 50) {
        departed = true;
        break;
      }
    }
    assert.equal(stages.size, 4);
    assert.ok(held >= 539);
    assert.ok(departed, model);
  }
});

test("cancel, restart and recovery away from the bay abort the pickup interaction", () => {
  const p = new CityPath(journeyNavigation(nav), manifest),
    e = new CityExperience(p, flowerTrip(p));
  const bay = e.definition.objectives[0].stop;
  const v = {
    x: bay.x,
    z: bay.z,
    speed: 0,
    near: { distance: bay.s, routeGap: 8, offset: 8, width: 8 },
  };
  for (const action of ["cancel", "start", "recover"]) {
    e.start();
    e.highWater = 75;
    e.update(2.1, v);
    assert.ok(e.snapshot.pickup);
    if (action === "recover") e.update(0.1, { ...v, x: bay.x + 20 });
    else e[action]();
    assert.equal(e.snapshot.pickup, null);
    assert.equal(e.snapshot.cargo, "awaiting pickup");
  }
});
test("scrapbook retains delivery and bounded photographs across reload", () => {
  const store = new Map(),
    storage = {
      getItem: (k) => store.get(k),
      setItem: (k, v) => store.set(k, v),
    };
  const j = new DiscoveryJournal(storage);
  j.complete({
    tripId: "flower-delivery",
    name: "Monsoon Flower Delivery",
    quality: "Smooth",
  });
  j.postcard("flower-delivery", {
    image: "data:image/jpeg;base64,YQ==",
    label: "Flowers in the rain",
    vehicle: "Aster GT",
    weather: "Monsoon",
    route: "detour",
  });
  assert.deepEqual(new DiscoveryJournal(storage).snapshot, j.snapshot);
  assert.equal(j.snapshot.photos[0].route, "detour");
  const blocked = new DiscoveryJournal({
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  });
  blocked.complete({
    tripId: "flower-delivery",
    name: "Delivery",
    quality: "Eventful",
  });
  assert.equal(blocked.snapshot.drives.length, 1);
});
