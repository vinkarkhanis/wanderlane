import { nearest, inside } from "./spatial.js";

// Existing imported surface roads only. The two branches share their endpoints.
export const PUNE_FORK = Object.freeze({
  from: 202,
  to: 212,
  roads: [
    2257, 2258, 2259, 2260, 5362, 5363, 5364, 5365, 4780, 4781, 4782, 3720,
    3721, 3722, 3723, 3411, 3412, 3413,
  ],
});
export const JOURNEY_PLACES = Object.freeze({
  "pashan-chai": {
    id: "pashan-chai",
    label: "A pause for chai · Pashan approach",
    s: 4905,
    x: 290.231909688543,
    z: 1270.6159716820532,
    yaw: 0.43845042265279727,
    side: -1,
    roadId: 726,
    tile: "1,4",
    width: 4,
    length: 10,
  },
  "baner-pause": {
    id: "baner-pause",
    label: "An evening pause · Baner",
    s: 1519.249999999991,
    x: 281.8583294576483,
    z: -612.0716991098093,
    yaw: 0.8326634604561297,
    side: -1,
    roadId: 1686,
    tile: "1,-3",
    width: 4,
    length: 10,
  },
});

export function journeyNavigation(nav, choice = "main") {
  let s = 0;
  const base = nav.route.edges.map((e) => {
    const edge = {
      ...e,
      canonicalS: s,
      canonicalLength: nav.roads[e.road].length,
    };
    s += edge.canonicalLength;
    return edge;
  });
  const start = base[PUNE_FORK.from].canonicalS;
  const end = base[PUNE_FORK.to].canonicalS;
  let edges = base;
  if (choice === "detour") {
    const total = PUNE_FORK.roads.reduce(
      (sum, id) => sum + nav.roads[id].length,
      0,
    );
    let d = 0;
    const branch = PUNE_FORK.roads.map((road) => {
      const length = nav.roads[road].length;
      const e = {
        road,
        dir: 1,
        canonicalS: start + (d / total) * (end - start),
        canonicalLength: (length / total) * (end - start),
      };
      d += length;
      return e;
    });
    edges = [
      ...base.slice(0, PUNE_FORK.from),
      ...branch,
      ...base.slice(PUNE_FORK.to),
    ];
  }
  return {
    ...nav,
    originalRoute: nav.route,
    route: { ...nav.route, edges },
    canonicalLength: s,
    journeyChoice: choice,
    fork: { start, end },
  };
}

export function streetCharacter(road) {
  return ["primary", "secondary", "tertiary", "trunk"].includes(
    road.tags?.highway,
  )
    ? "commercial"
    : "residential";
}

export function turnGuidance(path, s) {
  return turnInstruction(path, s).text;
}

export function turnInstruction(path, s) {
  const current = path.segment(s);
  for (let i = 1; i < 45; i++) {
    const r = path.segments[(current.index + i) % path.segments.length];
    const gap = (((r.s - s) % path.length) + path.length) % path.length;
    if (gap > 180) break;
    const before = path.sampleAtDistance(r.s - 7, {}),
      after = path.sampleAtDistance(r.s + 7, {});
    const angle = Math.atan2(
      Math.sin(after.heading - before.heading),
      Math.cos(after.heading - before.heading),
    );
    if (Math.abs(angle) > 0.45 && gap > 3)
      return {
        direction: angle > 0 ? "left" : "right",
        text: `${angle > 0 ? "Turn left" : "Turn right"} in ${Math.round(gap / 5) * 5} m · ${r.tags.name || "local road"}`,
      };
  }
  return {
    direction: "straight",
    text: `Continue on ${current.tags.name || "the local road"}`,
  };
}

export function bayContains(bay, x, z, margin = 0) {
  const dx = x - bay.x,
    dz = z - bay.z;
  const across = dx * Math.cos(bay.yaw) - dz * Math.sin(bay.yaw);
  const along = dx * Math.sin(bay.yaw) + dz * Math.cos(bay.yaw);
  // Leave room for the full car and the little tea shelter at the rear of the pad.
  return (
    Math.abs(across) <= bay.width / 2 - 0.8 + margin &&
    Math.abs(along) <= bay.length / 2 - 3.6 + margin
  );
}

export function parkingApproaches(path) {
  if (path.parkingApproaches) return path.parkingApproaches;
  const points = [];
  for (const a of Object.values(JOURNEY_PLACES)) {
    const endS = path.journeyDistance?.(a.s) ?? a.s;
    const end = path.getLanePosition(endS, -1.6, {});
    for (let gap = 80; gap >= 0; gap -= 2) {
      const p = path.getLanePosition(endS - gap, -1.6, {});
      const t = Math.min(1, (80 - gap) / 60),
        blend = t * t * (3 - 2 * t);
      points.push({
        x: p.x + (a.x - end.x) * blend,
        z: p.z + (a.z - end.z) * blend,
      });
    }
  }
  return (path.parkingApproaches = points);
}
export function clearParkingApproach(path, x, z, radius = 3) {
  return !parkingApproaches(path).some(
    (p) => Math.hypot(x - p.x, z - p.z) < radius,
  );
}

// Used by QA and rendering; road/building/water geometry stays authoritative.
export function safeJourneyPlace(bay, data, path) {
  const radius = Math.hypot(2.2, 5.2);
  if (
    data.id !== bay.tile ||
    bay.x - radius < data.x ||
    bay.x + radius > data.x + data.size ||
    bay.z - radius < data.z ||
    bay.z + radius > data.z + data.size
  )
    return false;
  if (
    data.buildings.some(
      (b) =>
        bay.x > b.bounds[0] - radius &&
        bay.x < b.bounds[2] + radius &&
        bay.z > b.bounds[1] - radius &&
        bay.z < b.bounds[3] + radius,
    )
  )
    return false;
  if (
    data.land.some(
      (l) =>
        l.kind === "water" &&
        (inside([bay.x, bay.z], l.outer) ||
          l.outer.some(
            (p, i) =>
              nearest([bay.x, bay.z], p, l.outer[(i + 1) % l.outer.length]).d <
              radius,
          )),
    )
  )
    return false;
  return ![...path.grid.query(bay.x, bay.z, 20)].some(
    (r) =>
      r.id !== bay.roadId &&
      nearest([bay.x, bay.z], r.p, r.q).d < r.width / 2 + radius + 0.3,
  );
}

export function renderJourneyPlaces(data, path, height, block, res) {
  const places = Object.values(JOURNEY_PLACES).filter((p) =>
    safeJourneyPlace(p, data, path),
  );
  for (const p of places) {
    const co = Math.cos(p.yaw),
      si = Math.sin(p.yaw);
    const b = (x, y, z, w, h, d, mat) => {
      const wx = p.x + x * co + z * si,
        wz = p.z - x * si + z * co;
      block(wx, height(wx, wz) + y, wz, w, h, d, p.yaw, mat);
    };
    // Short slabs follow the same terrain used by tyre contacts. No raised kerb
    // crosses the entrance; the centre remains clear for a full-size car.
    for (let z = -4.5; z <= 4.5; z += 1)
      b(0, 0.025, z, 4, 0.05, 1.02, res.forecourt);
    for (let z = -3; z <= 3; z += 1)
      b(p.side * 2.6, 0.02, z, 1.3, 0.04, 1.02, res.forecourt);
    for (const x of [-1.85, 1.85])
      for (let z = -4; z <= 4; z += 2)
        b(x, 0.06, z, 0.07, 0.025, 1.2, res.mark);
    b(0, 0.06, 4.65, 3.8, 0.025, 0.08, res.mark);
    // Small P made from geometry keeps the destination readable on every device.
    b(1.7, 1.1, 4.6, 0.08, 2.2, 0.08, res.trim);
    b(1.7, 2.1, 4.6, 0.72, 0.72, 0.1, res.teal);
    b(1.55, 2.1, 4.53, 0.07, 0.48, 0.04, res.mark);
    b(1.69, 2.31, 4.53, 0.28, 0.06, 0.04, res.mark);
    b(1.69, 2.1, 4.53, 0.28, 0.06, 0.04, res.mark);
    b(1.82, 2.2, 4.53, 0.06, 0.24, 0.04, res.mark);
    // Original small chai shelter at the back of the validated parcel. The
    // parking centre and its approach stay open; no surveyed business is claimed.
    for (const x of [-1.65, 1.65]) b(x, 1.3, 4.4, 0.1, 2.6, 0.1, res.timber);
    b(0, 2.65, 3.95, 3.8, 0.16, 1.85, res.teal);
    b(0, 2.38, 3.05, 3.65, 0.35, 0.08, res.terracotta);
    b(0, 0.6, 4.35, 2.6, 1.2, 0.8, res.timber);
    b(0, 1.25, 4.25, 2.85, 0.1, 1, res.cream);
    b(-0.8, 1.54, 4.25, 0.34, 0.5, 0.34, res.steel);
    b(-0.8, 1.81, 4.25, 0.39, 0.05, 0.39, res.steel);
    b(-0.8, 1.89, 4.25, 0.08, 0.12, 0.08, res.timber);
    b(-0.56, 1.66, 4.25, 0.22, 0.08, 0.09, res.steel);
    for (const x of [-0.2, 0.15, 0.5])
      b(x, 1.4, 3.95, 0.13, 0.2, 0.13, res.cream);
    b(0, 2.37, 4.1, 1.5, 0.07, 0.12, res.glow);
  }
  return places;
}
