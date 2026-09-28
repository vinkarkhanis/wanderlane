import test from "node:test";
import assert from "node:assert/strict";
import {
  vehicleContact,
  resolveVehicleContact,
  vehicleMass,
  clearImpact,
  integrateImpact,
} from "../src/vehicleCollisions.js";
import {
  TrafficCollisions,
  resetTrafficImpact,
  advanceTrafficImpact,
} from "../src/trafficCollisions.js";
const body = (values = {}) => ({
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  halfWidth: 1,
  halfLength: 2,
  mass: 1250,
  vx: 0,
  vz: 0,
  omega: 0,
  ...values,
});
const energy = (b) =>
  (b.mass * (b.vx ** 2 + b.vz ** 2)) / 2 +
  (b.mass * (b.halfWidth ** 2 + b.halfLength ** 2) * b.omega ** 2) / 6;
test("oriented bounds reject separated lanes and bridge decks", () => {
  assert.equal(vehicleContact(body(), body({ x: 3 })), null);
  assert.equal(vehicleContact(body(), body({ y: 4 })), null);
  assert.ok(vehicleContact(body(), body({ z: 3.9 })));
  assert.ok(vehicleContact(body(), body({ x: 2.5, heading: Math.PI / 2 })));
});
test("rear impact transfers momentum without adding energy", () => {
  const a = body({ vz: 20 }),
    b = body({ z: 3.8, vz: 3 });
  const initial = energy(a) + energy(b),
    momentum = a.mass * a.vz + b.mass * b.vz;
  resolveVehicleContact(a, b);
  assert.ok(b.vz > 3 && a.vz < 20);
  assert.ok(Math.abs(a.mass * a.vz + b.mass * b.vz - momentum) < 1e-7);
  assert.ok(energy(a) + energy(b) <= initial);
  assert.equal(a.omega, 0);
  assert.equal(b.omega, 0);
});
test("off-centre impact produces rotation and heavier vehicles resist displacement", () => {
  const a = body({ vz: 18 }),
    b = body({ x: 1, z: 3.8 });
  const initial = energy(a) + energy(b);
  resolveVehicleContact(a, b);
  assert.ok(Math.abs(a.omega) > 0.1 && Math.abs(b.omega) > 0.1);
  assert.ok(energy(a) + energy(b) <= initial);
  const hit = (type) => {
    const p = body({ vz: 18 }),
      other = body({ z: 3.8, mass: vehicleMass(type) });
    resolveVehicleContact(p, other);
    return other.vz;
  };
  assert.ok(hit("bus") < hit("car"));
  assert.ok(hit("car") < hit("scooter"));
});
test("stationary overlap separates without bounce; head-on contacts dissipate energy", () => {
  const a = body(),
    b = body({ z: 3.8 });
  for (let i = 0; i < 4; i++) resolveVehicleContact(a, b);
  assert.equal(vehicleContact(a, b), null);
  assert.equal(energy(a) + energy(b), 0);
  a.vz = 20;
  b.vz = -20;
  b.z = a.z + 3.8;
  const before = energy(a) + energy(b);
  resolveVehicleContact(a, b);
  assert.ok(a.vz < 0 && b.vz > 0);
  assert.ok(energy(a) + energy(b) < before * 0.1);
});
test("traffic-to-traffic impacts work without player contact, decay and reset", () => {
  const make = (z, speed) => ({
    speed,
    sample: { x: 0, y: 0, z, heading: 0 },
    car: {
      type: "car",
      bounds: { halfWidth: 1, halfLength: 2 },
      group: { visible: true },
    },
  });
  const a = make(0, 20),
    b = make(3.8, 0),
    system = new TrafficCollisions();
  system.update(1 / 60, { x: 100, y: 0, z: 0, heading: 0, speed: 0 }, [a, b]);
  assert.ok(b.speed > 0);
  assert.equal(system.count, 1);
  assert.equal(system.last.player, false);
  const snapshot = system.snapshot;
  snapshot.last.speed = 999;
  assert.notEqual(system.last.speed, 999);
  for (let i = 0; i < 1200; i++) advanceTrafficImpact(a, 1 / 60);
  assert.ok(Math.abs(a.impactX) + Math.abs(a.impactZ) < 0.001);
  resetTrafficImpact(a);
  assert.equal(a.impactYaw, 0);
  assert.equal(a.impactHold, 0);
  system.reset();
  assert.equal(system.count, 0);
  assert.equal(system.cooldowns.size, 0);
});
test("player impact motion remains finite, decays, and resets", () => {
  const p = { x: 0, z: 0, heading: 0, impactVX: 7, impactVZ: 2, impactYaw: 1 };
  for (let i = 0; i < 600; i++) integrateImpact(p, 1 / 60);
  assert.ok(p.x > 0 && p.x < 4);
  assert.ok(p.heading > 0 && p.heading < 0.4);
  assert.ok(Math.abs(p.impactYaw) < 1e-8);
  clearImpact(p);
  assert.equal(p.impactVX, 0);
});

test("three-vehicle pile-up stays bounded across repeated contact solves", () => {
  const cars = [
    body({ vz: 28 }),
    body({ z: 3.8 }),
    body({ z: 7.6, mass: 6500 }),
  ];
  const initial = cars.reduce((sum, c) => sum + energy(c), 0);
  for (let frame = 0; frame < 180; frame++) {
    for (const c of cars) {
      c.x += c.vx / 60;
      c.z += c.vz / 60;
      c.heading += c.omega / 60;
    }
    for (let pass = 0; pass < 6; pass++)
      for (let i = 0; i < cars.length; i++)
        for (let j = i + 1; j < cars.length; j++)
          resolveVehicleContact(cars[i], cars[j]);
    assert.ok(
      cars.every((c) => Number.isFinite(c.x + c.z + c.vx + c.vz + c.omega)),
    );
    assert.ok(cars.reduce((sum, c) => sum + energy(c), 0) <= initial + 1e-6);
  }
  assert.ok(cars[2].vz > 0);
  for (let i = 0; i < cars.length - 1; i++)
    assert.ok((vehicleContact(cars[i], cars[i + 1])?.depth || 0) < 0.01);
});

test("spun traffic travels in its physical heading and then recovers gradually", () => {
  const c = {
    speed: 12,
    sample: { heading: 0.4 },
    impactHeading: 0.4,
    impactHold: 0.8,
  };
  advanceTrafficImpact(c, 1 / 60);
  assert.ok(c.impactX > 0);
  assert.ok(c.impactZ < 0);
  assert.equal(c.impactHeading, 0.4);
  c.speed = 0;
  for (let i = 0; i < 600; i++) advanceTrafficImpact(c, 1 / 60);
  assert.ok(c.impactHeading > 0 && c.impactHeading < 0.004);
});
