import { nearest } from "./spatial.js";
const lane = (r) => (r.oneway ? 0 : -Math.min(1.7, r.width / 4));
function endpoint(r, metres) {
  const dx = r.q[0] - r.p[0],
    dz = r.q[1] - r.p[1],
    length = Math.hypot(dx, dz),
    tx = dx / length,
    tz = dz / length,
    l = lane(r);
  return {
    x: r.p[0] + tx * metres - tz * l,
    z: r.p[1] + tz * metres + tx * l,
    y: r.y0 + ((r.y1 - r.y0) * metres) / length + 0.09,
    tx,
    tz,
  };
}
export function sampleConnector(c, t, out) {
  const u = 1 - t,
    a = c.a,
    b = c.b,
    dx =
      3 * u * u * (c.x1 - a.x) +
      6 * u * t * (c.x2 - c.x1) +
      3 * t * t * (b.x - c.x2),
    dz =
      3 * u * u * (c.z1 - a.z) +
      6 * u * t * (c.z2 - c.z1) +
      3 * t * t * (b.z - c.z2),
    length = Math.hypot(dx, dz) || 1;
  out.x =
    u * u * u * a.x +
    3 * u * u * t * c.x1 +
    3 * u * t * t * c.x2 +
    t * t * t * b.x;
  out.z =
    u * u * u * a.z +
    3 * u * u * t * c.z1 +
    3 * u * t * t * c.z2 +
    t * t * t * b.z;
  out.y = a.y + (b.y - a.y) * t;
  out.tx = dx / length;
  out.tz = dz / length;
  out.nx = -out.tz;
  out.nz = out.tx;
  out.heading = Math.atan2(dx, dz);
  out.pitch = Math.atan2(b.y - a.y, length);
  return out;
}
export function buildConnectors(segments) {
  return segments.map((next, i) => {
    const prev = segments[(i + segments.length - 1) % segments.length],
      a = Math.atan2(prev.q[0] - prev.p[0], prev.q[1] - prev.p[1]),
      b = Math.atan2(next.q[0] - next.p[0], next.q[1] - next.p[1]),
      turn = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
    if (turn < 0.015 && Math.abs(lane(prev) - lane(next)) < 0.02) return null;
    let reach = Math.min(10, prev.length * 0.44, next.length * 0.44);
    if (reach < 0.2) return null;
    const point = {};
    let c;
    // Keep the car-sized swept centre inside the union of the two road corridors.
    // Reduce the corner cut rather than moving any source road or building.
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = endpoint(prev, prev.length - reach),
        b = endpoint(next, reach);
      c = {
        before: reach,
        after: reach,
        a,
        b,
        x1: a.x + a.tx * reach * 0.85,
        z1: a.z + a.tz * reach * 0.85,
        x2: b.x - b.tx * reach * 0.85,
        z2: b.z - b.tz * reach * 0.85,
      };
      let valid = true;
      for (let j = 1; j < 12; j++) {
        sampleConnector(c, j / 12, point);
        const p = [point.x, point.z],
          d0 = nearest(p, prev.p, prev.q).d,
          d1 = nearest(p, next.p, next.q).d;
        if (d0 > prev.width / 2 - 0.95 && d1 > next.width / 2 - 0.95) {
          valid = false;
          break;
        }
      }
      if (valid) return c;
      reach *= 0.78;
    }
    return null;
  });
}
