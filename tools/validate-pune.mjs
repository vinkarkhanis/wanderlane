import { readFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";
const root = process.argv[2] || "assets/cities/pune";
const read = async (f) => JSON.parse(await readFile(root + "/" + f, "utf8"));
const m = await read("manifest.json"),
  n = await read(m.navigation),
  a = await read("attribution.json");
assert.equal(a.modifiedDatabase, true);
assert.ok(a.text.includes("OpenStreetMap"));
let max = 0,
  buildings = 0;
for (const entry of m.chunks) {
  const file = root + "/" + entry.file,
    size = (await stat(file)).size;
  max = Math.max(max, size);
  assert.ok(size < 25 * 1024 * 1024);
  const c = await read(entry.file);
  assert.equal(c.id, entry.id);
  assert.equal(c.terrain.length, (c.terrainResolution + 1) ** 2);
  assert.ok(c.terrain.every(Number.isFinite));
  for (const b of c.buildings) {
    assert.ok(b.height >= 2.8 && b.height <= 85);
    assert.ok(b.outer.length >= 3);
    buildings++;
  }
}
const route = n.route.edges;
for (let i = 0; i < route.length; i++) {
  const e = route[i],
    r = n.roads[e.road],
    next = route[(i + 1) % route.length];
  assert.equal(e.to, next.from);
  assert.equal(e.from, e.dir === 1 ? r.a : r.b);
  assert.equal(e.to, e.dir === 1 ? r.b : r.a);
  assert.ok(!r.oneway || r.oneway === e.dir);
}
console.log({
  chunks: m.chunks.length,
  roads: n.roads.length,
  buildings,
  routeMetres: n.route.length,
  maxChunkBytes: max,
  elevation: m.elevation.kind,
  validation: "passed",
});
