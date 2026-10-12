import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import { journeyNavigation } from "../src/city/puneJourney.js";
import { CityExperience } from "../src/city/cityExperience.js";
import { flowerTrip } from "../src/city/flowerDelivery.js";
import { DiscoveryJournal } from "../src/city/puneDiscovery.js";
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
