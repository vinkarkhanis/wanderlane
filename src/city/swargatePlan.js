import { project } from "./projection.js";
import { nearest } from "./spatial.js";

export const SWARGATE = {
  id: "swargate-msrtc",
  name: "Swargate Bus Station",
  lat: 18.5,
  lon: 73.85912,
  yaw: -Math.PI / 2,
  sourceWays: [817474247, 817474249],
  approach: [18.5006, 73.85845],
};
export function stationBuilding(b) {
  return SWARGATE.sourceWays.some((id) => b.id === `w${id}:0`);
}
export function stationFrame(origin) {
  const [x, z] = project(SWARGATE.lat, SWARGATE.lon, origin);
  return { x, z, yaw: SWARGATE.yaw };
}
export function stationLevel(path, height) {
  // Retain the mapped entrance height independently of the yard's synthetic
  // ground level. The original source driveway supplies the connecting ramp.
  const entrance = path.roads.find(
    (r) => r.way === 669033674 && r.a === 8049563601,
  );
  const frame = stationFrame(path.manifest.origin);
  return Math.max(height(frame.x, frame.z), entrance?.y0 ?? -Infinity);
}
export function stationPad(origin) {
  const f = stationFrame(origin);
  return [f.x - 66, f.z - 48, f.x + 57, f.z + 64];
}
export function stationPadCell(path, x, z) {
  const p = stationPad(path.manifest.origin),
    step = 3;
  if (x <= p[0] || x >= p[2] || z <= p[1] || z >= p[3]) return null;
  const left = p[0] + Math.floor((x - p[0]) / step) * step,
    top = p[1] + Math.floor((z - p[1]) / step) * step;
  const w = Math.min(step, p[2] - left),
    d = Math.min(step, p[3] - top);
  for (const [xx, zz] of [
    [left, top],
    [left + w, top],
    [left, top + d],
    [left + w, top + d],
    [left + w / 2, top + d / 2],
  ])
    if (
      [...path.grid.query(xx, zz, 12)].some(
        (r) =>
          r.type !== "service" &&
          nearest([xx, zz], r.p, r.q).d < r.width / 2 + 1.4,
      )
    )
      return null;
  return { x: left + w / 2, z: top + d / 2, width: w, depth: d };
}
export function stationSceneBuilding(b, origin) {
  if (stationBuilding(b)) return true;
  const p = stationPad(origin),
    x = (b.bounds[0] + b.bounds[2]) / 2,
    z = (b.bounds[1] + b.bounds[3]) / 2;
  return x > p[0] && x < p[2] && z > p[1] && z < p[3];
}
export function stationPoint(frame, x, z) {
  const co = Math.cos(frame.yaw),
    si = Math.sin(frame.yaw);
  return { x: frame.x + x * co + z * si, z: frame.z - x * si + z * co };
}
export function inStationGrounds(x, z, origin, margin = 0) {
  const f = stationFrame(origin);
  // A bounded scene within the mapped terminal area, east of the public road.
  return (
    x > f.x - 54 - margin &&
    x < f.x + 88 + margin &&
    z > f.z - 56 - margin &&
    z < f.z + 75 + margin
  );
}
export function stationBusPlan(path) {
  const frame = stationFrame(path.manifest.origin),
    buses = [];
  for (const [i, x, z] of [
    [0, -27, 15],
    [1, -15, 16],
    [2, -3, 15],
    [3, 9, 18],
    [4, 21, 18],
    [5, 34, 16],
    [6, 48, -39],
  ]) {
    const p = stationPoint(frame, x, z),
      yaw = frame.yaw + (i === 6 ? Math.PI : 0);
    const co = Math.cos(yaw),
      si = Math.sin(yaw);
    const clear = [-1.45, 0, 1.45].every((across) =>
      [-5.5, 0, 5.5].every((along) => {
        const q = [
          p.x + across * co + along * si,
          p.z - across * si + along * co,
        ];
        return ![...path.grid.query(...q, 14)].some(
          (r) => nearest(q, r.p, r.q).d < r.width / 2 + 0.7,
        );
      }),
    );
    if (clear) buses.push({ ...p, yaw, i });
  }
  return buses;
}
