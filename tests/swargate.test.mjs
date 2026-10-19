import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Vehicle } from "../src/vehicle.js";
import { CityPath } from "../src/city/cityPath.js";
import { roadPaint } from "../src/city/puneRoadPaint.js";
import {
  stationBuilding,
  stationBusPlan,
  stationFrame,
  inStationGrounds,
  stationLevel,
  stationPad,
  stationPadCell,
} from "../src/city/swargatePlan.js";
import { junctionNodes } from "../src/city/puneEdges.js";
import { bridgePierPlan } from "../src/city/puneBridgePiers.js";
import { nearest } from "../src/city/spatial.js";
const root = "assets/cities/pune/",
  m = JSON.parse(readFileSync(root + "manifest.json"));
const nav = JSON.parse(readFileSync(root + m.navigation));
const route = nav.explorationRoutes.find((r) => r.id === "sinhgad-swargate");
const path = new CityPath({ ...nav, route, exploration: true }, m),
  junctions = junctionNodes(path);

test("station has six off-road buses and mapped terminal footprints", () => {
  const buses = stationBusPlan(path);
  assert.equal(buses.length, 6);
  const frame = stationFrame(m.origin);
  assert.ok(inStationGrounds(frame.x, frame.z, m.origin));
  const source = JSON.parse(
    gunzipSync(readFileSync("data-sources/pune/osm-expansion.json.gz")),
  );
  const terminals = source.elements.filter(
    (e) => e.type === "way" && stationBuilding({ id: `w${e.id}:0` }),
  );
  assert.equal(terminals.length, 2);
  assert.ok(
    terminals.every(
      (t) => t.tags.amenity === "bus_station" && t.tags.operator === "MSRTC",
    ),
  );
  assert.ok(!inStationGrounds(0, 0, m.origin));
});
test("station approach route completes a truck lap without leaving the road", () => {
  const v = new Vehicle(path, "truck");
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
  assert.ok(lap);
  assert.ok(maxGap < 5, `route departure ${maxGap}`);
});
test("lane paint stays inside roads, leaves junction gaps, and omits elevated crossings", () => {
  let lanes = 0,
    crossings = 0;
  for (const e of route.edges) {
    const r = nav.roads[e.road];
    for (const p of roadPaint(r, junctions)) {
      assert.ok(Math.abs(p.offset) + p.width / 2 < r.width / 2);
      assert.ok(p.d - p.length / 2 >= 0 && p.d + p.length / 2 <= r.length);
      assert.ok(p.width > 0 && p.length > 0);
      if (p.kind === "crossing") {
        assert.ok(!r.elevated);
        crossings++;
      }
      if (p.kind === "lane") {
        assert.ok(r.oneway);
        lanes++;
      }
    }
  }
  assert.ok(lanes > 20);
  assert.ok(crossings > 10);
});
test("new drive begins near Swargate and passes the public station frontage", () => {
  const frame = stationFrame(m.origin),
    start = path.sampleAtDistance(40, {});
  assert.ok(Math.hypot(start.x - frame.x, start.z - frame.z) < 350);
  assert.ok(
    route.edges.some((e) => nav.roads[e.road].tags.name === "Satara Road"),
  );
  assert.ok(path.routeNearest(frame.x - 60, frame.z).d < 65);
  assert.equal(route.startLabel, "Swargate bus station approach");
});
test("graded station forecourt follows the entrance and leaves the public driving lane clear", () => {
  const entrance = nav.roads.find(
    (r) => r.way === 669033674 && r.a === 8049563601,
  );
  assert.equal(
    stationLevel(path, () => -20),
    entrance.y0,
  );
  const pad = stationPad(m.origin);
  for (let s = 0; s < path.length; s += 2) {
    const p = path.getLanePosition(s, -1.6);
    assert.ok(
      !stationPadCell(path, p.x, p.z),
      `public route crosses forecourt at ${s}`,
    );
  }
});
test("flyover supports clear lower public road corridors", () => {
  const piers = bridgePierPlan(path),
    frame = stationFrame(m.origin);
  assert.ok(
    piers.filter((p) => Math.hypot(p.x - frame.x, p.z - frame.z) < 350).length >
      3,
  );
  for (const p of piers)
    for (const r of path.grid.query(p.px, p.pz, 15)) {
      const n = nearest([p.px, p.pz], r.p, r.q),
        y = r.y0 + (r.y1 - r.y0) * n.t;
      if (r.id !== p.roadId && y < p.top - 1.4)
        assert.ok(n.d >= r.width / 2 + 1.4);
    }
});
