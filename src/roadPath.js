import { ROAD } from "./config.js";
import { hashSeed, random } from "./random.js";
// Bounded arc-length integration table. Monotonic Z prevents self-intersections.
// Harmonics repeat after 32.768 km; streamed geometry has no terminal road end.
export class RoadPath {
  constructor(seed = "aster-2026") {
    this.seed = String(seed);
    this.hash = hashSeed(seed);
    const r = random(this.hash);
    this.phase = [r() * 6.28, r() * 6.28, r() * 6.28];
    this.period = 32768;
    this.zTable = new Float64Array(8193);
    for (let i = 1; i < this.zTable.length; i++)
      this.zTable[i] = this.zTable[i - 1] + this.dz((i - 0.5) * 4) * 4;
    this.zPeriod = this.zTable[8192];
  }
  wave(s) {
    const k = (2 * Math.PI) / this.period,
      a = k * 37 * s + this.phase[0],
      b = k * 73 * s + this.phase[1];
    return {
      x: 44 * Math.sin(a) + 15 * Math.sin(b),
      dx: 44 * k * 37 * Math.cos(a) + 15 * k * 73 * Math.cos(b),
      ddx: -44 * (k * 37) ** 2 * Math.sin(a) - 15 * (k * 73) ** 2 * Math.sin(b),
    };
  }
  dz(s) {
    const d = this.wave(s).dx;
    return Math.sqrt(1 - d * d);
  }
  zAt(s) {
    const cycle = Math.floor(s / this.period),
      local = s - cycle * this.period,
      i = Math.floor(local / 4),
      f = local / 4 - i;
    return (
      cycle * this.zPeriod + this.zTable[i] * (1 - f) + this.zTable[i + 1] * f
    );
  }
  height(s) {
    return (
      3.5 * Math.sin(s * 0.003 + this.phase[2]) + 1.2 * Math.sin(s * 0.009)
    );
  }
  sampleAtDistance(s, out = {}) {
    const w = this.wave(s),
      dz = Math.sqrt(1 - w.dx * w.dx),
      dy =
        0.0105 * Math.cos(s * 0.003 + this.phase[2]) +
        0.0108 * Math.cos(s * 0.009);
    Object.assign(out, {
      distance: s,
      x: w.x,
      z: this.zAt(s),
      y: this.height(s) + 0.06,
      tx: w.dx,
      tz: dz,
      nx: -dz,
      nz: w.dx,
      heading: Math.atan2(w.dx, dz),
      curvature: w.ddx / dz,
      pitch: Math.atan(dy),
      width: ROAD.width,
    });
    out.height = out.y;
    out.position ??= {};
    Object.assign(out.position, { x: out.x, y: out.y, z: out.z });
    out.tangent ??= {};
    Object.assign(out.tangent, { x: out.tx, y: dy, z: out.tz });
    out.normal ??= {};
    Object.assign(out.normal, { x: out.nx, y: 0, z: out.nz });
    return out;
  }
  getPositionAtDistance(s) {
    return this.sampleAtDistance(s).position;
  }
  getTangentAtDistance(s) {
    return this.sampleAtDistance(s).tangent;
  }
  getNormalAtDistance(s) {
    return this.sampleAtDistance(s).normal;
  }
  getCurvatureAtDistance(s) {
    return this.sampleAtDistance(s).curvature;
  }
  getLanePosition(s, offset = ROAD.lane, out = {}) {
    this.sampleAtDistance(s, out);
    out.x += out.nx * offset;
    out.z += out.nz * offset;
    Object.assign(out.position, { x: out.x, y: out.y, z: out.z });
    return out;
  }
  findNearestRoadPoint(x, z, out = {}) {
    const cycle = Math.floor(z / this.zPeriod),
      local = z - cycle * this.zPeriod;
    let lo = 0,
      hi = 8192;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.zTable[m] < local) lo = m;
      else hi = m;
    }
    let s =
      cycle * this.period +
      4 *
        (lo + (local - this.zTable[lo]) / (this.zTable[hi] - this.zTable[lo]));
    for (let i = 0; i < 5; i++) {
      this.sampleAtDistance(s, out);
      s += Math.max(
        -30,
        Math.min(30, (x - out.x) * out.tx + (z - out.z) * out.tz),
      );
    }
    this.sampleAtDistance(s, out);
    out.offset = (x - out.x) * out.nx + (z - out.z) * out.nz;
    return out;
  }
  hasRail(s, biome) {
    return (
      biome === "canyon" || Math.abs(this.getCurvatureAtDistance(s)) > 0.0055
    );
  }
}
