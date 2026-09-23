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
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const source = arg("--source") || "data-sources/pune/osm-source.json.gz",
  root = arg("--output") || "assets/cities/pune";
const sourceBytes = await readFile(source),
  bytes = source.endsWith(".gz") ? gunzipSync(sourceBytes) : sourceBytes,
  raw = JSON.parse(bytes),
  hash = createHash("sha256").update(bytes).digest("hex");
const metadata = JSON.parse(
  await readFile("data-sources/pune/source-metadata.json", "utf8"),
);
if (metadata.sha256 !== hash)
  throw Error(
    "Source checksum mismatch; record verified source metadata before importing a new snapshot",
  );
const report = {
  bounds: PUNE.bounds,
  sourceSha256: hash,
  roadLengthByClass: {},
  malformed: [],
  excludedRoadWays: 0,
  warnings: [],
  fallbacks: [],
};
const osm = parseOSM(raw, PUNE, report),
  graph = roadsFromOSM(osm, PUNE, report),
  elevation = await elevationSource(arg("--dem"), PUNE.origin),
  land = landuseFromOSM(osm, report),
  buildings = buildingsFromOSM(osm, graph, land, elevation, PUNE, report);
applyRoadElevation(graph, elevation, report);
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
const route = makeRoute(graph, osm, PUNE, report);
report.unsupportedGeometry = {
  railwayWays: [...osm.ways.values()].filter((w) => w.tags?.railway).length,
  barrierWays: [...osm.ways.values()].filter((w) => w.tags?.barrier).length,
  waterwayLines: [...osm.ways.values()].filter((w) => w.tags?.waterway).length,
  nonDriveablePaths: [...osm.ways.values()].filter((w) =>
    ["footway", "cycleway", "steps", "pedestrian", "path"].includes(
      w.tags?.highway,
    ),
  ).length,
  note: "These source lines are retained in the cached database but not rendered in this first pilot.",
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
  PUNE,
);
const nav = {
  roads: graph.roads.map((r) => ({
    ...r,
    y0: r.y0,
    y1: r.y1,
  })),
  route,
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
    "WGS84 projection, filtered roads, graph route, polygons, inferred heights, chunk partitioning",
  source: metadata,
  elevation: elevation.metadata,
};
await writeFile(root + "/attribution.json", json(attribution));
await writeFile(root + "/routes.json", json([route]));
await writeFile(
  root + "/import-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
await writeFile(
  root + "/manifest.json",
  json({
    version: 1,
    name: "Pune — Baner–Aundh–Pashan pilot",
    bounds: PUNE.bounds,
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
