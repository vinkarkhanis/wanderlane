import { Traffic } from "../traffic.js";
import { damp } from "../config.js";
const delta = (a, b, l) => ((((a - b + l / 2) % l) + l) % l) - l / 2;
// Pilot traffic follows the curated directed route only. No random junction turns.
export class CityTraffic extends Traffic {
  setMode(mode, player) {
    super.setMode(mode, player);
    for (const c of this.cars) {
      c.direction = 1;
      c.lane = -1.6;
      c.preferred = 7 + this.rng() * 2;
      c.speed = Math.min(c.speed, c.preferred);
    }
    for (let i = 0; i < this.cars.length; i++)
      this.spawn(this.cars[i], player, i * 65);
  }
  spawn(c, player, extra = 0) {
    c.direction = 1;
    c.lane = -1.6;
    const p = this.path.getLanePosition(player.near.distance, -1.6, {});
    const px = player.x ?? p.x,
      pz = player.z ?? p.z;
    const sample = (this.spawnSample ??= {});
    let s,
      found = false;
    for (let i = 0; i < 80; i++) {
      s = player.near.distance + 120 + ((extra + i * 31) % 330);
      this.path.getLanePosition(s, -1.6, sample);
      if (
        this.path.nearJunction(s) ||
        Math.abs(this.path.getCurvatureAtDistance(s)) > 0.04 ||
        Math.hypot(sample.x - px, sample.z - pz) < 85
      )
        continue;
      if (
        this.cars.some(
          (o) =>
            o !== c &&
            o.car.group.visible &&
            (Math.abs(delta(o.s, s, this.path.length)) < 28 ||
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
    let target = 9;
    for (const c of this.cars) {
      if (c.waiting) continue;
      const gap = delta(c.s, s, this.path.length);
      if (gap > 0 && gap < 65)
        target = Math.min(target, Math.max(0, (gap - 10) / 2));
    }
    return target;
  }
  update(dt, player, night) {
    for (const c of this.cars) {
      if (c.waiting) {
        c.retry -= dt;
        if (c.retry <= 0) this.spawn(c, player, this.cars.indexOf(c) * 43);
        continue;
      }
      let target = Math.min(
        c.preferred,
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
        if (gap > 0) target = Math.min(target, Math.max(0, (gap - 8) / 2));
      }
      const pg = delta(player.near.distance, c.s, this.path.length);
      if (pg > 0 && player.near.routeGap < 8)
        target = Math.min(target, Math.max(0, (pg - 10) / 2));
      const old = c.speed;
      c.speed = damp(c.speed, target, target < old ? 4 : 0.7, dt);
      c.brake = c.speed < old - 0.002;
      c.s += c.speed * dt;
      if (Math.abs(delta(c.s, player.near.distance, this.path.length)) > 500)
        this.spawn(c, player, this.cars.indexOf(c) * 65);
      if (c.waiting) continue;
      this.place(c, dt, night);
      const dx = player.x - c.sample.x,
        dz = player.z - c.sample.z;
      if (Math.hypot(dx, dz) < 4.5) {
        player.speed *= Math.exp(-6 * dt);
        const l = Math.hypot(dx, dz) || 1;
        player.x += (dx / l) * 0.4 * dt;
        player.z += (dz / l) * 0.4 * dt;
      }
    }
  }
  clearNear(s) {
    for (let i = 0; i < this.cars.length; i++)
      if (Math.abs(delta(this.cars[i].s, s, this.path.length)) < 30)
        this.spawn(this.cars[i], { near: { distance: s } }, i * 65);
  }
}
