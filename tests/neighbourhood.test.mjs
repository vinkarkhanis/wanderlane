import test from "node:test";
import assert from "node:assert/strict";
import { pedestrianPose, SHOP_CROWD } from "../src/city/puneShopfronts.js";
test("pavement walkers pause, return and stay clear of shops, scooters and one another", () => {
  assert.deepEqual(SHOP_CROWD, { Low: 3, Medium: 8, High: 10 });
  for (let t = 0; t < 64; t += 0.1) {
    const actors = Array.from({ length: 10 }, (_, i) =>
      pedestrianPose("shops", i, t),
    );
    for (let i = 0; i < actors.length; i++) {
      const p = actors[i];
      assert.ok(Math.hypot(p.x, p.z) + 0.35 < 7);
      assert.ok(p.z >= -3.76 && p.z <= -0.8);
      if (i < 4) assert.ok(p.z <= -2.1);
      else assert.ok(p.z === -0.8 && !p.moving);
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
