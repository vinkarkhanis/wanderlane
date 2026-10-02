import { Grid, nearest, inside } from "./spatial.js";
import { HERO_ROUTE, heroProgress } from "./puneStyle.js";
import { STREET_SCENES } from "./puneStreetDetails.js";
import { clearParkingApproach } from "./puneJourney.js";
export const EDGE_BUDGET = { Low: 12, Medium: 28, High: 40 };
export function junctionNodes(path) {
  const links = new Map();
  for (const r of path.roads)
    for (const [a, b] of [
      [r.a, r.b],
      [r.b, r.a],
    ]) {
      if (!links.has(a)) links.set(a, new Set());
      links.get(a).add(b);
    }
  return new Set([...links].filter(([, n]) => n.size > 2).map(([id]) => id));
}
export function edgeCandidates(path, details = []) {
  const grid = new Grid(24),
    result = [],
    nodes = junctionNodes(path);
  for (const p of details) grid.insert(p, [p.x, p.z, p.x, p.z]);
  for (const p of STREET_SCENES)
    grid.insert({ ...p, radius: 8 }, [p.x, p.z, p.x, p.z]);
  const hero = new Set(
    path.segments
      .filter(
        (r) =>
          heroProgress(
            path.canonicalDistance?.(r.s + r.length / 2) ?? r.s + r.length / 2,
            path.canonicalLength ?? path.length,
          ) < HERO_ROUTE.length,
      )
      .map((r) => r.id),
  );
  for (const r of path.roads) {
    if (!hero.has(r.id) || r.elevated || r.length < 22) continue;
    const dx = (r.q[0] - r.p[0]) / r.length,
      dz = (r.q[1] - r.p[1]) / r.length;
    const busy = ["primary", "secondary", "tertiary"].includes(r.tags.highway);
    for (let d = 12, i = 0; d < r.length - 10; d += busy ? 16 : 24, i++)
      for (const side of [-1, 1]) {
        if ((nodes.has(r.a) && d < 25) || (nodes.has(r.b) && r.length - d < 25))
          continue;
        const kinds = busy
          ? [
              "footpath",
              "scooter",
              "rickshaw",
              "drain",
              "scooter",
              "cart",
              "rickshaw",
              "utility",
            ]
          : ["wall", "footpath", "scooter", "drain", "gate", "scooter", "car"];
        const kind = kinds[(r.id + i + (side + 1)) % kinds.length],
          radius = kind === "car" ? 3 : 2.3;
        const off = r.width / 2 + radius + 1.3;
        const x = r.p[0] + dx * d - dz * off * side,
          z = r.p[1] + dz * d + dx * off * side;
        if (!clearParkingApproach(path, x, z, radius + 2)) continue;
        const lx = ((x % 256) + 256) % 256,
          lz = ((z % 256) + 256) % 256;
        if (Math.min(lx, lz, 256 - lx, 256 - lz) < radius + 1) continue;
        if (
          [...path.grid.query(x, z, 24)].some(
            (o) => nearest([x, z], o.p, o.q).d < o.width / 2 + radius + 1,
          )
        )
          continue;
        if (
          [...grid.query(x, z, 16)].some(
            (p) => Math.hypot(x - p.x, z - p.z) < radius + p.radius + 1,
          )
        )
          continue;
        const p = {
          id: `edge:${r.id}:${i}:${side}`,
          roadId: r.id,
          x,
          z,
          yaw: Math.atan2(dx, dz),
          radius,
          kind,
        };
        result.push(p);
        grid.insert(p, [x, z, x, z]);
      }
  }
  return result;
}
export function tileEdges(data, plan, quality) {
  return plan
    .filter(
      (p) =>
        p.x >= data.x &&
        p.x < data.x + data.size &&
        p.z >= data.z &&
        p.z < data.z + data.size &&
        !data.buildings.some(
          (b) =>
            p.x >= b.bounds[0] - p.radius &&
            p.x <= b.bounds[2] + p.radius &&
            p.z >= b.bounds[1] - p.radius &&
            p.z <= b.bounds[3] + p.radius,
        ) &&
        !data.land.some(
          (l) =>
            l.kind === "water" &&
            (inside([p.x, p.z], l.outer) ||
              l.outer.some(
                (a, i) =>
                  nearest([p.x, p.z], a, l.outer[(i + 1) % l.outer.length]).d <
                  p.radius,
              )),
        ),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, EDGE_BUDGET[quality]);
}
