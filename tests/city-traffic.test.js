import test from "node:test";
import assert from "node:assert/strict";
import {
  FLEET,
  VEHICLE_SPECS,
  followingGap,
} from "../src/city/cityTrafficRules.js";
test("fleet is fixed, mixed and bounds produce conservative following gaps", () => {
  assert.equal(FLEET.length, 14);
  assert.ok(
    FLEET.filter((t) => t === "scooter" || t === "rickshaw").length /
      FLEET.length >
      0.65,
  );
  assert.equal(new Set(FLEET).size, 4);
  const bounds = (type) => ({
    halfLength: VEHICLE_SPECS[type].length / 2 + 0.04,
  });
  assert.ok(
    followingGap(bounds("bus"), bounds("car")) >
      followingGap(bounds("scooter"), bounds("car")),
  );
  assert.ok(VEHICLE_SPECS.bus.acceleration < VEHICLE_SPECS.car.acceleration);
  assert.ok(VEHICLE_SPECS.scooter.width < VEHICLE_SPECS.rickshaw.width);
});
