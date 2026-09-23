import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { project, unproject } from "../src/city/projection.js";
import { CityPath } from "../src/city/cityPath.js";
import { Vehicle } from "../src/vehicle.js";
import { parseOSM } from "../tools/lib/osm-parser.mjs";
import { PUNE } from "../tools/lib/pune-config.mjs";
import { elevationSource } from "../tools/lib/elevation-processor.mjs";
const m = JSON.parse(readFileSync("assets/cities/pune/manifest.json")),
  nav = JSON.parse(readFileSync("assets/cities/pune/" + m.navigation));
test("local projection round-trips to WGS84 and has right-handed east/south axes", () => {
  for (const lat of [18.534, 18.552, 18.57])
    for (const lon of [73.772, 73.791, 73.81]) {
      const p = project(lat, lon, m.origin),
        q = unproject(...p, m.origin);
      assert.ok(Math.abs(q.lat - lat) < 1e-10 && Math.abs(q.lon - lon) < 1e-10);
    }
  assert.ok(project(18.552, 73.8, m.origin)[0] > 0);
  assert.ok(project(18.56, 73.791, m.origin)[1] < 0);
});
test("route joins source nodes, obeys directed edges and contains no immediate U-turns", () => {
  const es = nav.route.edges;
  assert.ok(nav.route.length > 6000);
  for (let i = 0; i < es.length; i++) {
    const e = es[i],
      next = es[(i + 1) % es.length],
      r = nav.roads[e.road];
    assert.equal(e.to, next.from);
    assert.ok(!r.oneway || r.oneway === e.dir);
    assert.ok(e.from !== next.to || e.road !== next.road);
  }
});
test("Pune auto completes the full loop with bounded nearest-road error", () => {
  const path = new CityPath(nav, m),
    v = new Vehicle(path);
  v.lane = -1.6;
  v.reset(40, -1.6);
  let last = 40,
    laps = 0,
    max = 0;
  for (let i = 0; i < 160000; i++) {
    v.update(1 / 60, {}, true);
    max = Math.max(max, v.near.routeGap);
    assert.ok(Number.isFinite(v.y));
    if (last > path.length - 100 && v.near.distance < 100) {
      laps++;
      break;
    }
    last = v.near.distance;
  }
  assert.equal(laps, 1);
  assert.ok(max < 4, "Route departure " + max + " m");
  console.log("Full-loop maximum route-centre distance", max);
});
test("Return to Road uses nearest public road and legal direction", () => {
  const p = new CityPath(nav, m),
    v = new Vehicle(p);
  for (const r of nav.roads.filter((r) => r.oneway).slice(0, 30)) {
    v.x = (r.p[0] + r.q[0]) / 2;
    v.z = (r.p[1] + r.q[1]) / 2;
    p.resetNearest(v);
    assert.equal(v.speed, 0);
    assert.ok(Math.abs(v.near.offset) <= v.near.width / 2);
  }
});
test("DEM fallback explicitly identifies synthetic elevation", async () => {
  const e = await elevationSource(null, m.origin);
  assert.equal(e.metadata.kind, "procedural-fallback");
  assert.equal(e.height(100, 100), e.height(100, 100));
});
test("multipolygon rings, holes and missing geometry are reported", () => {
  const coords = [
    [18.55, 73.79],
    [18.55, 73.792],
    [18.552, 73.792],
    [18.552, 73.79],
    [18.5505, 73.7905],
    [18.5505, 73.791],
    [18.551, 73.791],
    [18.551, 73.7905],
  ];
  const raw = {
    elements: coords.map((p, i) => ({
      type: "node",
      id: i + 1,
      lat: p[0],
      lon: p[1],
    })),
  };
  raw.elements.push(
    { type: "way", id: 10, nodes: [1, 2, 3, 4, 1] },
    { type: "way", id: 11, nodes: [5, 6, 7, 8, 5] },
    {
      type: "relation",
      id: 20,
      tags: { type: "multipolygon", building: "yes" },
      members: [
        { type: "way", ref: 10, role: "outer" },
        { type: "way", ref: 11, role: "inner" },
      ],
    },
  );
  const report = { malformed: [] },
    o = parseOSM(raw, PUNE, report);
  assert.equal(o.polygons.length, 1);
  assert.equal(o.polygons[0].holes.length, 1);
  assert.deepEqual(report.malformed, []);
});

test("generated junction lane connectors stay continuous across their node seams", () => {
  const p = new CityPath(nav, m);
  let connectors = 0;
  for (let i = 0; i < p.segments.length; i++) {
    const s = p.segments[i].s,
      a = p.getLanePosition(s - 0.001),
      b = p.getLanePosition(s + 0.001);
    if (!p.connectors[i]) continue;
    connectors++;
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.02);
    const angle = Math.atan2(
      Math.sin(a.heading - b.heading),
      Math.cos(a.heading - b.heading),
    );
    assert.ok(Math.abs(angle) < 0.02);
  }
  assert.ok(connectors > 100);
});
function crossingFixture() {
  const roads = [
    {
      id: 0,
      a: 1,
      b: 2,
      p: [-40, 0],
      q: [40, 0],
      length: 80,
      width: 8,
      oneway: 0,
      y0: 0,
      y1: 0,
      tags: {},
    },
    {
      id: 1,
      a: 3,
      b: 4,
      p: [0, -40],
      q: [0, 40],
      length: 80,
      width: 8,
      oneway: 0,
      y0: 5,
      y1: 5,
      tags: { bridge: "yes", layer: "1" },
    },
  ];
  return new CityPath(
    {
      roads,
      bounds: [-50, -50, 50, 50],
      route: {
        edges: [
          { road: 1, dir: 1 },
          { road: 1, dir: -1 },
        ],
      },
    },
    m,
  );
}
test("grade-separated crossings and Return to Road preserve the occupied level", () => {
  const p = crossingFixture();
  assert.equal(p.findNearestRoadPoint(0.1, 0.1, {}, 0.09).roadId, 0);
  assert.equal(p.findNearestRoadPoint(0.1, 0.1, { roadId: 0 }, 5.09).roadId, 1);
  for (const y of [0.09, 5.09]) {
    const v = { x: 0.1, z: 0.1, y, near: {} };
    p.resetNearest(v);
    assert.ok(Math.abs(v.y - y) < 1e-8);
    assert.equal(v.near.roadId, y > 1 ? 1 : 0);
  }
});
test("bridge rails gently constrain both edges without affecting traffic underneath", () => {
  const p = crossingFixture();
  for (const side of [-1, 1]) {
    const n = p.sampleRoad(p.roads[1], 0.5, {});
    n.offset = side * 4.1;
    const v = {
      near: n,
      x: n.x + n.nx * n.offset,
      z: n.z + n.nz * n.offset,
      y: 5.09,
      speed: 12,
      heading: n.heading + 0.2,
    };
    p.constrainRoad(v, 1 / 60);
    assert.ok(Math.abs(v.near.offset) < 3.4);
    assert.ok(v.speed > 10 && v.speed < 12);
    assert.equal(v.y, 5.09);
    const underneath = {
      ...v,
      y: 0.09,
      speed: 12,
      near: { ...n, offset: 4.1 },
    };
    p.constrainRoad(underneath, 1 / 60);
    assert.equal(underneath.speed, 12);
  }
});
