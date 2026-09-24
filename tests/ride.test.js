import test from "node:test";
import assert from "node:assert/strict";
import { VehiclePose } from "../src/vehiclePose.js";

test("uneven display intervals do not reintroduce fixed-step judder", () => {
  const v = { x: 0, y: 0, z: 0, heading: 0, speed: 20 },
    view = new VehiclePose();
  view.capture(v);
  let remainder = 0,
    last = 0;
  for (let frame = 0; frame < 300; frame++) {
    const dt = [0.006, 0.01, 0.014, 0.021][frame % 4];
    remainder += dt;
    while (remainder >= 1 / 60) {
      view.capture(v);
      v.z += 20 / 60;
      remainder -= 1 / 60;
    }
    const pose = view.sample(v, remainder * 60);
    if (frame > 4) assert.ok(Math.abs(pose.z - last - 20 * dt) < 1e-9);
    last = pose.z;
  }
});

test("render motion is continuous between 60 Hz physics ticks on high-refresh screens", () => {
  for (const fps of [30, 60, 90, 120, 144, 165]) {
    const v = { x: 0, y: 0, z: 0, speed: 30, heading: 0 },
      view = new VehiclePose();
    let accumulator = 0,
      last = 0;
    view.capture(v);
    for (let frame = 0; frame < fps * 3; frame++) {
      accumulator += 1 / fps;
      while (accumulator >= 1 / 60) {
        view.capture(v);
        v.z += v.speed / 60;
        accumulator -= 1 / 60;
      }
      const pose = view.sample(v, accumulator * 60);
      if (frame > 4)
        assert.ok(
          Math.abs(pose.z - last - v.speed / fps) < 1e-9,
          `${fps} Hz frame ${frame}`,
        );
      last = pose.z;
    }
  }
});

test("render interpolation handles heading wrap, wheel contact, pause and teleports", () => {
  const v = {
    x: 0,
    y: 1,
    z: 0,
    heading: Math.PI - 0.1,
    wheelHeights: [1, 1, 1, 1],
  };
  const view = new VehiclePose();
  view.capture(v);
  v.heading = -Math.PI + 0.1;
  v.y = 1.1;
  v.wheelHeights = [1.1, 1.1, 1.1, 1.1];
  const halfway = view.sample(v, 0.5);
  assert.ok(Math.abs(halfway.heading - Math.PI) < 1e-9);
  assert.ok(Math.abs(halfway.wheelHeights[0] - halfway.y) < 1e-9);
  assert.equal(view.sample(v, 0, true).y, v.y);
  v.x = 100;
  assert.equal(view.sample(v, 0.1).x, 100);
  assert.equal(view.sample({ ...v, x: 5 }, 0.2).x, 5);
});
