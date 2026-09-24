import { angleDelta, clamp } from "./config.js";

const fields = [
  "x",
  "y",
  "z",
  "pitch",
  "roll",
  "squat",
  "steer",
  "wheelAngle",
  "speed",
];
// Render one physics tick behind: every display refresh gets a continuous pose,
// without predicting collisions or feeding visual smoothing back into physics.
export class VehiclePose {
  constructor() {
    this.previous = {};
    this.pose = {};
    this.source = null;
  }
  capture(vehicle) {
    this.source = vehicle;
    for (const field of fields) this.previous[field] = vehicle[field] || 0;
    this.previous.heading = vehicle.heading;
    this.previous.wheelHeights = vehicle.wheelHeights?.slice() ?? null;
  }
  sample(vehicle, alpha, snap = false) {
    if (
      snap ||
      this.source !== vehicle ||
      Math.hypot(vehicle.x - this.previous.x, vehicle.z - this.previous.z) > 8
    )
      this.capture(vehicle);
    alpha = clamp(alpha, 0, 1);
    const p = this.previous,
      out = this.pose;
    for (const field of fields)
      out[field] = p[field] + ((vehicle[field] || 0) - p[field]) * alpha;
    out.heading = p.heading + angleDelta(vehicle.heading, p.heading) * alpha;
    out.wheelHeights =
      vehicle.wheelHeights?.map((height, i) => {
        const before = p.wheelHeights?.[i] ?? height;
        return before + (height - before) * alpha;
      }) ?? null;
    out.auto = vehicle.auto;
    return out;
  }
}
