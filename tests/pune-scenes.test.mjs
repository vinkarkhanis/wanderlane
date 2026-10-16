import test from "node:test";
import assert from "node:assert/strict";
import { dressPuneScene, PUNE_SCENES } from "../src/city/puneScenes.js";
import { STREET_SCENES } from "../src/city/puneStreetDetails.js";
import { shopfronts } from "../src/city/puneShopfronts.js";
test("market detail stays in its cleared parcel and outside customer paths", () => {
  const materials = new Proxy({}, { get: (_, name) => name });
  for (const quality of ["Low", "Medium", "High"]) {
    const blocks = [];
    shopfronts((...args) => blocks.push(args), materials, quality);
    for (const [x, y, z, w, h, d] of blocks) {
      assert.ok([x, y, z, w, h, d].every(Number.isFinite));
      assert.ok(Math.hypot(Math.abs(x) + w / 2, Math.abs(z) + d / 2) < 7);
    }
    // People walk at the left of each entrance; check body-height obstacles.
    for (let i = 0; i < 6; i++) {
      const x = -4.75 + i * 1.9 - 0.28;
      for (let z = -1.35; z <= 1.2; z += 0.1) {
        assert.ok(
          !blocks.some(
            ([bx, y, bz, w, h, d]) =>
              y + h / 2 > 0.2 &&
              y - h / 2 < 1.8 &&
              Math.abs(x - bx) < w / 2 + 0.12 &&
              Math.abs(z - bz) < d / 2 + 0.12,
          ),
          `${quality} bay ${i}`,
        );
      }
    }
  }
});
test("Pune scene geometry stays inside its validated seven-metre clearance", () => {
  const materials = new Proxy({}, { get: (_, name) => name });
  for (const id of Object.keys(PUNE_SCENES)) {
    const scene = STREET_SCENES.find((s) => s.id === id);
    assert.ok(scene);
    let count = 0;
    dressPuneScene(
      scene,
      (x, y, z, w, h, d, mat) => {
        count++;
        assert.ok([x, y, z, w, h, d].every(Number.isFinite));
        assert.ok(w > 0 && h > 0 && d > 0 && mat);
        assert.ok(Math.hypot(Math.abs(x) + w / 2, Math.abs(z) + d / 2) < 7, id);
      },
      materials,
    );
    assert.ok(count > 20);
  }
});
