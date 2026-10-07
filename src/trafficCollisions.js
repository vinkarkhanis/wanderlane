import {
  vehicleMass,
  resolveVehicleContact,
  clearImpact,
} from "./vehicleCollisions.js";

export function resetTrafficImpact(c) {
  clearImpact(c);
  c.impactX = 0;
  c.impactZ = 0;
  c.impactHeading = 0;
}
export function advanceTrafficImpact(c, dt) {
  // While spun, travel in the physical heading, not sideways along the route.
  // Route distance remains the navigation anchor; the offset carries deviation.
  const angle = c.impactHeading || 0,
    base = (c.sample?.heading || 0) - angle;
  c.impactX =
    (c.impactX || 0) + (Math.sin(base + angle) - Math.sin(base)) * c.speed * dt;
  c.impactZ =
    (c.impactZ || 0) + (Math.cos(base + angle) - Math.cos(base)) * c.speed * dt;
  c.impactX = (c.impactX || 0) + (c.impactVX || 0) * dt;
  c.impactZ = (c.impactZ || 0) + (c.impactVZ || 0) * dt;
  c.impactHeading = (c.impactHeading || 0) + (c.impactYaw || 0) * dt;
  c.impactHold = Math.max(0, (c.impactHold || 0) - dt);
  c.impactVX = (c.impactVX || 0) * Math.exp(-2.4 * dt);
  c.impactVZ = (c.impactVZ || 0) * Math.exp(-2.4 * dt);
  c.impactYaw = (c.impactYaw || 0) * Math.exp(-3.2 * dt);
  // Delayed, gradual AI recovery; an impacted car never snaps onto its rail.
  if (!c.impactHold) {
    const recover = Math.exp(-0.55 * dt);
    c.impactX *= recover;
    c.impactZ *= recover;
    c.impactHeading *= recover;
  }
}
function body(v, pose, bounds, mass) {
  const s = Math.sin(pose.heading),
    c = Math.cos(pose.heading);
  return {
    x: pose.x,
    z: pose.z,
    y: pose.y,
    heading: pose.heading,
    ...bounds,
    mass,
    vx: s * v.speed + (v.impactVX || 0),
    vz: c * v.speed + (v.impactVZ || 0),
    omega: v.impactYaw || 0,
  };
}
export class TrafficCollisions {
  constructor() {
    this.count = 0;
    this.last = null;
    this.time = 0;
    this.cooldowns = new Map();
  }
  update(dt, player, cars) {
    this.time += dt;
    for (const [key, until] of this.cooldowns)
      if (until < this.time) this.cooldowns.delete(key);
    const entries = [];
    if (
      (player.flight === undefined || player.flight === "ground") &&
      Number.isFinite(player.x) &&
      Number.isFinite(player.heading)
    )
      entries.push({
        v: player,
        player: true,
        pose: player,
        b: body(
          player,
          player,
          player.bounds || { halfWidth: 1.08, halfLength: 2.32 },
          player.mass || 1450,
        ),
      });
    cars.forEach((v, i) => {
      if (!v.waiting && v.car.group.visible)
        entries.push({
          v,
          id: i,
          pose: v.sample,
          b: body(v, v.sample, v.car.bounds, vehicleMass(v.car.type)),
        });
    });
    const originals = entries.map((e) => ({ ...e.b })),
      touched = new Set();
    for (let pass = 0; pass < 4; pass++)
      for (let i = 0; i < entries.length; i++)
        for (let j = i + 1; j < entries.length; j++) {
          const a = entries[i],
            b = entries[j],
            hit = resolveVehicleContact(a.b, b.b);
          if (!hit) continue;
          touched.add(i);
          touched.add(j);
          const key = `${a.player ? "player" : a.id}:${b.id}`;
          if (hit.closing > 1.5 && !this.cooldowns.has(key)) {
            this.cooldowns.set(key, this.time + 0.65);
            this.count++;
            this.last = {
              id: this.count,
              speed: hit.closing,
              x: hit.x,
              y: (a.b.y + b.b.y) / 2 + 0.6,
              z: hit.z,
              player: !!a.player,
              time: this.time,
            };
          }
        }
    for (const i of touched) {
      const e = entries[i],
        v = e.v,
        b = e.b,
        original = originals[i],
        s = Math.sin(b.heading),
        c = Math.cos(b.heading);
      v.speed = b.vx * s + b.vz * c;
      v.impactVX = b.vx - v.speed * s;
      v.impactVZ = b.vz - v.speed * c;
      v.impactYaw = Math.max(-1.6, Math.min(1.6, b.omega));
      v.impactHold = 0.8;
      if (e.player) {
        v.x = b.x;
        v.z = b.z;
        v.braking = true;
        v.squat = -Math.min(0.045, (this.last?.speed || 0) * 0.002);
      } else {
        v.impactX = (v.impactX || 0) + b.x - original.x;
        v.impactZ = (v.impactZ || 0) + b.z - original.z;
        v.brake = true;
      }
    }
  }
  get snapshot() {
    return { count: this.count, last: this.last ? { ...this.last } : null };
  }
  reset() {
    this.cooldowns.clear();
    this.count = 0;
    this.last = null;
    this.time = 0;
  }
}
