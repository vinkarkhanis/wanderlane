import { PHYS, ROAD, damp, clamp, angleDelta } from "./config.js";
import { terrainHeight } from "./heightfield.js";
// Bicycle steering with a smooth speed curve and a tyre lateral-force budget.
export function steeringAngle(speed) {
  return (
    PHYS.steeringAngle / (1 + (Math.abs(speed) / PHYS.steeringSpeed) ** 1.35)
  );
}
export function contactHeight(path, x, z, biome, height) {
  const p = (path.surfacePoint || path.findNearestRoadPoint).call(
    path,
    x,
    z,
    {},
    height,
  );
  const ground =
    path.groundHeight?.(x, z) ??
    (path.city
      ? p.y - 0.31
      : terrainHeight(path, p.distance, p.offset, biome) - 0.22);
  const edge = (p.width || ROAD.width) / 2;
  const shoulder = path.city ? 0.7 : ROAD.shoulder;
  const off = p.surfaceDistance ?? Math.abs(p.offset);
  const roadY = p.y - (path.city ? 0.015 : 0);
  if (
    p.elevated &&
    !p.bridge &&
    path.groundHeight &&
    off > edge + shoulder - 0.25
  ) {
    const r = path.roads[p.roadId],
      inner = edge + shoulder;
    if (off <= inner) return roadY - 0.05 + 0.015;
    // Match CityWorld's two embankment triangles alongside elevated approaches.
    const width =
      Math.max(
        r.y0 - path.groundHeight(...r.p) - 0.22,
        r.y1 - path.groundHeight(...r.q) - 0.22,
        1,
      ) * 1.5;
    if (off < inner + width) {
      const side = Math.sign(p.offset),
        outer = inner + width;
      const a = r.y0 + 0.022,
        b = r.y1 + 0.022;
      const c =
        path.groundHeight(
          r.p[0] + p.nx * outer * side,
          r.p[1] + p.nz * outer * side,
        ) + 0.02;
      const d =
        path.groundHeight(
          r.q[0] + p.nx * outer * side,
          r.q[1] + p.nz * outer * side,
        ) + 0.02;
      const u = p.fraction,
        v = (off - inner) / width;
      return (
        (u + v <= 1
          ? a * (1 - u - v) + b * u + c * v
          : d * (u + v - 1) + c * (1 - u) + b * (1 - v)) + 0.015
      );
    }
  }
  // A tyre contact patch straddles the small asphalt/shoulder lip.
  const lip = clamp((off - edge + 0.18) / 0.36, 0, 1);
  const verge = clamp((off - edge - shoulder + 0.25) / 0.5, 0, 1);
  return (
    (roadY - lip * (path.city ? 0.05 : 0.025)) * (1 - verge) +
    ground * verge +
    0.015
  );
}
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
    this.wheelAngle = 0;
    this.wheelHeights = null;
    this.roll = 0;
    this.override = 0;
    this.braking = false;
    this.squat = 0;
  }
  update(dt, input, auto, biome = "meadow", traffic = null) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const elapsed = Math.min(dt, PHYS.maxDelta);
    const steps = Math.ceil(elapsed / PHYS.maxStep);
    for (let i = 0; i < steps; i++)
      this.step(elapsed / steps, input, auto, biome, traffic);
  }
  step(dt, input, auto, biome, traffic) {
    const p = this.path.findNearestRoadPoint(this.x, this.z, this.near, this.y),
      off = p.surfaceDistance ?? Math.abs(p.offset);
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
    this.steer = damp(
      this.steer,
      steerTarget,
      auto ? 5 : steerTarget ? PHYS.steerIn : PHYS.steerOut,
      dt,
    );
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
    if (input.accel && !reverse && this.speed < 0) accel = PHYS.brake;
    if (!road && Math.abs(this.speed) > 14)
      accel -= Math.sign(this.speed) * (Math.abs(this.speed) - 14) * 2.5;
    this.speed = clamp(
      this.speed + accel * dt,
      reverse || this.speed < 0 ? -PHYS.reverseSpeed : 0,
      PHYS.maxSpeed,
    );
    this.wheelAngle =
      this.steer *
      (auto && !manual && this.override <= 0
        ? this.path.city
          ? 0.75
          : 0.42
        : steeringAngle(this.speed));
    const yaw =
      (this.speed / PHYS.wheelbase) * Math.tan(this.wheelAngle) * grip;
    const yawLimit = Math.min(
      0.7,
      (PHYS.lateralAcceleration * grip) / Math.max(1, Math.abs(this.speed)),
    );
    this.heading += clamp(yaw, -yawLimit, yawLimit) * dt;
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
    this.path.resolveContacts?.(this, dt);
    const s = Math.sin(this.heading),
      c = Math.cos(this.heading);
    const heights = [];
    for (const axle of PHYS.axles)
      for (const side of [-PHYS.halfTrack, PHYS.halfTrack])
        heights.push(
          contactHeight(
            this.path,
            this.x + s * axle + c * side,
            this.z + c * axle - s * side,
            biome,
            this.y,
          ),
        );
    this.wheelHeights = heights;
    const rear = (heights[0] + heights[1]) / 2,
      front = (heights[2] + heights[3]) / 2;
    const support = (rear + front) / 2;
    // Short suspension travel keeps damping from leaving the wheels below ground.
    this.y = clamp(
      damp(this.y, support, PHYS.suspensionRate, dt),
      support - PHYS.suspensionTravel,
      support + PHYS.suspensionTravel,
    );
    this.pitch = damp(
      this.pitch,
      Math.atan2(front - rear, PHYS.axles[1] - PHYS.axles[0]),
      12,
      dt,
    );
    this.roll = damp(
      this.roll,
      Math.atan2(
        (heights[1] + heights[3] - heights[0] - heights[2]) / 2,
        PHYS.halfTrack * 2,
      ),
      12,
      dt,
    );
    this.squat = damp(
      this.squat,
      clamp(((this.speed - previous) / dt) * 0.004, -0.035, 0.025),
      5,
      dt,
    );
    this.dist += (Math.abs(this.speed) * dt) / 1000;
  }
}
