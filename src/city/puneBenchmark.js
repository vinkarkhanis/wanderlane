import { inside, nearest } from "./spatial.js";
import { STREET_SCENES } from "./puneStreetDetails.js";
import {
  JOURNEY_PLACES,
  bayContains,
  clearParkingApproach,
} from "./puneJourney.js";
export const BENCHMARK = { start: 10380, length: 200 };
// Offline route geometry remains authoritative. Every two-metre bay is checked
// against other road corridors and imported footprints before it is dressed.
export function benchmarkPlan(path, range = BENCHMARK) {
  const result = [];
  for (let s = range.start; s < range.start + range.length; s += 2) {
    // getLanePosition(0) still selects the left lane; use the road centre so
    // both verges stay outside the carriageway.
    const q = path.sampleAtDistance(s, {});
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
        index: Math.round((s - range.start) / 2),
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
// Generate from the loaded road network, independent of the selected journey.
// Global segment distances give each bay a stable owner across chunk reloads.
export function cityStreetBays(data, path, junctions, quality = "Medium") {
  const result = [],
    span = quality === "Low" ? 8 : 4;
  for (const id of [...data.roads].sort((a, b) => a - b)) {
    const r = path.roads[id];
    if (
      r.elevated ||
      r.width < 4 ||
      ![
        "primary",
        "secondary",
        "tertiary",
        "residential",
        "unclassified",
        "living_street",
        "service",
      ].includes(r.tags.highway)
    )
      continue;
    const dx = (r.q[0] - r.p[0]) / r.length,
      dz = (r.q[1] - r.p[1]) / r.length;
    const marginA = junctions.has(r.a) ? Math.max(5, r.width * 0.65) : span / 2;
    const marginB = junctions.has(r.b) ? Math.max(5, r.width * 0.65) : span / 2;
    for (let d = span / 2; d <= r.length - marginB; d += span) {
      if (d < marginA) continue;
      for (const side of [-1, 1]) {
        const off = (r.width / 2 + 1.55) * side;
        const x = r.p[0] + dx * d - dz * off,
          z = r.p[1] + dz * d + dx * off;
        if (
          Object.values(JOURNEY_PLACES).some((p) =>
            bayContains(p, x, z, span / 2 + 2),
          )
        )
          continue;
        if (!clearParkingApproach(path, x, z, span / 2 + 3)) continue;
        if (!clearStreetBay(data, path, x, z, dx, dz, span)) continue;
        result.push({
          x,
          z,
          y: r.y0 + ((r.y1 - r.y0) * d) / r.length,
          yaw: Math.atan2(dx, dz),
          side,
          roadId: id,
          index: Math.floor(d / 2),
          span,
        });
      }
    }
  }
  return result;
}
function clearStreetBay(data, path, x, z, dx, dz, span) {
  // Rectangular footprint checks allow connected short road segments without
  // a circular exclusion zone incorrectly rejecting the whole pavement.
  for (const across of [-1.38, 0, 1.38])
    for (const along of [-span / 2, 0, span / 2]) {
      const px = x - dz * across + dx * along,
        pz = z + dx * across + dz * along,
        q = [px, pz];
      if (
        px < data.x + 0.05 ||
        px > data.x + data.size - 0.05 ||
        pz < data.z + 0.05 ||
        pz > data.z + data.size - 0.05
      )
        return false;
      if (
        [...path.grid.query(px, pz, 20)].some(
          (r) => nearest(q, r.p, r.q).d < r.width / 2 + 0.08,
        )
      )
        return false;
      if (
        data.buildings.some(
          (b) =>
            px > b.bounds[0] - 0.1 &&
            px < b.bounds[2] + 0.1 &&
            pz > b.bounds[1] - 0.1 &&
            pz < b.bounds[3] + 0.1,
        )
      )
        return false;
      if (
        data.land.some(
          (l) =>
            l.kind === "water" &&
            (inside(q, l.outer) ||
              l.outer.some(
                (a, i) =>
                  nearest(q, a, l.outer[(i + 1) % l.outer.length]).d < 0.15,
              )),
        )
      )
        return false;
    }
  return true;
}
export function renderBenchmark(bays, data, path, block, res, height) {
  for (const p of bays) {
    const span = p.span || 2;
    const co = Math.cos(p.yaw),
      si = Math.sin(p.yaw);
    const b = (x, h, z, w, t, d, m) =>
      block(
        p.x - x * co + z * si,
        Math.max(height(p.x, p.z), p.y - 0.03) + h,
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
      span + 0.03,
      res.pavement,
    );
    b(
      -p.side * 1.28,
      entrance ? 0.055 : 0.14,
      0,
      0.16,
      entrance ? 0.11 : 0.28,
      span - 0.04,
      res.concrete,
    );
    b(-p.side * 1.43, 0.025, 0, 0.15, 0.04, span + 0.03, res.drain);
    if (p.index % 7 === 0) {
      b(-p.side * 1.17, 0.265, 0, 0.32, 0.025, 0.65, res.drain);
      for (let j = -2; j <= 2; j++)
        b(-p.side * 1.17, 0.28, j * 0.11, 0.3, 0.025, 0.025, res.trim);
    }
    // Setback forecourt ties the footpath to a compound; the regular gaps are
    // driveways, not solid barriers across the whole block.
    const wx = p.x - p.side * co * 3.4,
      wz = p.z + p.side * si * 3.4;
    if (
      !clearParcel(
        data,
        path,
        wx,
        wz,
        Math.max(2.4, Math.hypot(1.8, span / 2) + 0.1),
        p.roadId,
      )
    )
      continue;
    if (
      STREET_SCENES.some((scene) => Math.hypot(wx - scene.x, wz - scene.z) < 13)
    )
      continue;
    b(p.side * 2.85, 0.015, 0, 3.2, 0.03, span + 0.03, res.forecourt);
    if (!entrance) {
      b(p.side * 4.35, 0.57, 0, 0.24, 1.14, span + 0.03, res.concrete);
      b(p.side * 4.35, 1.16, 0, 0.32, 0.1, span + 0.03, res.trim);
      if (p.index % 4 === 0)
        b(p.side * 4.35, 0.75, 0, 0.4, 1.5, 0.4, res.concrete);
    } else {
      b(p.side * 4.2, 0.03, 0, 0.3, 0.06, span + 0.03, res.drain);
    }
  }
}
