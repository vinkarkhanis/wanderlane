// Build-time OSM download only. Gameplay always uses the prepared local cache.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const bounds = { west: 73.745, south: 18.508, east: 73.834, north: 18.588 };
const box = [bounds.south, bounds.west, bounds.north, bounds.east].join(",");
const query = `[out:json][timeout:180];(way[highway](${box});way[building](${box});way[landuse](${box});way[natural](${box});way[leisure](${box});way[water](${box});way[shop=mall](${box});relation[type=multipolygon](${box});node[shop=mall](${box});node[place](${box});node[highway=traffic_signals](${box}););(._;>;);out body;`;
await mkdir("output/map-expansion", { recursive: true });
await writeFile("output/map-expansion/query.overpassql", query + "\n");
const endpoint =
  process.env.OSM_ENDPOINT || "https://overpass-api.de/api/interpreter";
console.log("Downloading bounded western Pune OSM extract...");
const response = await fetch(endpoint, {
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
const fresh = await response.json();
if (fresh.remark || !Array.isArray(fresh.elements))
  throw Error(fresh.remark || "Incomplete OSM result");
const original = JSON.parse(
  gunzipSync(await readFile("data-sources/pune/osm-source.json.gz")),
);
// Original element versions win in the existing slice, keeping existing geometry stable.
const elements = new Map(fresh.elements.map((e) => [`${e.type}/${e.id}`, e]));
for (const e of original.elements) elements.set(`${e.type}/${e.id}`, e);
const raw = Buffer.from(
  JSON.stringify({
    version: 0.6,
    generator: "Wanderlane offline merged OSM expansion",
    elements: [...elements.values()].sort(
      (a, b) => a.type.localeCompare(b.type) || a.id - b.id,
    ),
  }) + "\n",
);
const sha256 = createHash("sha256").update(raw).digest("hex");
await writeFile(
  "data-sources/pune/osm-expansion.json.gz",
  gzipSync(raw, { mtime: 0 }),
);
await writeFile(
  "data-sources/pune/expansion-metadata.json",
  JSON.stringify(
    {
      source:
        "OpenStreetMap via Overpass API, merged with original pilot snapshot",
      url: endpoint,
      retrievedAt: new Date().toISOString(),
      osmTimestamp: fresh.osm3s?.timestamp_osm_base,
      licence: "ODbL-1.0",
      copyright: "https://www.openstreetmap.org/copyright",
      sha256,
      bounds,
      query,
      originalSourceSha256: createHash("sha256")
        .update(
          gunzipSync(await readFile("data-sources/pune/osm-source.json.gz")),
        )
        .digest("hex"),
      preprocessing:
        "Original pilot OSM element versions retained; new elements added outside and within the wider extent. Prepared data is distributed offline.",
      modifiedDatabaseDistributed: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    elements: elements.size,
    newElements: elements.size - original.elements.length,
    bytes: raw.length,
    sha256,
    bounds,
  }),
);
