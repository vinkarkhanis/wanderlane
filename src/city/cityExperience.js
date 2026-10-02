import { roadName } from "./cityDetails.js";
import {
  JOURNEY_PLACES,
  bayContains,
  turnGuidance,
  streetCharacter,
} from "./puneJourney.js";

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
      s: JOURNEY_PLACES["pashan-chai"].s,
      label: "Pull in for chai · Pashan approach",
      district: "Pashan approach",
    },
  ].map((o) => ({
    ...o,
    s: path.journeyDistance?.(o.s) ?? o.s,
    distance: wrappedDistance(
      path.journeyDistance?.(start) ?? start,
      path.journeyDistance?.(o.s) ?? o.s,
      path.length,
    ),
  }));
  return {
    id: "evening-chai-run",
    name: "Evening Chai Run",
    description:
      "A relaxed sunset drive from the Baner High Street area toward Pashan Lake.",
    start: path.journeyDistance?.(start) ?? start,
    arrival: {
      ...JOURNEY_PLACES["pashan-chai"],
      s: path.journeyDistance?.(4905) ?? 4905,
    },
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
    this.arrivalDwell = 0;
    this.arrivalDistance = Infinity;
    this.guidance = "";
    this.character = "residential";
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
    const arrival = this.definition.arrival;
    const approaching =
      arrival &&
      this.objectiveIndex === this.definition.objectives.length - 1 &&
      this.highWater >= this.definition.distance - 70;
    this.arrivalDistance = arrival
      ? Math.hypot(v.x - arrival.x, v.z - arrival.z)
      : Infinity;
    const atBay = approaching && bayContains(arrival, v.x, v.z);
    const inApproach =
      approaching && this.arrivalDistance < 40 && v.near.routeGap < 14;
    if (outside && !inApproach) {
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
    this.guidance = inApproach
      ? atBay
        ? "Stop here and take a moment"
        : "Pull into the marked bay on the left"
      : this.path.segments
        ? turnGuidance(this.path, v.near.distance)
        : "";
    this.character = streetCharacter(this.path.segment(v.near.distance));
    if (approaching) {
      this.arrivalDwell =
        atBay && Math.abs(v.speed) < 0.5 ? this.arrivalDwell + dt : 0;
      if (this.arrivalDwell >= 2) {
        this.objectiveIndex++;
        this.status = "completed";
        this.journal?.complete(this.snapshot);
        return;
      }
    }
    const delta = signedDistance(this.last, v.near.distance, this.path.length);
    this.last = v.near.distance;
    // Reject projection jumps, teleports and off-route shortcuts. Rejoining resumes
    // from the last earned distance; reverse travel must be driven back first.
    if (
      v.near.routeGap > 9 ||
      (outside && !inApproach) ||
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
      !(
        arrival && this.objectiveIndex === this.definition.objectives.length - 1
      ) &&
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
  drivePosition(s, lane, out) {
    this.path.getLanePosition(s, lane, out);
    const a = this.definition.arrival;
    if (
      !a ||
      this.status !== "active" ||
      this.objectiveIndex !== this.definition.objectives.length - 1
    )
      return out;
    const gap = signedDistance(s, a.s, this.path.length);
    if (gap > 80 || gap < -30) return out;
    const t = Math.min(1, Math.max(0, (80 - gap) / 60));
    // Ease away from the travel lane into the clear roadside bay.
    const blend = t * t * (3 - 2 * t);
    const end = this.path.getLanePosition(a.s, lane, {});
    out.x += (a.x - end.x) * blend;
    out.z += (a.z - end.z) * blend;
    if (gap <= 0) {
      out.x = a.x;
      out.z = a.z;
    }
    return out;
  }
  arrivalSpeedLimit(v) {
    const a = this.definition.arrival;
    if (
      !a ||
      this.status !== "active" ||
      this.objectiveIndex !== this.definition.objectives.length - 1
    )
      return Infinity;
    const gap = signedDistance(v.near.distance, a.s, this.path.length);
    if (gap > 80 || gap < -30) return Infinity;
    return Math.min(
      3,
      Math.sqrt(2.4 * Math.max(0, Math.hypot(v.x - a.x, v.z - a.z) - 0.8)),
    );
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
      guidance: this.guidance,
      character: this.character,
      arrival: d.arrival
        ? {
            ...d.arrival,
            distance: this.arrivalDistance,
            dwell: this.arrivalDwell,
          }
        : null,
      routeChoice: this.path.journeyChoice ?? "main",
      finalObjective: this.objectiveIndex === d.objectives.length - 1,
    };
  }
}
