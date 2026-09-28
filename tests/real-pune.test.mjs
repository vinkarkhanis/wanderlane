import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import {
  buildingStyle,
  ARCHETYPES,
  markingRanges,
  HERO_ROUTE,
} from "../src/city/puneStyle.js";
import {
  edgeCandidates,
  tileEdges,
  EDGE_BUDGET,
  junctionNodes,
} from "../src/city/puneEdges.js";
import { detailCandidates } from "../src/city/cityDetails.js";
import { nearest, inside } from "../src/city/spatial.js";
import { discoveryTrip, DiscoveryJournal } from "../src/city/puneDiscovery.js";
import { CityExperience } from "../src/city/cityExperience.js";
const base = "assets/cities/pune/";
const manifest = JSON.parse(fs.readFileSync(base + "manifest.json"));
const nav = JSON.parse(fs.readFileSync(base + manifest.navigation));
const path = new CityPath(nav, manifest);
const chunks = manifest.chunks.map((c) =>
  JSON.parse(fs.readFileSync(base + c.file)),
);
test("building archetypes are stable by OSM id, honor tags and cover seven families", () => {
  const buildings = chunks.flatMap((c) => c.buildings);
  const all = buildings.map((b) => buildingStyle(b));
  assert.deepEqual(
    all,
    [...buildings]
      .reverse()
      .map((b) => buildingStyle(b))
      .reverse(),
  );
  assert.deepEqual(new Set(all.map((s) => s.family)), new Set(ARCHETYPES));
  assert.equal(
    buildingStyle({ id: "x", height: 12, tags: { building: "construction" } })
      .family,
    "construction",
  );
  assert.equal(
    buildingStyle({ id: "x", height: 8, tags: { building: "retail" } }).family,
    "shops",
  );
});
test("hero edges are deterministic, budgeted, seam-safe and clear all geometry", () => {
  const plan = edgeCandidates(path, detailCandidates(path));
  assert.deepEqual(plan, edgeCandidates(path, detailCandidates(path)));
  const loaded = chunks.flatMap((c) => tileEdges(c, plan, "High"));
  const junctions = junctionNodes(path);
  assert.ok(loaded.length > 30, `only ${loaded.length} props`);
  assert.deepEqual(
    loaded.map((p) => p.id).sort(),
    [...chunks]
      .reverse()
      .flatMap((c) => tileEdges(c, plan, "High"))
      .map((p) => p.id)
      .sort(),
  );
  assert.equal(new Set(loaded.map((p) => p.id)).size, loaded.length);
  for (const c of chunks)
    for (const quality of Object.keys(EDGE_BUDGET)) {
      const ps = tileEdges(c, plan, quality);
      assert.ok(ps.length <= EDGE_BUDGET[quality]);
      for (const p of ps) {
        const source = path.roads[p.roadId];
        for (const [id, point] of [
          [source.a, source.p],
          [source.b, source.q],
        ])
          if (junctions.has(id))
            assert.ok(Math.hypot(p.x - point[0], p.z - point[1]) >= 25);
        assert.ok(
          Math.min(
            p.x - c.x,
            c.x + c.size - p.x,
            p.z - c.z,
            c.z + c.size - p.z,
          ) > p.radius,
        );
        for (const r of path.grid.query(p.x, p.z, 24))
          assert.ok(
            nearest([p.x, p.z], r.p, r.q).d >= r.width / 2 + p.radius + 1,
          );
        assert.ok(
          !c.buildings.some(
            (b) =>
              p.x >= b.bounds[0] - p.radius &&
              p.x <= b.bounds[2] + p.radius &&
              p.z >= b.bounds[1] - p.radius &&
              p.z <= b.bounds[3] + p.radius,
          ),
        );
        assert.ok(
          !c.land.some(
            (l) =>
              l.kind === "water" &&
              (inside([p.x, p.z], l.outer) ||
                l.outer.some(
                  (a, i) =>
                    nearest([p.x, p.z], a, l.outer[(i + 1) % l.outer.length])
                      .d < p.radius,
                )),
          ),
        );
      }
    }
});
test("markings respect road class, one-way roads and junction setbacks", () => {
  const nodes = junctionNodes(path);
  for (const r of path.roads)
    for (const [a, b] of markingRanges(r, nodes)) {
      assert.ok(
        ["primary", "secondary", "tertiary", "trunk"].includes(r.tags.highway),
      );
      assert.ok(!r.oneway && r.width >= 6 && b > a);
      if (nodes.has(r.a))
        assert.ok(a * r.length >= Math.max(14, r.width) - 1e-8);
      if (nodes.has(r.b))
        assert.ok((1 - b) * r.length >= Math.max(14, r.width) - 1e-8);
    }
  assert.equal(
    markingRanges({ ...path.roads[0], tags: { highway: "residential" } }, nodes)
      .length,
    0,
  );
});
test("both discovery drives progress end to end and journal survives a restart", () => {
  const journal = new DiscoveryJournal();
  for (const id of ["baner-evening", "monsoon-pashan"]) {
    const d = discoveryTrip(path, id),
      e = new CityExperience(path, d);
    e.journal = journal;
    e.start();
    for (let travelled = 0; travelled <= d.distance; travelled++)
      e.update(
        0.1,
        {
          auto: true,
          speed: 10,
          near: {
            distance: (d.start + travelled) % path.length,
            routeGap: 0,
            offset: 0,
            width: 7,
          },
        },
        0,
      );
    assert.equal(e.status, "completed");
    assert.equal(e.snapshot.progress, 1);
    e.start();
    assert.equal(e.status, "active");
  }
  assert.equal(journal.snapshot.drives.length, 2);
  journal.encounter("evening-chai-crowd");
  journal.encounter("evening-chai-crowd");
  journal.encounter("invented");
  assert.equal(journal.snapshot.scenes.length, 1);
  assert.match(journal.snapshot.scenes[0].provenance, /Fictional/);
  assert.ok(HERO_ROUTE.length >= 2000 && HERO_ROUTE.length <= 3000);
});
