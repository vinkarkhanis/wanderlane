import { inside, nearest } from "./spatial.js";

// Pavement inferred only beside urban buildings or explicitly tagged sidewalks.
// Source highway centre lines remain unchanged; these surfaces are decorative.
export function pavementPanels(data, path, junctions, quality = "Medium") {
  const panels = [],
    limit = quality === "Low" ? 90 : quality === "High" ? 260 : 180;
  for (const id of data.roads) {
    const r = path.roads[id],
      t = r.tags || {};
    if (
      r.elevated ||
      ["trunk", "motorway", "service"].includes(r.type) ||
      t.sidewalk === "no"
    )
      continue;
    const dx = r.q[0] - r.p[0],
      dz = r.q[1] - r.p[1],
      len = Math.hypot(dx, dz),
      nx = -dz / len,
      nz = dx / len;
    for (let d = 2; d < len - 1; d += 4) {
      const f = d / len,
        x = r.p[0] + dx * f,
        z = r.p[1] + dz * f;
      if ((junctions.has(r.a) && d < 8) || (junctions.has(r.b) && len - d < 8))
        continue;
      for (const side of [-1, 1]) {
        if (
          (t.sidewalk === "left" && side !== 1) ||
          (t.sidewalk === "right" && side !== -1)
        )
          continue;
        const off = r.width / 2 + 1.25,
          xx = x + nx * off * side,
          zz = z + nz * off * side;
        const urban = data.buildings.some(
          (b) =>
            xx >= b.bounds[0] - 22 &&
            xx <= b.bounds[2] + 22 &&
            zz >= b.bounds[1] - 22 &&
            zz <= b.bounds[3] + 22,
        );
        if (!urban && !["both", "yes", "left", "right"].includes(t.sidewalk))
          continue;
        if (
          data.buildings.some(
            (b) =>
              xx >= b.bounds[0] - 0.9 &&
              xx <= b.bounds[2] + 0.9 &&
              zz >= b.bounds[1] - 0.9 &&
              zz <= b.bounds[3] + 0.9,
          )
        )
          continue;
        if (
          data.land.some((l) => l.kind === "water" && inside([xx, zz], l.outer))
        )
          continue;
        if (
          [...path.grid.query(xx, zz, 9)].some(
            (o) =>
              o.id !== id && nearest([xx, zz], o.p, o.q).d < o.width / 2 + 1.5,
          )
        )
          continue;
        if (panels.length >= limit) return panels;
        panels.push({
          x: xx,
          z: zz,
          y: r.y0 + (r.y1 - r.y0) * f + 0.13,
          yaw: Math.atan2(dx, dz),
          side,
          nx,
          nz,
          width: 1.75,
          length: Math.min(3.85, len - d),
          road: id,
        });
      }
    }
  }
  return panels;
}

export function renderMappedMall(b, block, res) {
  if (b.style !== "mall") return 0;
  let bays = 0;
  for (let i = 0; i < b.outer.length && bays < 128; i++) {
    const a = b.outer[i],
      q = b.outer[(i + 1) % b.outer.length],
      dx = q[0] - a[0],
      dz = q[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 8) continue;
    const yaw = Math.atan2(dx, dz);
    // Glass and stone bands sit on the imported exterior wall, preserving its footprint.
    for (let d = 3; d < len - 2 && bays < 128; d += 5) {
      const x = a[0] + (dx * d) / len,
        z = a[1] + (dz * d) / len;
      block(
        x,
        b.y + Math.min(b.height * 0.5, 4.5),
        z,
        0.11,
        Math.min(b.height - 1.2, 6),
        3.8,
        yaw,
        res.mallGlass,
      );
      block(x, b.y + b.height * 0.82, z, 0.2, 0.55, 4.7, yaw, res.mallStone);
      block(x, b.y + 1, z, 0.18, 1.8, 0.22, yaw, res.mallStone);
      bays++;
    }
  }
  return bays;
}
