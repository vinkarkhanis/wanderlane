import { ROAD } from "./config.js";
import { cityDistrict, reservedCityParcel } from "./city/endlessCityPlaces.js";

export const settlementChunk = (index) => ((index % 8) + 8) % 8 === 0;
export function settlementPlan(path, index, heightAt) {
  if (!path.urban && !settlementChunk(index)) return [];
  const result = [];
  for (const d of path.urban
    ? [14, 34, 54, 74, 94, 114, 134, 154]
    : [30, 62, 94, 126])
    for (const side of [-1, 1]) {
      const s = index * ROAD.chunk + d,
        q = path.sampleAtDistance(s);
      const district = path.urban ? cityDistrict(s) : null;
      if (
        path.urban &&
        (reservedCityParcel(path, s, side) ||
          (((Math.floor(s / 20) * 7 + (side === 1 ? 3 : 0)) % 10) + 10) % 10 >=
            district.density * 10)
      )
        continue;
      const setback = path.urban ? 13 : 15;
      const x = q.x + q.nx * setback * side,
        z = q.z + q.nz * setback * side;
      const tx = q.tx,
        tz = q.tz,
        nx = -q.nx * side,
        nz = -q.nz * side;
      const heights = [];
      let clear = true;
      for (const u of [-4.5, 4.5])
        for (const v of [-4, 4]) {
          const xx = x + tx * u + nx * v,
            zz = z + tz * u + nz * v;
          if (Math.abs(path.findNearestRoadPoint(xx, zz, {}).offset) < 8)
            clear = false;
          heights.push(heightAt(xx, zz));
        }
      if (
        !clear ||
        !heights.every(Number.isFinite) ||
        Math.max(...heights) - Math.min(...heights) > 1.5
      )
        continue;
      const seed =
        (Math.abs(index) * 7 + Math.floor(d / 32) + (side === 1 ? 1 : 0)) >>> 0;
      result.push({
        x,
        z,
        tx,
        tz,
        nx,
        nz,
        y: Math.max(...heights) + 0.04,
        base: Math.min(...heights),
        width: 9,
        depth: 8,
        height: path.urban
          ? district.id === "market" || district.id === "hotel"
            ? 9 + (seed % 6) * 3
            : 6 + (seed % 3) * 3
          : seed % 3 === 0
            ? 9
            : 6,
        seed,
        s,
        retail: seed % 2 === 0,
      });
    }
  return result;
}
export function settlementContains(plan, x, z, margin = 0) {
  return plan.some((p) => {
    const dx = x - p.x,
      dz = z - p.z;
    return (
      Math.abs(dx * p.tx + dz * p.tz) < p.width / 2 + margin &&
      Math.abs(dx * p.nx + dz * p.nz) < p.depth / 2 + margin
    );
  });
}
export function constrainSettlement(plan, v, dt) {
  for (const p of plan) {
    if (v.y > p.y + p.height) continue;
    const dx = v.x - p.x,
      dz = v.z - p.z,
      u = dx * p.tx + dz * p.tz,
      w = dx * p.nx + dz * p.nz;
    const a = p.width / 2 + 1.1 - Math.abs(u),
      b = p.depth / 2 + 1.1 - Math.abs(w);
    if (a <= 0 || b <= 0) continue;
    const axis =
      a < b
        ? [p.tx, p.tz, Math.sign(u) || 1, a]
        : [p.nx, p.nz, Math.sign(w) || 1, b];
    v.x += axis[0] * axis[2] * axis[3];
    v.z += axis[1] * axis[2] * axis[3];
    v.speed *= Math.exp(-8 * dt);
  }
}
