// Build-time only: extend the cached western map into Sinhgad Road / Swargate.
// Existing element versions and navigation are retained; gameplay stays offline.
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const sourcePath = "data-sources/pune/osm-expansion.json.gz";
const metadataPath = "data-sources/pune/expansion-metadata.json";
const previous = JSON.parse(await readFile(metadataPath, "utf8"));
const existingBytes = gunzipSync(await readFile(sourcePath));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (sha(existingBytes) !== previous.sha256)
  throw Error("Cached source checksum mismatch");
const bounds = { west: 73.804, south: 18.477, east: 73.867, north: 18.523 };
const box = [bounds.south, bounds.west, bounds.north, bounds.east].join(",");
const query = `[out:json][timeout:180];(way[highway](${box});way[building](${box});way[landuse](${box});way[natural](${box});way[leisure](${box});way[water](${box});relation[type=multipolygon](${box});relation[type=restriction](${box});node[place](${box});node[highway=traffic_signals](${box}););(._;>;);out body;`;
let endpoint;
console.log("Downloading offline Sinhgad Road–Swargate corridor...");
let fresh;
for (const url of process.env.OSM_ENDPOINT
  ? [process.env.OSM_ENDPOINT]
  : [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ]) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Wanderlane-offline-map-import/1.0",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(240000),
    });
    if (!response.ok)
      throw Error(
        `OSM HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
    fresh = await response.json();
    if (fresh.remark || !Array.isArray(fresh.elements))
      throw Error(fresh.remark || "Incomplete OSM result");
    endpoint = url;
    break;
  } catch (e) {
    console.warn(url + ": " + e.message);
  }
}
if (!endpoint)
  throw Error("No complete OSM download; existing cache has not been changed");
const existing = JSON.parse(existingBytes);
const elements = new Map(fresh.elements.map((e) => [`${e.type}/${e.id}`, e]));
for (const e of existing.elements) elements.set(`${e.type}/${e.id}`, e);
const raw = Buffer.from(
  JSON.stringify({
    version: 0.6,
    generator: "Wanderlane offline merged OSM southern corridor",
    elements: [...elements.values()].sort(
      (a, b) => a.type.localeCompare(b.type) || a.id - b.id,
    ),
  }) + "\n",
);
const baseline = "data-sources/pune/western-navigation.json.gz";
try {
  await readFile(baseline);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  const manifest = JSON.parse(
    await readFile("assets/cities/pune/manifest.json", "utf8"),
  );
  await writeFile(
    baseline,
    gzipSync(await readFile("assets/cities/pune/" + manifest.navigation), {
      mtime: 0,
    }),
  );
}
await writeFile(sourcePath, gzipSync(raw, { mtime: 0 }));
await writeFile(
  metadataPath,
  JSON.stringify(
    {
      ...previous,
      source:
        "OpenStreetMap via Overpass API; original pilot and western snapshot retained, southern corridor added",
      sha256: sha(raw),
      bounds: {
        west: Math.min(previous.bounds.west, bounds.west),
        south: Math.min(previous.bounds.south, bounds.south),
        east: Math.max(previous.bounds.east, bounds.east),
        north: Math.max(previous.bounds.north, bounds.north),
      },
      extensions: [
        ...(previous.extensions || []).filter(
          (e) => e.id !== "sinhgad-swargate",
        ),
        {
          id: "sinhgad-swargate",
          bounds,
          query,
          url: endpoint,
          retrievedAt: new Date().toISOString(),
          osmTimestamp: fresh.osm3s?.timestamp_osm_base,
          previousSourceSha256: previous.sha256,
          downloadedElements: fresh.elements.length,
        },
      ],
      preprocessing:
        "Original pilot and western OSM element versions and navigation retained. Southern corridor merged offline. Bounds enclose the union of extracts, not full rectangular urban coverage.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    elements: elements.size,
    added: elements.size - existing.elements.length,
    sha256: sha(raw),
    bounds,
  }),
);
