import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { CityPath } from "../src/city/cityPath.js";
import { Vehicle } from "../src/vehicle.js";
import { pavementPanels } from "../src/city/puneStreetscape.js";
import { junctionNodes } from "../src/city/puneEdges.js";
const root = "assets/cities/pune/",
  m = JSON.parse(readFileSync(root + "manifest.json")),
  nav = JSON.parse(readFileSync(root + m.navigation));
const original = JSON.parse(
  gunzipSync(readFileSync("data-sources/pune/pilot-navigation.json.gz")),
);
test("expanded map preserves every original road and curated route exactly", () => {
  assert.deepEqual(nav.roads.slice(0, original.roads.length), original.roads);
  assert.deepEqual(nav.route, original.route);
  assert.ok(m.chunks.length > 1000);
  assert.ok(nav.roads.length > original.roads.length * 3);
});
test("all exploration loops follow legal connected OSM roads and drive a complete lap", () => {
  assert.equal(new Set(nav.explorationRoutes.map((r) => r.id)).size, 3);
  for (const route of nav.explorationRoutes) {
    for (let i = 0; i < route.edges.length; i++) {
      const e = route.edges[i],
        r = nav.roads[e.road],
        n = route.edges[(i + 1) % route.edges.length];
      assert.equal(e.to, n.from);
      assert.ok(!r.oneway || r.oneway === e.dir);
    }
    assert.ok(route.length > 10000);
    const path = new CityPath({ ...nav, route, exploration: true }, m),
      v = new Vehicle(path, "truck");
    v.lane = -1.6;
    v.reset(40, -1.6);
    let last = 40,
      lap = false,
      maxGap = 0;
    for (let i = 0; i < 180000; i++) {
      v.update(1 / 60, {}, true);
      assert.ok(Number.isFinite(v.y) && Math.abs(v.pitch) < 0.7);
      maxGap = Math.max(maxGap, v.near.routeGap);
      if (last > path.length - 100 && v.near.distance < 100) {
        lap = true;
        break;
      }
      last = v.near.distance;
    }
    assert.ok(lap, route.id + " completes");
    assert.ok(maxGap < 5, route.id + " gap " + maxGap);
  }
});
test("OSM paths, land-use variety and shopping centres are imported, with bounded safe pavement panels", () => {
  const path = new CityPath(nav, m),
    junctions = junctionNodes(path);
  let paths = 0,
    malls = [],
    classes = new Set(),
    panels = 0,
    hillBuildings = [];
  for (const entry of m.chunks) {
    const data = JSON.parse(readFileSync(root + entry.file));
    paths += (data.paths || []).length;
    malls.push(...data.buildings.filter((b) => b.style === "mall"));
    hillBuildings.push(
      ...data.buildings.filter(
        (b) =>
          b.bounds[0] > -3100 &&
          b.bounds[2] < -2600 &&
          b.bounds[1] > -1050 &&
          b.bounds[3] < -500,
      ),
    );
    for (const l of data.land) classes.add(l.terrainClass);
    const p = pavementPanels(data, path, junctions, "Low");
    assert.ok(p.length <= 90);
    for (const x of p) {
      assert.ok(Number.isFinite(x.y));
      assert.ok(x.width > 1);
      assert.ok(
        Math.hypot(
          x.x - path.roads[x.road].p[0],
          x.z - path.roads[x.road].p[1],
        ) >
          path.roads[x.road].width / 2,
      );
    }
    panels += p.length;
  }
  assert.ok(paths > 4000);
  assert.ok(malls.some((b) => b.mallName === "Westend Mall"));
  assert.ok(malls.length >= 4);
  assert.ok(hillBuildings.length > 5);
  assert.ok(
    hillBuildings.sort((a, b) => a.y - b.y)[
      Math.floor(hillBuildings.length / 2)
    ].y > 40,
    "hill buildings must follow the expanded elevation, rather than being buried at the old lowland height",
  );
  assert.ok(panels > 1000);
  for (const c of ["woodland", "meadow", "fields"])
    assert.ok(classes.has(c), c);
});
