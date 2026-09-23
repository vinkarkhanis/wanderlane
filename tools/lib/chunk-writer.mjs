import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { round, clipRing } from "./geometry.mjs";
export const json = (value) => JSON.stringify(value) + "\n";
export async function writeChunks(
  root,
  osm,
  graph,
  buildings,
  land,
  elevation,
  config,
) {
  const size = config.chunkSize,
    chunks = new Map();
  for (
    let x = Math.floor(osm.bounds[0] / size);
    x <= Math.floor(osm.bounds[2] / size);
    x++
  )
    for (
      let z = Math.floor(osm.bounds[1] / size);
      z <= Math.floor(osm.bounds[3] / size);
      z++
    ) {
      const id = x + "," + z;
      chunks.set(id, {
        id,
        x: x * size,
        z: z * size,
        size,
        roads: [],
        buildings: [],
        land: [],
        points: [],
        terrain: [],
      });
    }
  const assign = (feature, field, b) => {
    for (let x = Math.floor(b[0] / size); x <= Math.floor(b[2] / size); x++)
      for (let z = Math.floor(b[1] / size); z <= Math.floor(b[3] / size); z++)
        chunks.get(x + "," + z)?.[field].push(feature);
  };
  for (const r of graph.roads) {
    const x = (r.p[0] + r.q[0]) / 2,
      z = (r.p[1] + r.q[1]) / 2;
    assign(r.id, "roads", [x, z, x, z]);
  }
  for (const b of buildings)
    assign(b, "buildings", [
      (b.bounds[0] + b.bounds[2]) / 2,
      (b.bounds[1] + b.bounds[3]) / 2,
      (b.bounds[0] + b.bounds[2]) / 2,
      (b.bounds[1] + b.bounds[3]) / 2,
    ]);
  for (const l of land) {
    for (const c of chunks.values()) {
      const b = [c.x, c.z, c.x + size, c.z + size];
      if (
        l.bounds[2] < b[0] ||
        l.bounds[0] > b[2] ||
        l.bounds[3] < b[1] ||
        l.bounds[1] > b[3]
      )
        continue;
      const outer = clipRing(l.outer, b);
      if (outer.length >= 3)
        c.land.push({
          ...l,
          outer,
          holes: l.holes
            .map((h) => clipRing(h, b))
            .filter((h) => h.length >= 3),
        });
    }
  }
  for (const p of osm.points) assign(p, "points", [...p.p, ...p.p]);
  await mkdir(root + "/chunks", { recursive: true });
  const entries = [];
  for (const c of chunks.values()) {
    c.terrainResolution = 16;
    for (let j = 0; j <= 16; j++)
      for (let i = 0; i <= 16; i++) {
        const x = c.x + (i * size) / 16,
          z = c.z + (j * size) / 16;
        const y = elevation.height(
          Math.max(osm.bounds[0], Math.min(osm.bounds[2], x)),
          Math.max(osm.bounds[1], Math.min(osm.bounds[3], z)),
        );
        c.terrain.push(round(y));
      }
    const content = json(c),
      hash = createHash("sha256").update(content).digest("hex").slice(0, 12),
      file = "chunks/" + c.id.replace(",", "_") + "." + hash + ".json";
    await writeFile(root + "/" + file, content);
    await writeFile(root + "/" + file + ".gz", gzipSync(content, { mtime: 0 }));
    entries.push({
      id: c.id,
      x: c.x,
      z: c.z,
      file,
      bytes: Buffer.byteLength(content),
      buildings: c.buildings.length,
    });
  }
  return entries;
}
