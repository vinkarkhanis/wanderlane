// Fictional districts: no surveyed geography or real Pune landmark claims.
export const CITY_CYCLE = 5120;
export const CITY_DISTRICTS = [
  { start: 0, end: 640, id: "market", name: "Galleria Quarter", density: 1 },
  {
    start: 640,
    end: 1440,
    id: "lake",
    name: "Willow Lake Gardens",
    density: 0.3,
  },
  {
    start: 1440,
    end: 2240,
    id: "hills",
    name: "Greenridge Hills",
    density: 0.2,
  },
  {
    start: 2240,
    end: 3040,
    id: "temple",
    name: "Lotus Temple Quarter",
    density: 0.5,
  },
  {
    start: 3040,
    end: 3840,
    id: "hotel",
    name: "Skyline Hotel District",
    density: 0.75,
  },
  { start: 3840, end: 5120, id: "avenue", name: "Garden Avenue", density: 0.6 },
];
const mod = (s, n) => ((s % n) + n) % n;
export function cityDistrict(s) {
  const local = mod(s, CITY_CYCLE);
  return CITY_DISTRICTS.find((d) => local >= d.start && local < d.end);
}
export function cityAreaStart(id) {
  const district = CITY_DISTRICTS.find((d) => d.id === id) || CITY_DISTRICTS[0];
  if (district.id === "market") return 40;
  const place = places.find((p) => p.s >= district.start && p.s < district.end);
  return (place?.s ?? district.start + 200) - 100;
}
const places = [
  {
    s: 150,
    kind: "mall",
    name: "Aster Galleria",
    short: "Galleria",
    side: -1,
    offset: 38,
    width: 64,
    depth: 32,
    height: 17,
  },
  {
    s: 470,
    kind: "hotel",
    name: "The Boulevard Hotel",
    short: "Boulevard Hotel",
    side: 1,
    offset: 34,
    width: 34,
    depth: 26,
    height: 39,
  },
  {
    s: 960,
    kind: "lake",
    name: "Willow Lake",
    short: "Willow Lake",
    side: -1,
    offset: 78,
    width: 190,
    depth: 110,
    height: 2,
  },
  {
    s: 1800,
    kind: "hills",
    name: "Greenridge Lookout",
    short: "Greenridge",
    side: 1,
    offset: 38,
    width: 40,
    depth: 30,
    height: 7,
  },
  {
    s: 2510,
    kind: "temple",
    name: "Lotus Garden Temple",
    short: "Lotus Temple",
    side: -1,
    offset: 35,
    width: 36,
    depth: 34,
    height: 22,
  },
  {
    s: 3350,
    kind: "hotel",
    name: "Skyline Grand Hotel",
    short: "Skyline Grand",
    side: -1,
    offset: 37,
    width: 40,
    depth: 28,
    height: 48,
  },
  {
    s: 4280,
    kind: "park",
    name: "Garden Avenue Park",
    short: "Garden Park",
    side: 1,
    offset: 36,
    width: 64,
    depth: 40,
    height: 5,
  },
];
export function nearbyCityPlaces(path, distance, radius = 1200) {
  const result = [];
  for (
    let cycle = Math.floor((distance - radius) / CITY_CYCLE);
    cycle <= Math.floor((distance + radius) / CITY_CYCLE);
    cycle++
  )
    for (const template of places) {
      const s = cycle * CITY_CYCLE + template.s;
      if (Math.abs(s - distance) > radius) continue;
      const q = path.sampleAtDistance(s);
      const side = cycle % 2 ? -template.side : template.side;
      result.push({
        ...template,
        s,
        side,
        id: `${cycle}:${template.kind}:${template.s}`,
        x: q.x + q.nx * template.offset * side,
        z: q.z + q.nz * template.offset * side,
        tx: q.tx,
        tz: q.tz,
        nx: q.nx * side,
        nz: q.nz * side,
        roadY: q.y,
        yaw: Math.atan2(-q.tz * side, q.tx * side),
      });
    }
  return result;
}
export function chunkCityPlaces(path, index) {
  return nearbyCityPlaces(path, index * 160 + 80, 160).filter(
    (p) => Math.floor(p.s / 160) === index,
  );
}
export function reservedCityParcel(path, s, side) {
  return nearbyCityPlaces(path, s, 240).some(
    (p) => p.side === side && Math.abs(p.s - s) < p.width / 2 + 24,
  );
}
export function cityRoadRise(s) {
  const d = mod(s, CITY_CYCLE) - 1820;
  return 18 * Math.exp(-((d / 300) ** 2));
}
export function cityLakeZone(s, offset) {
  const cycle = Math.floor(s / CITY_CYCLE),
    side = cycle % 2 ? 1 : -1;
  return (
    ((mod(s, CITY_CYCLE) - 960) / 110) ** 2 + ((offset * side - 78) / 66) ** 2 <
    1.5
  );
}
export function cityTerrainHeight(path, s, offset, ordinary) {
  const cycle = Math.floor(s / CITY_CYCLE),
    local = mod(s, CITY_CYCLE);
  const hill = Math.exp(-(((local - 1820) / 410) ** 2));
  const ridge =
    hill *
    (1 - Math.exp(-Math.max(0, Math.abs(offset) - 14) / 65)) *
    (24 + 18 * Math.sin(s * 0.006 + offset * 0.018) ** 2);
  const side = cycle % 2 ? 1 : -1;
  const u = (local - 960) / 104,
    v = (offset * side - 78) / 59;
  const oval = u * u + v * v;
  for (const p of places.filter((p) => p.kind !== "lake")) {
    const sign = cycle % 2 ? -p.side : p.side;
    const rect = Math.max(
      Math.abs(local - p.s) / (p.width / 2 + 8),
      Math.abs(offset * sign - p.offset) / (p.depth / 2 + 8),
    );
    if (rect < 1.2 && Math.abs(offset) > 8.6) {
      const blend = Math.min(1, (1.2 - rect) / 0.2);
      const pad = path.height(cycle * CITY_CYCLE + p.s) + 0.1;
      return ordinary * (1 - blend) + pad * blend;
    }
  }
  if (
    Math.abs(local - 960) < 90 &&
    Math.abs(offset * side - 15) < 5 &&
    Math.abs(offset) > 8.6
  )
    return path.height(cycle * CITY_CYCLE + 960) + 0.1;
  if (oval < 1.35) {
    const basin = path.height(cycle * CITY_CYCLE + 960) - 2.7;
    const blend = Math.min(1, Math.max(0, (1.35 - oval) / 0.28));
    return ordinary * (1 - blend) + basin * blend;
  }
  return ordinary + ridge;
}
