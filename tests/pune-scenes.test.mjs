import test from "node:test";
import assert from "node:assert/strict";
import { dressPuneScene, PUNE_SCENES } from "../src/city/puneScenes.js";
import { STREET_SCENES } from "../src/city/puneStreetDetails.js";
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
