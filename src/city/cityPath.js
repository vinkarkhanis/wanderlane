import { buildConnectors, sampleConnector } from "./laneConnectors.js";
import { Grid, nearest } from "./spatial.js";
const mod = (s, n) => ((s % n) + n) % n;
export class CityPath {
  constructor(nav, manifest) {
    this.city = true;
    this.hash = 181552;
    this.seed = "pune-osm";
    this.nav = nav;
    this.manifest = manifest;
    this.roads = nav.roads;
    this.bounds = nav.bounds;
    this.grid = new Grid(80);
    this.routeGrid = new Grid(80);
    this.segments = [];
    for (const r of this.roads)
      this.grid.insert(r, [
        Math.min(r.p[0], r.q[0]) - 20,
        Math.min(r.p[1], r.q[1]) - 20,
        Math.max(r.p[0], r.q[0]) + 20,
        Math.max(r.p[1], r.q[1]) + 20,
      ]);
    let distance = 0;
    for (const e of nav.route.edges) {
      const r = this.roads[e.road],
        a = e.dir === 1 ? r.p : r.q,
        b = e.dir === 1 ? r.q : r.p;
      const seg = {
        ...r,
        index: this.segments.length,
        p: a,
        q: b,
        y0: e.dir === 1 ? r.y0 : r.y1,
        y1: e.dir === 1 ? r.y1 : r.y0,
        s: distance,
        dir: e.dir,
      };
      this.segments.push(seg);
      this.routeGrid.insert(seg, [
        Math.min(a[0], b[0]) - 30,
        Math.min(a[1], b[1]) - 30,
        Math.max(a[0], b[0]) + 30,
        Math.max(a[1], b[1]) + 30,
      ]);
      distance += r.length;
    }
    this.length = distance;
    const neighbors = new Map();
    for (const r of this.roads)
      for (const [a, b] of [
        [r.a, r.b],
        [r.b, r.a],
      ]) {
        if (!neighbors.has(a)) neighbors.set(a, new Set());
        neighbors.get(a).add(b);
      }
    const signals = new Set((nav.signals || []).map((n) => n.id));
    this.junctionDistances = this.segments
      .filter(
        (r) =>
          (neighbors.get(r.dir === 1 ? r.a : r.b)?.size || 0) > 2 ||
          signals.has(r.dir === 1 ? r.a : r.b),
      )
      .map((r) => r.s);

    this.connectors = buildConnectors(this.segments);
    this.laneGrid = new Grid(40);
    const samples = [];
    for (let s = 0; s < this.length; s += 2)
      samples.push({ ...this.getLanePosition(s, -1.6), s });
    samples.push({
      ...this.getLanePosition(this.length, -1.6),
      s: this.length,
    });
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1],
        b = samples[i],
        g = {
          p: [a.x, a.z],
          q: [b.x, b.z],
          s: a.s,
          end: b.s,
          y0: a.y,
          y1: b.y,
        };
      this.laneGrid.insert(g, [
        Math.min(a.x, b.x) - 5,
        Math.min(a.z, b.z) - 5,
        Math.max(a.x, b.x) + 5,
        Math.max(a.z, b.z) + 5,
      ]);
    }
  }
  segment(s) {
    s = mod(s, this.length);
    let lo = 0,
      hi = this.segments.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.segments[mid].s <= s) lo = mid;
      else hi = mid;
    }
    return this.segments[lo];
  }
  sampleRoad(r, t, out = {}) {
    const dx = r.q[0] - r.p[0],
      dz = r.q[1] - r.p[1],
      l = Math.hypot(dx, dz);
    Object.assign(out, {
      x: r.p[0] + dx * t,
      z: r.p[1] + dz * t,
      y: r.y0 + (r.y1 - r.y0) * t + 0.09,
      tx: dx / l,
      tz: dz / l,
      nx: -dz / l,
      nz: dx / l,
      width: r.width,
      heading: Math.atan2(dx, dz),
      pitch: Math.atan2(r.y1 - r.y0, l),
      roadId: r.id,
      oneway: r.oneway,
      bridge: !!r.tags.bridge && r.tags.bridge !== "no",
      speedLimit: Math.min(11, parseFloat(r.tags.maxspeed) / 3.6 || 9),
      height: r.y0 + (r.y1 - r.y0) * t,
    });
    return out;
  }
  sampleAtDistance(s, out = {}) {
    const r = this.segment(s);
    this.sampleRoad(r, (mod(s, this.length) - r.s) / r.length, out);
    out.distance = s;
    out.curvature = this.getCurvatureAtDistance(s);
    return out;
  }
  getCurvatureAtDistance(s) {
    const a = this.segment(s - 8),
      b = this.segment(s + 8),
      aa = Math.atan2(a.q[0] - a.p[0], a.q[1] - a.p[1]),
      bb = Math.atan2(b.q[0] - b.p[0], b.q[1] - b.p[1]);
    return Math.atan2(Math.sin(bb - aa), Math.cos(bb - aa)) / 16;
  }
  nearJunction(s, padding = 18) {
    s = mod(s, this.length);
    let lo = 0,
      hi = this.junctionDistances.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.junctionDistances[mid] < s) lo = mid + 1;
      else hi = mid;
    }
    if (!this.junctionDistances.length) return false;
    for (const i of [lo - 1, lo]) {
      const d = this.junctionDistances[mod(i, this.junctionDistances.length)];
      if (
        Math.abs(mod(d - s + this.length / 2, this.length) - this.length / 2) <
        padding
      )
        return true;
    }
    return false;
  }
  laneOffset(s, direction = 1) {
    const r = this.segment(s);
    return r.oneway ? 0 : -direction * Math.min(1.7, r.width / 4);
  }
  getLanePosition(s, offset = -1.6, out = {}) {
    this.sampleAtDistance(s, out);
    const lane = this.laneOffset(s, offset > 0 ? -1 : 1);
    out.x += out.nx * lane;
    out.z += out.nz * lane;
    if (offset <= 0) {
      const seg = this.segment(s),
        local = mod(s, this.length) - seg.s;
      const before = this.connectors[seg.index],
        after = this.connectors[(seg.index + 1) % this.segments.length];
      if (before && local < before.after)
        sampleConnector(
          before,
          (before.before + local) / (before.before + before.after),
          out,
        );
      else if (after && local > seg.length - after.before)
        sampleConnector(
          after,
          (local - seg.length + after.before) / (after.before + after.after),
          out,
        );
    }
    return out;
  }
  routeNearest(x, z, hint = 0) {
    let best = { d: Infinity };
    let candidates = this.routeGrid.query(x, z, 100);
    if (!candidates.size) candidates = this.segments;
    for (const r of candidates) {
      const n = nearest([x, z], r.p, r.q),
        s = r.s + n.t * r.length,
        delta = Math.abs(
          mod(s - hint + this.length / 2, this.length) - this.length / 2,
        );
      const score = n.d + Math.min(delta * 0.003, 8);
      if (score < (best.score ?? Infinity)) best = { ...n, r, s, score };
    }
    return best;
  }
  findNearestRoadPoint(x, z, out = {}, height) {
    let best = { d: Infinity };
    let candidates = this.grid.query(x, z, 100);
    if (!candidates.size) candidates = this.roads;
    for (const r of candidates) {
      const n = nearest([x, z], r.p, r.q);
      const y = r.y0 + (r.y1 - r.y0) * n.t + 0.09;
      // Height separates overlapping bridge/ground roads. The small continuity
      // bias prevents equal-distance intersection samples alternating every tick.
      const score =
        n.d * n.d +
        (Number.isFinite(height) ? (y - height) ** 2 * 4 : 0) -
        (r.id === out.roadId ? 0.04 : 0);
      if (score < (best.score ?? Infinity)) best = { ...n, r, score };
    }
    const route = this.routeNearest(x, z, out.distance || 0);
    this.sampleRoad(best.r, best.t, out);
    out.offset = (x - out.x) * out.nx + (z - out.z) * out.nz;
    let progress = route.s,
      score = Infinity;
    for (const g of Number.isFinite(height)
      ? this.laneGrid.query(x, z, 12)
      : []) {
      const n = nearest([x, z], g.p, g.q),
        s = g.s + (g.end - g.s) * n.t;
      const along = Math.abs(
        mod(s - (out.distance ?? route.s) + this.length / 2, this.length) -
          this.length / 2,
      );
      const vertical = Number.isFinite(height)
        ? Math.abs(g.y0 + (g.y1 - g.y0) * n.t - height)
        : 0;
      const candidate = n.d + Math.min(8, along * 0.003) + vertical;
      if (candidate < score) {
        score = candidate;
        progress = s;
      }
    }
    out.distance = progress;
    out.routeGap = route.d;
    out.curvature = this.getCurvatureAtDistance(route.s);
    return out;
  }
  height(s) {
    return this.sampleAtDistance(s).y - 0.09;
  }
  heightAt(x, z) {
    const n = this.findNearestRoadPoint(x, z, {});
    return n.y - 0.09;
  }
  hasRail() {
    return false;
  }
  constrainRoad(v, dt) {
    const p = v.near;
    if (!p.bridge || Math.abs(v.y - p.y) > 1.8) return;
    const rail = p.width / 2 + 0.4,
      limit = rail - 1.12,
      off = Math.abs(p.offset);
    if (off <= limit || off > rail + 1.5) return;
    const side = Math.sign(p.offset);
    v.x = p.x + p.nx * side * limit;
    v.z = p.z + p.nz * side * limit;
    p.offset = side * limit;
    v.speed *= Math.exp(-4 * dt);
    let heading = p.heading;
    if (Math.cos(v.heading - heading) < 0) heading += Math.PI;
    const delta = Math.atan2(
      Math.sin(heading - v.heading),
      Math.cos(heading - v.heading),
    );
    v.heading += delta * (1 - Math.exp(-2 * dt));
  }
  resetNearest(v) {
    const n = this.findNearestRoadPoint(v.x, v.z, {}, v.y),
      r = this.roads[n.roadId];
    if (r.oneway === -1) {
      n.heading += Math.PI;
      n.nx *= -1;
      n.nz *= -1;
    }
    const lane = r.oneway ? 0 : -Math.min(1.7, r.width / 4);
    v.x = n.x + n.nx * lane;
    v.z = n.z + n.nz * lane;
    v.y = n.y;
    v.heading = n.heading;
    v.pitch = n.pitch;
    v.speed = v.steer = v.throttle = v.override = 0;
    this.findNearestRoadPoint(v.x, v.z, v.near, v.y);
  }
}
