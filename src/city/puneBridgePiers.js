import { nearest } from "./spatial.js";

// Place supports only where their full footprint clears lower road corridors.
export function bridgePierPlan(path) {
  const groups = new Map(),
    result = [];
  for (const r of path.roads)
    if (r.tags.bridge && r.tags.bridge !== "no") {
      if (!groups.has(r.way)) groups.set(r.way, []);
      groups.get(r.way).push(r);
    }
  for (const roads of groups.values()) {
    let run = 0,
      next = 12;
    for (const r of roads) {
      const dx = (r.q[0] - r.p[0]) / r.length,
        dz = (r.q[1] - r.p[1]) / r.length;
      while (next < run + r.length) {
        const d = next - run,
          f = d / r.length;
        next += 27;
        if (d < 0) continue;
        const x = r.p[0] + dx * d,
          z = r.p[1] + dz * d,
          top = r.y0 + (r.y1 - r.y0) * f - 0.5;
        for (const offset of [0, -r.width / 2 - 1.1, r.width / 2 + 1.1]) {
          const px = x - dz * offset,
            pz = z + dx * offset;
          const blocked = [...path.grid.query(px, pz, 15)].some((o) => {
            const n = nearest([px, pz], o.p, o.q),
              y = o.y0 + (o.y1 - o.y0) * n.t;
            return o.id !== r.id && y < top - 1.4 && n.d < o.width / 2 + 1.4;
          });
          if (!blocked) {
            result.push({
              x,
              z,
              px,
              pz,
              top,
              yaw: Math.atan2(dx, dz),
              width: r.width,
              roadId: r.id,
            });
            break;
          }
        }
      }
      run += r.length;
    }
  }
  return result;
}

export function renderBridgePiers(data, plan, height, block, res) {
  let count = 0;
  for (const p of plan) {
    if (
      Math.floor(p.x / 256) !== data.x / 256 ||
      Math.floor(p.z / 256) !== data.z / 256
    )
      continue;
    if (
      data.buildings.some(
        (b) =>
          p.px > b.bounds[0] - 1.5 &&
          p.px < b.bounds[2] + 1.5 &&
          p.pz > b.bounds[1] - 1.5 &&
          p.pz < b.bounds[3] + 1.5,
      )
    )
      continue;
    const bottom = height(p.px, p.pz),
      h = p.top - bottom;
    if (h < 2) continue;
    block(p.px, bottom + h / 2, p.pz, 1.15, h, 1.3, p.yaw, res.concrete);
    block(p.x, p.top - 0.35, p.z, p.width + 2.8, 0.7, 1.6, p.yaw, res.concrete);
    block(p.px, bottom + 0.3, p.pz, 2.1, 0.6, 2.3, p.yaw, res.concrete);
    count++;
  }
  return count;
}
