import { CITY_DETAILS } from "../config.js";
import { Grid, nearest, inside } from "./spatial.js";

export function roadName(value) {
  if (
    typeof value !== "string" ||
    /[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/u.test(value)
  )
    return "";
  const name = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  return name.length > 0 &&
    name.length <= 64 &&
    /\p{L}/u.test(name) &&
    !/^(unnamed|unknown|null|undefined)$/i.test(name)
    ? name
    : "";
}

// Built once from the complete road network: tile load order never affects placement.
export function detailCandidates(path) {
  const placed = new Grid(24),
    names = new Map(),
    result = [];
  for (const r of [...path.roads].sort((a, b) => a.id - b.id)) {
    if (r.elevated || r.width < 4 || r.length < 22) continue;
    const dx = (r.q[0] - r.p[0]) / r.length,
      dz = (r.q[1] - r.p[1]) / r.length;
    const name = roadName(r.tags?.name);
    for (let d = 12, i = 0; d < r.length - 9; d += CITY_DETAILS.spacing, i++) {
      const side = (r.id + i) % 2 ? -1 : 1;
      const kind =
        i === 0 && name ? "sign" : ["lamp", "tree", "box"][(r.id + i) % 3];
      const radius = kind === "tree" ? 3 : 1.8;
      const off = r.width / 2 + CITY_DETAILS.clearance + radius;
      const x = r.p[0] + dx * d - dz * off * side,
        z = r.p[1] + dz * d + dx * off * side;
      // Keep the entire object in its owning tile; this also protects tile seams.
      const localX = ((x % 256) + 256) % 256,
        localZ = ((z % 256) + 256) % 256;
      if (Math.min(localX, localZ, 256 - localX, 256 - localZ) < radius + 1)
        continue;
      if (
        [...path.grid.query(x, z, 20)].some(
          (road) =>
            nearest([x, z], road.p, road.q).d < road.width / 2 + radius + 1.2,
        )
      )
        continue;
      if (
        [...placed.query(x, z, 9)].some(
          (p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 2,
        )
      )
        continue;
      const key = name.toLocaleLowerCase("en");
      if (
        kind === "sign" &&
        (names.get(key) || []).some(
          (p) => Math.hypot(p.x - x, p.z - z) < CITY_DETAILS.signSpacing,
        )
      )
        continue;
      const p = {
        x,
        z,
        kind,
        radius,
        name: kind === "sign" ? name : "",
        yaw: Math.atan2(dx, dz),
        roadId: r.id,
      };
      placed.insert(p, [x, z, x, z]);
      if (kind === "sign") {
        if (!names.has(key)) names.set(key, []);
        names.get(key).push(p);
      }
      result.push(p);
    }
  }
  return result;
}

export function tileDetails(data, candidates, quality) {
  return candidates
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
          (l) => l.kind === "water" && inside([p.x, p.z], l.outer),
        ),
    )
    .sort(
      (a, b) =>
        Number(b.kind === "sign") - Number(a.kind === "sign") ||
        a.roadId - b.roadId,
    )
    .slice(0, CITY_DETAILS.budgets[quality]);
}
