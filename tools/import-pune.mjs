import { applyRoadElevation } from "./lib/road-elevation.mjs";
import { inside } from "./lib/geometry.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { PUNE } from "./lib/pune-config.mjs";
import { parseOSM } from "./lib/osm-parser.mjs";
import { roadsFromOSM } from "./lib/road-processor.mjs";
import { buildingsFromOSM, landuseFromOSM } from "./lib/building-processor.mjs";
import { elevationSource } from "./lib/elevation-processor.mjs";
import { makeRoute } from "./lib/route-processor.mjs";
import { writeChunks, json } from "./lib/chunk-writer.mjs";
import { walkwaysFromOSM } from "./lib/walkway-processor.mjs";
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const expanded = process.argv.includes("--expand");
const config = expanded
  ? {
      ...PUNE,
      bounds: JSON.parse(
        await readFile("data-sources/pune/expansion-metadata.json", "utf8"),
      ).bounds,
    }
  : PUNE;
const source =
    arg("--source") ||
    (expanded
      ? "data-sources/pune/osm-expansion.json.gz"
      : "data-sources/pune/osm-source.json.gz"),
  root = arg("--output") || "assets/cities/pune";
const sourceBytes = await readFile(source),
  bytes = source.endsWith(".gz") ? gunzipSync(sourceBytes) : sourceBytes,
  raw = JSON.parse(bytes),
  hash = createHash("sha256").update(bytes).digest("hex");
const metadata = JSON.parse(
  await readFile(
    expanded
      ? "data-sources/pune/expansion-metadata.json"
      : "data-sources/pune/source-metadata.json",
    "utf8",
  ),
);
if (metadata.sha256 !== hash)
  throw Error(
    "Source checksum mismatch; record verified source metadata before importing a new snapshot",
  );
const report = {
  bounds: config.bounds,
  sourceSha256: hash,
  roadLengthByClass: {},
  malformed: [],
  excludedRoadWays: 0,
  warnings: [],
  fallbacks: [],
};
const osm = parseOSM(raw, config, report),
  graph = roadsFromOSM(osm, config, report),
  elevation = await elevationSource(arg("--dem"), config.origin),
  land = landuseFromOSM(osm, report);
osm.walkways = walkwaysFromOSM(osm);
report.walkwaySegments = osm.walkways.length;
if (expanded && elevation.metadata.kind === "procedural-fallback") {
  const original = elevation.height;
  elevation.height = (x, z) => {
    const f = Math.min(
        1,
        Math.max(Math.abs(x) - 2005, Math.abs(z) - 2005, 0) / 750,
      ),
      w = f * f * (3 - 2 * f);
    return (
      original(x, z) +
      w *
        (92 * Math.exp(-((x + 3300) ** 2 + (z + 900) ** 2) / 1600000) +
          74 * Math.exp(-((x + 3000) ** 2 + (z - 2100) ** 2) / 1900000) +
          105 * Math.exp(-((x + 3100) ** 2 + (z - 3700) ** 2) / 2000000))
    );
  };
  elevation.metadata.source +=
    "; outskirts hill silhouettes blended outside the preserved pilot";
}
const buildings = buildingsFromOSM(osm, graph, land, elevation, config, report);
applyRoadElevation(graph, elevation, report);
let pilot;
if (expanded) {
  pilot = JSON.parse(
    gunzipSync(await readFile("data-sources/pune/pilot-navigation.json.gz")),
  );
  const key = (r) => `${r.way}/${r.a}/${r.b}`;
  const old = new Set(pilot.roads.map(key));
  const roads = [
    ...pilot.roads.map((r) => ({ ...r })),
    ...graph.roads.filter((r) => !old.has(key(r))),
  ];
  const ids = new Map(roads.map((r, i) => [key(r), i]));
  for (const edges of Object.values(graph.adj))
    for (const e of edges) e.road = ids.get(key(graph.roads[e.road]));
  graph.roads = roads.map((r, id) => ({ ...r, id }));
  report.preservedPilotRoads = pilot.roads.length;
}
const originalHeight = elevation.height;
for (const l of land)
  if (l.kind === "water")
    l.waterY = Math.min(...l.outer.map((p) => originalHeight(...p)));
const water = land.filter((l) => l.kind === "water");
elevation.height = (x, z) => {
  for (const l of water)
    if (
      x >= l.bounds[0] &&
      x <= l.bounds[2] &&
      z >= l.bounds[1] &&
      z <= l.bounds[3] &&
      inside([x, z], l.outer) &&
      !l.holes.some((h) => inside([x, z], h))
    )
      return l.waterY - 0.7;
  return originalHeight(x, z);
};
const route = pilot?.route || makeRoute(graph, osm, config, report);
const explorationRoutes = expanded
  ? [
      {
        id: "sus-hills",
        name: "Sus–Pashan Hill Roads",
        targets: [
          [18.561, 73.783],
          [18.565, 73.758],
          [18.541, 73.766],
          [18.544, 73.79],
        ],
      },
      {
        id: "bavdhan",
        name: "Bavdhan Outskirts",
        targets: [
          [18.54, 73.794],
          [18.517, 73.774],
          [18.526, 73.755],
          [18.545, 73.766],
        ],
      },
      {
        id: "aundh-retail",
        name: "Aundh & Baner City Loop",
        targets: [
          [18.56, 73.799],
          [18.563, 73.808],
          [18.58, 73.792],
          [18.564, 73.782],
        ],
      },
    ].map(({ id, name, targets }) => ({
      ...makeRoute(graph, osm, { ...config, routeTargets: targets }, report),
      id,
      name,
    }))
  : [];
report.explorationRoutes = explorationRoutes.map((r) => ({
  id: r.id,
  name: r.name,
  length: r.length,
}));
report.unsupportedGeometry = {
  railwayWays: [...osm.ways.values()].filter((w) => w.tags?.railway).length,
  barrierWays: [...osm.ways.values()].filter((w) => w.tags?.barrier).length,
  waterwayLines: [...osm.ways.values()].filter((w) => w.tags?.waterway).length,
  nonDriveablePaths: [...osm.ways.values()].filter((w) =>
    ["footway", "cycleway", "steps", "pedestrian", "path"].includes(
      w.tags?.highway,
    ),
  ).length,
  note: "Footways, cycleways, paths and steps are imported as decorative pedestrian surfaces; railway and barrier lines remain unrendered.",
};
report.trafficSignals = osm.points.filter(
  (p) => p.tags.highway === "traffic_signals",
).length;
report.warnings.push(
  "Finite pilot boundary: roads are truncated to in-bounds nodes.",
  "Bridge decks use simplified elevations and approach ramps; complex vertical topology requires manual review.",
  "Via-way turn restrictions and conditional access are not yet interpreted. Traffic signals are imported but not yet simulated.",
  "Water and vegetation use generic original art.",
);
report.fallbacks.push(
  "Road widths from lanes/classification when width missing.",
  "Unspecified building heights inferred deterministically from type and footprint area.",
);
if (elevation.metadata.kind === "procedural-fallback")
  report.fallbacks.push(elevation.metadata.label);
report.route = {
  name: route.name,
  length: route.length,
  edges: route.edges.length,
};
await mkdir(root, { recursive: true });
const chunks = await writeChunks(
  root,
  osm,
  graph,
  buildings,
  land,
  elevation,
  config,
);
const nav = {
  roads: graph.roads.map((r) => ({
    ...r,
    y0: r.y0,
    y1: r.y1,
  })),
  route,
  explorationRoutes,
  places: osm.points.filter((p) => p.tags.place),
  signals: osm.points.filter((p) => p.tags.highway === "traffic_signals"),
  bounds: osm.bounds,
};
const navData = json(nav),
  navHash = createHash("sha256").update(navData).digest("hex").slice(0, 12),
  navFile = "navigation." + navHash + ".json";
await writeFile(root + "/" + navFile, navData);
await writeFile(root + "/" + navFile + ".gz", gzipSync(navData));
const attribution = {
  text: "Map data © OpenStreetMap contributors, available under ODbL 1.0.",
  url: "https://www.openstreetmap.org/copyright",
  licence: "https://opendatacommons.org/licenses/odbl/1-0/",
  modifiedDatabase: true,
  modifications:
    "WGS84 projection, filtered roads and walkways, graph routes, land-use polygons, inferred heights, chunk partitioning; original pilot roads and route preserved in wider expansion",
  source: metadata,
  elevation: elevation.metadata,
};
await writeFile(root + "/attribution.json", json(attribution));
await writeFile(root + "/source.osm.json.gz", sourceBytes);
await writeFile(root + "/routes.json", json([route, ...explorationRoutes]));
await writeFile(
  root + "/import-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
await writeFile(
  root + "/manifest.json",
  json({
    version: 1,
    name: expanded
      ? "Pune & western outskirts"
      : "Pune — Baner–Aundh–Pashan pilot",
    bounds: config.bounds,
    localBounds: osm.bounds,
    origin: PUNE.origin,
    projection: {
      name: "Local equirectangular",
      radius: 6371008.8,
      units: "metres",
      x: "east",
      z: "south",
      y: "elevation relative to documented datum",
    },
    elevation: elevation.metadata,
    chunkSize: PUNE.chunkSize,
    chunks,
    navigation: navFile,
    attribution: "attribution.json",
    sourceSha256: hash,
  }),
);
console.log(JSON.stringify({ ...report, chunks: chunks.length }, null, 2));
