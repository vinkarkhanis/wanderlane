import test from "node:test";
import assert from "node:assert/strict";
import { Vehicle, steeringAngle, contactHeight } from "../src/vehicle.js";
import { PHYS } from "../src/config.js";
import { RoadPath } from "../src/roadPath.js";
import { Controls } from "../src/controls.js";
import {
  detailCandidates,
  tileDetails,
  roadName,
} from "../src/city/cityDetails.js";
import { Grid, meshHeight } from "../src/city/spatial.js";
import { CityPath } from "../src/city/cityPath.js";
test("park contact samples the rendered triangles and excludes areas outside them", () => {
  const positions = [0, 1, 0, 10, 3, 0, 0, 2, 10];
  assert.equal(meshHeight(2, 2, positions, [0, 1, 2]), 1.6);
  assert.equal(meshHeight(9, 9, positions, [0, 1, 2]), -Infinity);
});

test("elevated city approaches retain contact across the shoulder and embankment", () => {
  const roads = [
    {
      id: 0,
      a: 1,
      b: 2,
      p: [0, 0],
      q: [0, 100],
      length: 100,
      width: 8,
      y0: 5,
      y1: 5,
      elevated: true,
      tags: {},
      oneway: 0,
    },
  ];
  const path = new CityPath(
    {
      roads,
      bounds: [-50, -50, 150, 150],
      route: {
        edges: [
          { road: 0, dir: 1 },
          { road: 0, dir: -1 },
        ],
      },
    },
    {},
  );
  path.groundHeight = () => -0.22;
  let previous = contactHeight(path, 3.5, 50, "meadow", 5);
  for (let x = 3.51; x < 14; x += 0.01) {
    const y = contactHeight(path, x, 50, "meadow", 5);
    assert.ok(Math.abs(y - previous) < 0.03, `${x}: ${previous} -> ${y}`);
    previous = y;
  }
  assert.ok(Math.abs(previous + 0.205) < 0.001);
});

test("progressive steering has useful, bounded speed authority and returns to centre", () => {
  for (const speed of [3, 15, 35]) {
    const path = new RoadPath("steering"),
      v = new Vehicle(path);
    v.speed = speed;
    const before = v.heading;
    for (let i = 0; i < 12; i++) v.update(1 / 60, { left: true }, false);
    const change = v.heading - before;
    assert.ok(change > 0.015 && change < 0.15, `${speed}: ${change}`);
    const steer = v.steer;
    for (let i = 0; i < 30; i++) v.update(1 / 60, {}, false);
    assert.ok(v.steer < steer * 0.04);
  }
  assert.ok(steeringAngle(3) > steeringAngle(15));
  assert.ok(steeringAngle(15) > steeringAngle(35));
  assert.equal(steeringAngle(-5), steeringAngle(5));
});

test("reverse coasts, steers in reverse and brake takes priority over throttle", () => {
  const v = new Vehicle(new RoadPath("reverse"));
  for (let i = 0; i < 120; i++)
    v.update(1 / 60, { brake: true, accel: true }, false);
  assert.ok(v.speed < -1);
  const h = v.heading;
  v.update(1 / 60, { left: true }, false);
  assert.ok(v.speed < 0 && v.heading < h);
});

test("road-edge contact is continuous and off-road pitch follows the wheel footprints", () => {
  const path = new RoadPath("ground");
  for (const biome of ["meadow", "snow", "desert", "canyon"]) {
    let previous;
    for (let off = 3.5; off < 7; off += 0.005) {
      const p = path.getLanePosition(800, off);
      const y = contactHeight(path, p.x, p.z, biome, p.y);
      if (previous !== undefined) assert.ok(Math.abs(y - previous) < 0.004);
      previous = y;
    }
  }
  path.groundHeight = (x, z) => x * 0.08 + z * 0.04;
  const v = new Vehicle(path),
    p = path.getLanePosition(800, 45);
  Object.assign(v, { x: p.x, z: p.z, heading: Math.PI / 2 });
  for (let i = 0; i < 120; i++) v.update(1 / 60, {}, false);
  assert.ok(Math.abs(v.pitch - Math.atan(0.08)) < 0.001);
  assert.ok(Math.abs(v.y - (path.groundHeight(v.x, v.z) + 0.015)) < 0.05);
});

test("large frame spikes are substepped and capped; manual input is frame-rate independent", () => {
  const path = new RoadPath("delta"),
    a = new Vehicle(path),
    b = new Vehicle(path);
  a.speed = b.speed = 35;
  a.update(4, { left: true }, false);
  for (let i = 0; i < 6; i++) b.update(1 / 60, { left: true }, false);
  assert.ok(Math.abs(a.x - b.x) < 1e-8);
  assert.ok(
    Math.hypot(
      a.x - path.sampleAtDistance(40).x,
      a.z - path.sampleAtDistance(40).z,
    ) <=
      35 * PHYS.maxDelta,
  );
  const runs = [30, 60, 120].map((fps) => {
    const v = new Vehicle(path);
    for (let i = 0; i < fps * 3; i++)
      v.update(1 / fps, { accel: true, left: i > fps * 2 }, false);
    return v;
  });
  assert.ok(Math.abs(runs[0].heading - runs[2].heading) < 0.02);
  assert.ok(Math.abs(runs[0].speed - runs[2].speed) < 0.05);
});

test("pointer inputs combine and clear on cancellation, leave, blur and explicit pause cleanup", () => {
  class Button extends EventTarget {
    constructor(key) {
      super();
      this.dataset = { key };
      this.capture = new Set();
      this.classList = { toggle() {} };
    }
    setAttribute() {}
    setPointerCapture(id) {
      this.capture.add(id);
    }
    hasPointerCapture(id) {
      return this.capture.has(id);
    }
    releasePointerCapture(id) {
      this.capture.delete(id);
    }
    getBoundingClientRect() {
      return { left: 0, right: 80, top: 0, bottom: 80 };
    }
  }
  const buttons = [new Button("left"), new Button("accel")],
    win = new EventTarget(),
    doc = new EventTarget();
  doc.querySelectorAll = () => buttons;
  doc.querySelector = () => null;
  doc.getElementById = () => new Button();
  globalThis.document = doc;
  globalThis.addEventListener = win.addEventListener.bind(win);
  try {
    const c = new Controls({});
    const send = (b, type, pointerId, extra = {}) =>
      b.dispatchEvent(
        Object.assign(new Event(type), { pointerId, button: 0, ...extra }),
      );
    send(buttons[0], "pointerdown", 1);
    send(buttons[1], "pointerdown", 2);
    send(buttons[1], "pointerdown", 3);
    assert.ok(c.input.left && c.input.accel);
    send(buttons[1], "pointercancel", 2);
    assert.ok(c.input.accel);
    send(buttons[0], "pointermove", 1, { clientX: 90, clientY: 40 });
    assert.ok(!c.input.left && c.input.accel);
    win.dispatchEvent(new Event("blur"));
    assert.ok(!c.input.accel);
    for (const event of [
      "pointerup",
      "pointercancel",
      "lostpointercapture",
      "pointerleave",
    ]) {
      send(buttons[0], "pointerdown", 4);
      send(buttons[0], event, 4);
      assert.ok(!c.input.left);
    }
    send(buttons[0], "pointerdown", 5);
    c.clear();
    assert.equal(c.pointers.size, 0);
    assert.equal(buttons[0].capture.size, 0);
  } finally {
    delete globalThis.document;
    delete globalThis.addEventListener;
  }
});

test("city props are deterministic, clear roads/buildings, bounded and deduplicate names", () => {
  const roads = Array.from({ length: 5 }, (_, id) => ({
    id,
    p: [20 + id * 42, 20],
    q: [20 + id * 42, 230],
    length: 210,
    width: 6,
    tags: { name: "Test Road" },
  }));
  const grid = new Grid(80);
  roads.forEach((r) => grid.insert(r, [r.p[0] - 20, 0, r.p[0] + 20, 256]));
  const path = { roads, grid },
    plan = detailCandidates(path);
  assert.deepEqual(
    plan,
    detailCandidates({ roads: [...roads].reverse(), grid }),
  );
  assert.ok(plan.some((p) => p.kind === "lamp"));
  assert.ok(plan.some((p) => p.kind === "tree"));
  const signs = plan.filter((p) => p.kind === "sign");
  for (const a of signs)
    for (const b of signs)
      if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 180);
  const data = {
    x: 0,
    z: 0,
    size: 256,
    buildings: [{ bounds: [0, 0, 90, 256] }],
    land: [],
  };
  const props = tileDetails(data, plan, "Low");
  assert.ok(props.length > 0 && props.length <= 18);
  assert.ok(props.every((p) => p.x > 90 + p.radius));
  assert.equal(roadName("  Baner   Road "), "Baner Road");
  assert.equal(roadName("बाणेर रस्ता"), "बाणेर रस्ता");
  for (const name of [
    null,
    "",
    "unknown",
    "<script>",
    "a".repeat(65),
    "a\u202eb",
    "x\nY",
  ])
    assert.equal(roadName(name), "");
});
