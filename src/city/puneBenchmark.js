import { inside, nearest } from "./spatial.js";
export const BENCHMARK = { start: 10380, length: 200 };
// Offline route geometry remains authoritative. Every two-metre bay is checked
// against other road corridors and imported footprints before it is dressed.
export function benchmarkPlan(path) {
  const result = [];
  for (
    let s = BENCHMARK.start;
    s < BENCHMARK.start + BENCHMARK.length;
    s += 2
  ) {
    const q = path.getLanePosition(s, 0);
    if (q.elevated || path.nearJunction(s)) continue;
    for (const side of [-1, 1]) {
      const off = q.width / 2 + 1.55;
      result.push({
        x: q.x + q.nx * off * side,
        z: q.z + q.nz * off * side,
        y: q.y,
        yaw: q.heading,
        side,
        s,
        index: Math.round((s - BENCHMARK.start) / 2),
        roadId: q.roadId,
      });
    }
  }
  return result;
}
export function clearParcel(data, path, x, z, radius, roadId) {
  if (
    x - radius < data.x ||
    x + radius > data.x + data.size ||
    z - radius < data.z ||
    z + radius > data.z + data.size
  )
    return false;
  if (
    data.buildings.some(
      (b) =>
        x > b.bounds[0] - radius &&
        x < b.bounds[2] + radius &&
        z > b.bounds[1] - radius &&
        z < b.bounds[3] + radius,
    )
  )
    return false;
  if (
    data.land.some(
      (l) =>
        l.kind === "water" &&
        (inside([x, z], l.outer) ||
          l.outer.some(
            (a, i) =>
              nearest([x, z], a, l.outer[(i + 1) % l.outer.length]).d < radius,
          )),
    )
  )
    return false;
  return ![...path.grid.query(x, z, 20)].some(
    (r) =>
      r.id !== roadId &&
      nearest([x, z], r.p, r.q).d < r.width / 2 + radius + 0.3,
  );
}
export function benchmarkBays(data, path, plan) {
  return plan.filter((p) => clearParcel(data, path, p.x, p.z, 1.68, p.roadId));
}
export function renderBenchmark(bays, data, path, block, res, height) {
  for (const p of bays) {
    const co = Math.cos(p.yaw),
      si = Math.sin(p.yaw);
    const b = (x, h, z, w, t, d, m) =>
      block(
        p.x - x * co + z * si,
        height(p.x, p.z) + h,
        p.z + x * si + z * co,
        w,
        t,
        d,
        p.yaw,
        m,
      );
    const entrance = p.index % 18 < 3;
    b(
      0,
      entrance ? 0.055 : 0.12,
      0,
      2.6,
      entrance ? 0.11 : 0.24,
      2.03,
      res.pavement,
    );
    b(
      -p.side * 1.28,
      entrance ? 0.055 : 0.14,
      0,
      0.16,
      entrance ? 0.11 : 0.28,
      1.96,
      res.concrete,
    );
    b(-p.side * 1.43, 0.025, 0, 0.15, 0.04, 2.03, res.drain);
    if (p.index % 7 === 0) {
      b(-p.side * 1.17, 0.265, 0, 0.32, 0.025, 0.65, res.drain);
      for (let j = -2; j <= 2; j++)
        b(-p.side * 1.17, 0.28, j * 0.11, 0.3, 0.025, 0.025, res.trim);
    }
    // Setback forecourt ties the footpath to a compound; the regular gaps are
    // driveways, not solid barriers across the whole block.
    const wx = p.x - p.side * co * 3.4,
      wz = p.z + p.side * si * 3.4;
    if (!clearParcel(data, path, wx, wz, 2.4, p.roadId)) continue;
    if (Math.hypot(wx + 1009.231, wz + 896.271) < 13) continue;
    b(p.side * 2.85, 0.015, 0, 3.2, 0.03, 2.03, res.forecourt);
    if (!entrance) {
      b(p.side * 4.35, 0.57, 0, 0.24, 1.14, 2.03, res.concrete);
      b(p.side * 4.35, 1.16, 0, 0.32, 0.1, 2.03, res.trim);
      if (p.index % 4 === 0)
        b(p.side * 4.35, 0.75, 0, 0.4, 1.5, 0.4, res.concrete);
    } else {
      b(p.side * 4.2, 0.03, 0, 0.3, 0.06, 2.03, res.drain);
    }
  }
}
