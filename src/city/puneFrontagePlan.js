import { inside, nearest } from "./spatial.js";
import { buildingStyle, HERO_ROUTE } from "./puneStyle.js";

export const NEIGHBOURHOOD = { start: HERO_ROUTE.start, length: 500 };

// These are original local-style additions to imported buildings, not surveyed
// businesses. Keep the footprints and road geometry authoritative.
export function frontagePoint(p, across, out) {
  return [p.x + p.tx * across + p.nx * out, p.z + p.tz * across + p.nz * out];
}
export function frontageClear(data, path, p, width, depth) {
  // Sample the whole strip, including the rear edge, not only its centre.
  for (
    let u = -width / 2;
    u <= width / 2 + 0.01;
    u += width / Math.ceil(width)
  ) {
    for (const v of [0.12, depth / 2, depth]) {
      const q = frontagePoint(p, u, v);
      if (
        q[0] < data.x + 0.3 ||
        q[0] > data.x + data.size - 0.3 ||
        q[1] < data.z + 0.3 ||
        q[1] > data.z + data.size - 0.3
      )
        return false;
      if (
        [...path.grid.query(...q, 32)].some(
          (r) => nearest(q, r.p, r.q).d < r.width / 2 + 1.1,
        )
      )
        return false;
      if (
        data.buildings.some(
          (b) =>
            b.id !== p.buildingId &&
            (inside(q, b.outer) ||
              b.outer.some(
                (a, i) =>
                  nearest(q, a, b.outer[(i + 1) % b.outer.length]).d < 0.35,
              )),
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
                  nearest(q, a, l.outer[(i + 1) % l.outer.length]).d < 0.35,
              )),
        )
      )
        return false;
    }
  }
  return true;
}
export function frontagePlan(data, path, routePlan) {
  const result = [];
  for (const building of data.buildings) {
    if (building.height < 4) continue;
    const cx = (building.bounds[0] + building.bounds[2]) / 2;
    const cz = (building.bounds[1] + building.bounds[3]) / 2;
    if (
      routePlan &&
      !routePlan.some((p) => Math.hypot(p.x - cx, p.z - cz) < 65)
    )
      continue;
    const style = buildingStyle(building);
    if (style.family === "construction") continue;
    let best = null;
    for (let i = 0; i < building.outer.length; i++) {
      const a = building.outer[i],
        b = building.outer[(i + 1) % building.outer.length];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 5) continue;
      const tx = (b[0] - a[0]) / length,
        tz = (b[1] - a[1]) / length;
      const x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2;
      let nx = tz,
        nz = -tx;
      if (inside([x + nx * 0.1, z + nz * 0.1], building.outer)) {
        nx = -nx;
        nz = -nz;
      }
      for (const road of path.grid.query(x, z, 50)) {
        if (road.elevated) continue;
        const near = nearest([x, z], road.p, road.q);
        const distance = near.d - road.width / 2;
        if (
          distance < 3 ||
          distance > 32 ||
          (near.x - x) * nx + (near.z - z) * nz < near.d * 0.7
        )
          continue;
        const p = {
          buildingId: building.id,
          x,
          z,
          y: building.y,
          tx,
          tz,
          nx,
          nz,
          width: Math.min(20, length - 1),
          depth: 1.3,
          height: building.height,
          family: style.family,
          seed: style.seed,
          distance,
          retail:
            style.family === "shops" ||
            (style.family !== "bungalow" && style.seed % 3 === 0),
        };
        if (
          (!best || distance < best.distance) &&
          frontageClear(data, path, p, p.width, p.depth)
        )
          best = p;
      }
    }
    if (best) {
      best.apron = frontageClear(
        data,
        path,
        best,
        best.width,
        Math.min(5, best.distance - 2),
      )
        ? Math.min(5, best.distance - 2)
        : 0;
      result.push(best);
    }
  }
  return result.sort((a, b) =>
    String(a.buildingId).localeCompare(String(b.buildingId)),
  );
}
