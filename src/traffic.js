import { TrafficCar } from "./trafficCar.js";
import { ROAD, damp } from "./config.js";
import { random } from "./random.js";
export const TRAFFIC = ["Off", "Light", "Normal"];
export class Traffic {
  constructor(scene, path) {
    this.scene = scene;
    this.path = path;
    this.cars = [];
    this.pool = [];
    this.mode = 0;
    this.rng = random(path.hash ^ 91823);
  }
  setMode(mode, player) {
    this.mode = mode;
    const count = [0, 3, 7][mode];
    while (this.cars.length > count) {
      const c = this.cars.pop();
      c.car.group.visible = false;
      this.pool.push(c);
    }
    while (this.cars.length < count) {
      const i = this.cars.length,
        c = this.pool.pop() || {
          car: new TrafficCar(
            this.scene,
            [0xaaa38d, 0x6b8189, 0xa88063, 0x8a9188][i % 4],
            i % 4,
          ),
          sample: {},
        };
      c.car.group.visible = false;
      c.direction = i % 3 === 2 ? -1 : 1;
      c.lane = c.direction * ROAD.lane;
      c.preferred = 14 + this.rng() * 7;
      c.speed = c.preferred;
      this.cars.push(c);
      this.spawn(c, player, i * 65);
    }
  }
  spawn(c, player, extra = 0) {
    let s =
      player.near.distance +
      (c.direction === 1
        ? this.cars.indexOf(c) % 2 === 0
          ? 340 + extra * 0.25
          : -100 - extra
        : 220 + extra);
    for (let tries = 0; tries < 25; tries++) {
      if (
        this.cars.every(
          (o) => o === c || o.lane !== c.lane || Math.abs(o.s - s) > 35,
        ) &&
        Math.abs(s - player.near.distance) > 65
      )
        break;
      s += c.direction === 1 ? -42 : 42;
    }
    c.s = s;
    c.car.group.visible = true;
    this.place(c, 0, 0);
  }
  safeSpeed(s, lane, speed) {
    let target = 45;
    for (const c of this.cars) {
      const gap = c.s - s;
      if (Math.abs(c.lane - lane) < 2.1 && gap > 0 && gap < 90)
        target = Math.min(
          target,
          Math.max(0, (gap - 8) / 1.8),
          c.direction === 1
            ? c.speed + Math.max(0, (gap - 25) / 3)
            : Math.max(0, (gap - 10) / 4),
        );
    }
    return target;
  }
  update(dt, player, night) {
    for (const c of this.cars) {
      let target = c.preferred;
      const curve = Math.abs(
        this.path.getCurvatureAtDistance(c.s + 25 * c.direction),
      );
      target = Math.min(target, Math.sqrt(2.3 / Math.max(0.001, curve)));
      for (const other of this.cars) {
        if (other === c || other.lane !== c.lane) continue;
        const gap = (other.s - c.s) * c.direction;
        if (gap > 0) target = Math.min(target, Math.max(0, (gap - 7) / 1.8));
      }
      const pgap = (player.near.distance - c.s) * c.direction;
      if (Math.abs(player.near.offset - c.lane) < 2.1 && pgap > 0)
        target = Math.min(target, Math.max(0, (pgap - 9) / 1.8));
      const old = c.speed;
      c.speed = damp(c.speed, target, target < c.speed ? 3 : 0.5, dt);
      c.brake = c.speed < old - 0.005;
      c.s += c.speed * c.direction * dt;
      // Hard spacing bound prevents overlap even after a large catch-up step.
      for (const o of this.cars)
        if (o !== c && o.lane === c.lane) {
          const gap = (o.s - c.s) * c.direction;
          if (gap > 0 && gap < 5.4) {
            c.s = o.s - c.direction * 5.4;
            c.speed = Math.min(c.speed, o.speed);
          }
        }
      if (
        Math.abs(c.s - player.near.distance) > 560 ||
        (c.direction < 0 && c.s < player.near.distance - 110)
      )
        this.spawn(c, player, Math.floor(this.rng() * 3) * 65);
      this.place(c, dt, night);
      const dx = player.x - c.sample.x,
        dz = player.z - c.sample.z;
      const longitudinal = dx * c.sample.tx + dz * c.sample.tz,
        lateral = dx * c.sample.nx + dz * c.sample.nz;
      if (Math.abs(longitudinal) < 4.65 && Math.abs(lateral) < 1.95) {
        const side = lateral >= 0 ? 1 : -1;
        player.x += c.sample.nx * side * (1.96 - Math.abs(lateral));
        player.z += c.sample.nz * side * (1.96 - Math.abs(lateral));
        player.speed *= Math.exp(-5 * dt);
      }
    }
  }
  place(c, dt, night) {
    const p = this.path.getLanePosition(c.s, c.lane, c.sample);
    p.heading += c.direction < 0 ? Math.PI : 0;
    p.pitch *= c.direction;
    p.speed = c.speed;
    p.steer = this.path.getCurvatureAtDistance(c.s) * 6;
    c.car.place(p);
    c.car.update(dt, c.speed, night, c.brake);
    c.car.group.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
  }
  clearNear(s) {
    for (const c of this.cars)
      if (Math.abs(c.s - s) < 20) {
        c.s = s + 150 + this.cars.indexOf(c) * 50;
        this.place(c, 0, 0);
      }
  }
  dispose() {
    for (const c of [...this.cars, ...this.pool]) c.car.dispose();
    this.cars = [];
    this.pool = [];
  }
}
