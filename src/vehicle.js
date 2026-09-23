import { PHYS, ROAD, damp, clamp, angleDelta } from "./config.js";
import { terrainHeight } from "./heightfield.js";
export class Vehicle {
  constructor(path) {
    this.path = path;
    this.speed = 0;
    this.steer = 0;
    this.dist = 0;
    this.squat = 0;
    this.throttle = 0;
    this.lane = ROAD.lane;
    this.near = {};
    this.target = {};
    this.reset(40, 0);
  }
  reset(distance = this.near.distance, offset = this.lane) {
    const p = this.path.getLanePosition(distance, offset, this.near);
    this.x = p.x;
    this.z = p.z;
    this.y = p.y;
    this.heading = p.heading;
    this.pitch = p.pitch;
    this.speed = 0;
    this.steer = 0;
    this.throttle = 0;
    this.override = 0;
    this.braking = false;
    this.squat = 0;
  }
  update(dt, input, auto, biome = "meadow", traffic = null) {
    const p = this.path.findNearestRoadPoint(this.x, this.z, this.near, this.y),
      off = Math.abs(p.offset);
    this.surface =
      off <= (p.width || 8) / 2
        ? "Asphalt"
        : off < (p.width || 8) / 2 + 1.1
          ? "Gravel"
          : biome === "snow"
            ? "Snow"
            : biome === "desert"
              ? "Sand"
              : "Grass";
    const road = off <= (p.width || 8) / 2,
      grip = road ? 1 : biome === "snow" ? 0.48 : 0.65;
    const manual = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    let steerTarget = manual,
      goal = this.path.city ? 8 : PHYS.cruise;
    if (auto) {
      const look = this.path.city
          ? 4 + Math.abs(this.speed) * 0.55
          : 9 + Math.abs(this.speed) * 0.9,
        t = this.path.getLanePosition(
          p.distance + look,
          this.lane,
          this.target,
        );
      const error = angleDelta(
        Math.atan2(t.x - this.x, t.z - this.z),
        this.heading,
      );
      if (this.path.city) goal = Math.min(goal, 8 / (1 + Math.abs(error) * 3));
      steerTarget = clamp(
        Math.atan2(
          2 * PHYS.wheelbase * Math.sin(error),
          this.path.city
            ? Math.max(2, Math.hypot(t.x - this.x, t.z - this.z))
            : look,
        ) / (this.path.city ? 0.75 : 0.42),
        -1,
        1,
      );
      let curve = 0;
      for (let i = 0; i < 5; i++)
        curve = Math.max(
          curve,
          Math.abs(this.path.getCurvatureAtDistance(p.distance + i * 14)),
        );
      goal = Math.min(
        goal,
        Math.sqrt((this.path.city ? 1.2 : 2.4) / Math.max(0.001, curve)),
      );
      if (traffic)
        goal = Math.min(
          goal,
          traffic.safeSpeed(p.distance, p.offset, this.speed),
        );
      if (manual) {
        steerTarget = manual;
        this.override = 0.65;
      } else if (this.override > 0) {
        this.override -= dt;
        steerTarget = 0;
      }
    }
    this.steer = damp(this.steer, steerTarget, 5, dt);
    const previous = this.speed;
    let drive = auto
      ? clamp((goal - this.speed) * 0.6, -1, 1)
      : input.accel
        ? 1
        : 0;
    if (input.brake) drive = -1;
    this.throttle = damp(this.throttle, Math.max(0, drive), 4, dt);
    this.braking = drive < -0.08 && this.speed > 0.2;
    const reverse = (input.reverse || input.brake) && !auto;
    let accel =
      this.throttle * PHYS.acceleration -
      (0.12 + Math.abs(this.speed) * 0.012) *
        (road ? 1 : 3.5) *
        Math.sign(this.speed);
    if (drive < 0 && this.speed > 0) accel += drive * PHYS.brake;
    if (reverse) accel = this.speed > 0.1 ? -PHYS.brake : -2;
    if (input.accel && this.speed < 0) accel = PHYS.brake;
    if (!road && this.speed > 14) accel -= (this.speed - 14) * 2.5;
    this.speed = clamp(
      this.speed + accel * dt,
      reverse ? -PHYS.reverseSpeed : 0,
      PHYS.maxSpeed,
    );
    const authority = auto ? 1 : 1 / (1 + Math.abs(this.speed) * 0.024),
      yaw =
        (this.speed / PHYS.wheelbase) *
        Math.tan(this.steer * (this.path.city ? 0.75 : 0.42) * authority) *
        grip;
    this.heading += clamp(yaw, -0.7, 0.7) * dt;
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.path.findNearestRoadPoint(this.x, this.z, p, this.y);
    this.path.constrainRoad?.(this, dt);
    if (
      this.path.hasRail(p.distance, biome) &&
      Math.abs(p.offset) > ROAD.railOffset - 1.14 &&
      Math.abs(p.offset) < ROAD.railOffset + 1.4
    ) {
      const side = Math.sign(p.offset),
        limit = ROAD.railOffset - 1.15;
      this.x = p.x + p.nx * limit * side;
      this.z = p.z + p.nz * limit * side;
      this.speed *= Math.exp(-3 * dt);
      this.heading +=
        angleDelta(p.heading, this.heading) * (1 - Math.exp(-2 * dt));
    }
    this.y = this.path.city
      ? Math.abs(p.offset) <= p.width / 2 + 1
        ? p.y
        : (this.path.groundHeight?.(this.x, this.z) ?? p.y)
      : terrainHeight(this.path, p.distance, p.offset, biome) +
        (Math.abs(p.offset) <= 5.1 ? 0.065 : -0.2);
    this.pitch = damp(this.pitch, p.pitch, 8, dt);
    this.squat = damp(
      this.squat,
      clamp(((this.speed - previous) / dt) * 0.004, -0.035, 0.025),
      5,
      dt,
    );
    this.path.resolveContacts?.(this, dt);
    this.dist += (Math.abs(this.speed) * dt) / 1000;
  }
}
