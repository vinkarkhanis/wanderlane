import { Traffic } from "../traffic.js";
import { damp } from "../config.js";
import { CityVehicle, FLEET, followingGap } from "./cityVehicles.js";
import {
  resetTrafficImpact,
  advanceTrafficImpact,
} from "../trafficCollisions.js";
const delta = (a, b, l) => ((((a - b + l / 2) % l) + l) % l) - l / 2;
// Pilot traffic follows the curated directed route only. No random junction turns.
export class CityTraffic extends Traffic {
  trafficCount(mode) {
    return (
      this.quality === "Low"
        ? [0, 6, 12]
        : this.quality === "High"
          ? [0, 12, 28]
          : [0, 9, 20]
    )[mode];
  }
  createCar(i) {
    return new CityVehicle(this.scene, FLEET[i % FLEET.length], i);
  }
  setMode(mode, player) {
    super.setMode(mode, player);
    for (const c of this.cars) {
      c.direction = 1;
      c.lane = -1.6;
      c.preferred = c.car.spec.speed;
      c.speed = Math.min(c.speed, c.preferred);
    }
    for (let i = 0; i < this.cars.length; i++)
      this.spawn(this.cars[i], player, i * 19);
  }
  spawn(c, player, extra = 0) {
    resetTrafficImpact(c);
    c.direction = 1;
    c.lane = -1.6;
    const p = this.path.getLanePosition(player.near.distance, -1.6, {});
    const px = player.x ?? p.x,
      pz = player.z ?? p.z;
    const sample = (this.spawnSample ??= {});
    let s,
      found = false;
    for (let i = 0; i < 120; i++) {
      // Populate the visible approach first, then the wider local corridor.
      s = player.near.distance + 48 + ((extra + i * 23) % 410);
      this.path.getLanePosition(s, -1.6, sample);
      if (
        this.path.nearJunction(s) ||
        (this.signals?.stopDistance(s, 8) ?? Infinity) < 18 ||
        Math.abs(this.path.getCurvatureAtDistance(s)) > 0.04 ||
        Math.hypot(sample.x - px, sample.z - pz) < 42
      )
        continue;
      if (
        this.cars.some(
          (o) =>
            o !== c &&
            o.car.group.visible &&
            (Math.abs(delta(o.s, s, this.path.length)) <
              Math.max(15, followingGap(c.car.bounds, o.car.bounds) + 5) ||
              Math.hypot(sample.x - o.sample.x, sample.z - o.sample.z) < 12),
        )
      )
        continue;
      found = true;
      break;
    }
    c.car.group.visible = found;
    c.waiting = !found;
    c.retry = 1;
    if (!found) return;
    c.s = s;
    this.place(c, 0, 0);
  }
  safeSpeed(s, lane, speed) {
    let target = this.signals?.speedLimit(s) ?? 9;
    for (const c of this.cars) {
      if (c.waiting) continue;
      const gap = delta(c.s, s, this.path.length);
      if (gap > 0 && gap < 65)
        target = Math.min(
          target,
          Math.max(0, (gap - c.car.bounds.halfLength - 5) / 2),
        );
    }
    return target;
  }
  update(dt, player, night) {
    if (dt > 0.02) {
      const total = Math.min(dt, 0.1),
        steps = Math.ceil(total * 60);
      for (let i = 0; i < steps; i++) this.update(total / steps, player, night);
      return;
    }
    for (const c of this.cars) {
      advanceTrafficImpact(c, dt);
      if (c.waiting) {
        c.retry -= dt;
        if (c.retry <= 0) this.spawn(c, player, this.cars.indexOf(c) * 43);
        continue;
      }
      let target = Math.min(
        c.impactHold ? 0 : c.preferred,
        this.signals?.speedLimit(c.s, c.car.bounds.halfLength) ?? 9,
        Math.sqrt(
          1.4 /
            Math.max(
              0.002,
              Math.abs(this.path.getCurvatureAtDistance(c.s + 12)),
            ),
        ),
      );
      for (const o of this.cars) {
        if (o === c || o.waiting) continue;
        const gap = delta(o.s, c.s, this.path.length);
        if (gap > 0)
          target = Math.min(
            target,
            Math.max(0, (gap - followingGap(c.car.bounds, o.car.bounds)) / 2),
          );
      }
      const pg = delta(player.near.distance, c.s, this.path.length);
      if (
        (!player.flight || player.flight === "ground") &&
        pg > 0 &&
        player.near.routeGap < 8
      )
        target = Math.min(target, Math.max(0, (pg - 10) / 2));
      const old = c.speed;
      c.speed = damp(
        c.speed,
        target,
        target < old ? 4 : c.car.spec.acceleration,
        dt,
      );
      c.brake = c.speed < old - 0.002;
      let advance = Math.min(
        c.speed * dt,
        this.signals?.stopDistance(c.s, c.car.bounds.halfLength) ?? Infinity,
      );
      if (
        (!player.flight || player.flight === "ground") &&
        pg > 0 &&
        player.near.routeGap < 8
      )
        advance = Math.min(
          advance,
          Math.max(0, pg - c.car.bounds.halfLength - 4.3),
        );
      for (const o of this.cars) {
        if (o === c || o.waiting) continue;
        const gap = delta(o.s, c.s, this.path.length);
        if (gap > 0)
          advance = Math.min(
            advance,
            Math.max(
              0,
              gap - c.car.bounds.halfLength - o.car.bounds.halfLength - 2,
            ),
          );
      }
      c.s += advance;
      if (advance < c.speed * dt) c.speed = advance / dt;
      if (Math.abs(delta(c.s, player.near.distance, this.path.length)) > 500)
        this.spawn(c, player, this.cars.indexOf(c) * 65);
      if (c.waiting) continue;
      this.place(c, dt, night);
    }
    this.resolveCollisions(dt, player, night);
  }
  clearNear(s) {
    for (let i = 0; i < this.cars.length; i++)
      if (Math.abs(delta(this.cars[i].s, s, this.path.length)) < 30)
        this.spawn(this.cars[i], { near: { distance: s } }, i * 65);
  }
}
