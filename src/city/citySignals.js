import { wrappedDistance, signedDistance } from "./cityExperience.js";
import { nearest } from "./spatial.js";

export const SIGNAL_DURATIONS = { green: 18, amber: 3, red: 15 };
export function signalOffset(id) {
  let hash = 2166136261;
  for (const c of String(id))
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) % 36;
}
export function signalPhase(id, time) {
  const t = (((time + signalOffset(id)) % 36) + 36) % 36;
  return t < 18 ? "green" : t < 21 ? "amber" : "red";
}
export function signalPlan(path) {
  const result = [];
  for (const node of [...(path.nav.signals || [])].sort(
    (a, b) => a.id - b.id,
  )) {
    for (const seg of path.segments) {
      const n = nearest(node.p, seg.p, seg.q);
      if (n.d > 5 || (seg.tags.bridge && seg.tags.bridge !== "no")) continue;
      const s =
        (((seg.s + n.t * seg.length - 9) % path.length) + path.length) %
        path.length;
      if (
        result.some((o) => Math.abs(signedDistance(o.s, s, path.length)) < 40)
      )
        continue;
      result.push({ id: node.id, s, node: [...node.p] });
    }
  }
  return result.sort((a, b) => a.s - b.s);
}
export class CitySignals {
  constructor(path) {
    this.path = path;
    this.items = signalPlan(path);
    this.time = 0;
    this.previous = null;
    this.crossed = new Set();
  }
  reset(s) {
    this.previous = s;
    this.crossed.clear();
  }
  update(dt, v) {
    const before = this.time;
    this.time += dt;
    let violations = 0;
    if (this.previous !== null && v.near.routeGap < 9) {
      const delta = signedDistance(
        this.previous,
        v.near.distance,
        this.path.length,
      );
      if (delta > 0 && delta < Math.max(3, Math.abs(v.speed) * dt * 2 + 1))
        for (const light of this.items) {
          const gap = wrappedDistance(this.previous, light.s, this.path.length);
          if (gap > 0 && gap <= delta && !this.crossed.has(light.s)) {
            // Route projection alone is insufficient at adjacent carriageways
            // or grade-separated crossings. Require the actual stop-line lane,
            // height and forward heading before attributing a player violation.
            if (Number.isFinite(v.x)) {
              const p = this.path.getLanePosition(light.s, -1.6, {});
              const lateral = (v.x - p.x) * p.nx + (v.z - p.z) * p.nz;
              if (
                Math.abs(lateral) > Math.min(2.4, p.width / 2) ||
                Math.abs(v.y - p.y) > 2.5 ||
                Math.cos(v.heading - p.heading) < 0.5
              )
                continue;
            }
            if (signalPhase(light.id, before + (dt * gap) / delta) === "red")
              violations++;
            this.crossed.add(light.s);
          }
        }
    }
    this.previous = v.near.distance;
    for (const light of this.items)
      if (
        Math.abs(signedDistance(v.near.distance, light.s, this.path.length)) >
        50
      )
        this.crossed.delete(light.s);
    return violations;
  }
  stopDistance(s, halfLength = 2.3) {
    let distance = Infinity;
    for (const light of this.items) {
      const gap = wrappedDistance(s, light.s, this.path.length);
      if (gap < 100 && signalPhase(light.id, this.time) !== "green")
        distance = Math.min(distance, Math.max(0, gap - halfLength - 1));
    }
    return distance;
  }
  speedLimit(s, halfLength = 2.3) {
    const gap = this.stopDistance(s, halfLength);
    return gap < 0.15 ? 0 : Math.min(9, Math.sqrt(3 * gap), gap / 1.6);
  }
  get snapshot() {
    const result = {
      active: this.items.length,
      red: 0,
      amber: 0,
      green: 0,
      time: this.time,
      lights: [],
    };
    for (const l of this.items) {
      const phase = signalPhase(l.id, this.time);
      result[phase]++;
      result.lights.push({ ...l, node: [...l.node], phase });
    }
    return result;
  }
  dispose() {
    this.items = [];
    this.crossed.clear();
    this.previous = null;
  }
}
