import test from "node:test";
import assert from "node:assert/strict";
import {
  pedestrianPose,
  SHOP_CROWD,
  shopfronts,
} from "../src/city/puneShopfronts.js";
test("pavement walkers pause, return and stay clear of shops, scooters and one another", () => {
  assert.deepEqual(SHOP_CROWD, { Low: 6, Medium: 12, High: 16 });
  for (let t = 0; t < 64; t += 0.1) {
    const actors = Array.from({ length: SHOP_CROWD.High }, (_, i) =>
      pedestrianPose("shops", i, t),
    );
    for (let i = 0; i < actors.length; i++) {
      const p = actors[i];
      assert.ok(Math.hypot(p.x, p.z) + 0.35 < 7);
      assert.ok(p.z >= -3.76 && p.z <= 1.5);
      if (i < 4) assert.ok(p.z <= -2.1);
      else if (i < 10) assert.ok(p.z >= -1.35 && p.z <= 1.2);
      else assert.ok(p.z === 1.5 && !p.moving);
      for (let j = 0; j < i; j++)
        assert.ok(Math.hypot(p.x - actors[j].x, p.z - actors[j].z) >= 0.54);
    }
  }
  assert.equal(pedestrianPose("shops", 0, 14).moving, false);
  assert.equal(pedestrianPose("shops", 0, 20).moving, true);
  assert.deepEqual(
    pedestrianPose("shops", 0, 0),
    pedestrianPose("shops", 0, 32),
  );
});

test("customers enter, browse and exit without crossing counters or partitions", () => {
  const obstacles = [];
  shopfronts(
    (x, y, z, w, h, d) => {
      if (y + h / 2 > 0.2 && y - h / 2 < 1.75) obstacles.push({ x, z, w, d });
    },
    new Proxy({}, { get: (_, key) => key }),
  );
  for (let i = 4; i < SHOP_CROWD.High; i++) {
    let inside = false,
      outside = false;
    for (let t = 0; t < 28; t += 0.1) {
      const p = pedestrianPose("shops", i, t);
      inside ||= p.z > 1;
      outside ||= p.z < -1;
      for (const o of obstacles)
        assert.ok(
          Math.abs(p.x - o.x) >= o.w / 2 + 0.3 ||
            Math.abs(p.z - o.z) >= o.d / 2 + 0.2,
          JSON.stringify({ i, t, p, o }),
        );
    }
    assert.ok(inside && (i >= 10 || outside));
    assert.deepEqual(
      pedestrianPose("shops", i, 0),
      pedestrianPose("shops", i, 28),
    );
  }
});
