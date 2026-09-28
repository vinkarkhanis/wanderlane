import { roadName } from "./cityDetails.js";

export const wrappedDistance = (from, to, length) =>
  (((to - from) % length) + length) % length;
export const signedDistance = (from, to, length) =>
  wrappedDistance(from, to + length / 2, length) - length / 2;
export function scoreTrip({
  hardBrakes = 0,
  hardAccelerations = 0,
  offRoadTime = 0,
  redLightViolations = 0,
}) {
  const points =
    hardBrakes +
    hardAccelerations +
    Math.floor(offRoadTime / 5) +
    redLightViolations * 3;
  return {
    quality:
      points === 0 ? "Smooth" : points < 5 ? "Mostly smooth" : "Eventful",
    reason: redLightViolations
      ? `${redLightViolations} red-light crossing(s). Leave room to stop.`
      : offRoadTime >= 5
        ? `${Math.round(offRoadTime)} seconds outside the road corridor.`
        : hardBrakes
          ? `${hardBrakes} hard-braking event(s). Leave a little more space.`
          : hardAccelerations
            ? "Try easing into the accelerator."
            : "Gentle braking and a steady line. Time well spent.",
  };
}

// Source-backed anchors on the existing directed loop. See docs/pune-experience.md.
export function chaiTrip(path) {
  const start = 9690;
  const objectives = [
    {
      s: 440,
      label: "Leave Baner · Pancard Club Road",
      district: "Baner",
      event: "evening-chai-crowd",
    },
    {
      s: 2875,
      label: "Baner–Pashan Link Road junction",
      district: "Baner Road",
      event: "shoulder-roadworks",
    },
    { s: 3880, label: "Enter Park Ridge Road", district: "Pashan approach" },
    {
      s: 4935,
      label: "Pashan–Sus Road · lake approach",
      district: "Pashan approach",
    },
  ].map((o) => ({ ...o, distance: wrappedDistance(start, o.s, path.length) }));
  return {
    id: "evening-chai-run",
    name: "Evening Chai Run",
    description:
      "A relaxed sunset drive from the Baner High Street area toward Pashan Lake.",
    start,
    objectives,
    distance: objectives.at(-1).distance,
  };
}

export class CityExperience {
  constructor(path, definition = chaiTrip(path)) {
    this.path = path;
    this.definition = definition;
    this.reset("idle");
  }
  reset(status = "idle") {
    this.status = status;
    this.objectiveIndex = 0;
    this.travel = 0;
    this.highWater = 0;
    this.elapsed = 0;
    this.hardBrakes = 0;
    this.hardAccelerations = 0;
    this.accelLatch = false;
    this.offRoadTime = 0;
    this.routeDepartures = 0;
    this.redLightViolations = 0;
    this.eventsSeen = [];
    this.last = this.definition.start;
    this.lastSpeed = 0;
    this.brakeLatch = false;
    this.outside = false;
    this.road = "";
    this.marathi = "";
  }
  start() {
    if (!this.disposed) this.reset("active");
  }
  cancel() {
    this.reset("cancelled");
  }
  dispose() {
    this.cancel();
    this.disposed = true;
  }
  update(dt, v, violations = 0) {
    if (this.disposed || this.status !== "active" || !(dt > 0)) return;
    this.elapsed += dt;
    const outside =
      (v.near.surfaceDistance ?? Math.abs(v.near.offset ?? 0)) >
      (v.near.width ?? 7) / 2 + 2;
    if (outside) {
      this.offRoadTime += dt;
      if (!this.outside) this.routeDepartures++;
    }
    this.outside = outside;
    const braking =
      !v.auto &&
      v.braking &&
      this.lastSpeed > 5 &&
      (this.lastSpeed - v.speed) / dt > 4;
    if (braking && !this.brakeLatch) this.hardBrakes++;
    if (braking) this.brakeLatch = true;
    if (!v.braking) this.brakeLatch = false;
    const hardAcceleration =
      !v.auto && this.lastSpeed > 2 && (v.speed - this.lastSpeed) / dt > 4.5;
    if (hardAcceleration && !this.accelLatch) this.hardAccelerations++;
    this.accelLatch = hardAcceleration;
    this.lastSpeed = v.speed;
    this.redLightViolations += violations;
    const delta = signedDistance(this.last, v.near.distance, this.path.length);
    this.last = v.near.distance;
    // Reject projection jumps, teleports and off-route shortcuts. Rejoining resumes
    // from the last earned distance; reverse travel must be driven back first.
    if (
      v.near.routeGap > 9 ||
      outside ||
      Math.abs(delta) > Math.max(3, Math.abs(v.speed) * dt * 2 + 1)
    )
      return;
    this.travel = Math.max(0, this.travel + delta);
    this.highWater = Math.max(this.highWater, this.travel);
    const tags = this.path.segment(v.near.distance).tags;
    this.road = roadName(tags.name) || "the local road";
    this.marathi = roadName(tags["name:mr"]);
    const objective = this.definition.objectives[this.objectiveIndex];
    // Both earned distance and physical proximity are required to complete an objective.
    if (
      objective &&
      this.highWater >= objective.distance - 12 &&
      Math.abs(signedDistance(v.near.distance, objective.s, this.path.length)) <
        20
    ) {
      this.objectiveIndex++;
      if (this.objectiveIndex === this.definition.objectives.length) {
        this.status = "completed";
        this.journal?.complete(this.snapshot);
      }
    }
  }
  encounter(id) {
    if (!this.disposed) this.journal?.encounter(id);
    if (this.status === "active" && !this.eventsSeen.includes(id))
      this.eventsSeen.push(id);
  }
  get snapshot() {
    const d = this.definition,
      o = d.objectives[this.objectiveIndex],
      score = scoreTrip(this);
    return {
      available: !this.disposed,
      tripId: d.id,
      name: d.name,
      description: d.description,
      status: this.status,
      objectiveIndex: this.objectiveIndex,
      objectiveLabel: o?.label ?? "Arrived",
      nextDistance:
        this.status === "completed"
          ? 0
          : Math.max(0, (o?.distance ?? d.distance) - this.highWater),
      remaining:
        this.status === "completed"
          ? 0
          : Math.max(0, d.distance - this.highWater),
      distance: d.distance,
      progress:
        this.status === "completed"
          ? 1
          : Math.min(1, this.highWater / d.distance),
      elapsed: this.elapsed,
      ...score,
      hardBrakes: this.hardBrakes,
      hardAccelerations: this.hardAccelerations,
      offRoadTime: this.offRoadTime,
      routeDepartures: this.routeDepartures,
      redLightViolations: this.redLightViolations,
      eventsSeen: [...this.eventsSeen],
      road: this.road,
      marathi: this.marathi,
      district: o?.district ?? d.objectives.at(-1)?.district ?? "Pune",
    };
  }
}
