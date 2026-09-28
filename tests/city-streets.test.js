import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CityPath } from "../src/city/cityPath.js";
import {
  STREET_SCENES,
  safeStreetScene,
  ACTOR_BUDGET,
} from "../src/city/puneStreetDetails.js";
import { roadName } from "../src/city/cityDetails.js";
const m = JSON.parse(readFileSync("assets/cities/pune/manifest.json")),
  p = new CityPath(
    JSON.parse(readFileSync("assets/cities/pune/" + m.navigation)),
    m,
  );
test("all authored scenes clear road corridors, buildings, water and chunk seams", () => {
  for (const s of STREET_SCENES) {
    const c = m.chunks.find((c) => c.id === s.tile),
      data = JSON.parse(readFileSync("assets/cities/pune/" + c.file));
    assert.ok(safeStreetScene(s, data, p), s.id);
    assert.equal(safeStreetScene(s, data, p), safeStreetScene(s, data, p));
  }
  assert.equal(new Set(STREET_SCENES.map((s) => s.district)).size, 3);
  assert.ok(ACTOR_BUDGET.Low < ACTOR_BUDGET.Medium && ACTOR_BUDGET.High <= 4);
});
test("OSM strings reject markup, controls and bidi, retain Marathi", () => {
  for (const s of [
    "<script>bad</script>",
    "road\u202evil",
    "road\u0000",
    "road\u2066",
  ])
    assert.equal(roadName(s), "");
  assert.equal(roadName("  पाषाण-सुस रस्ता  "), "पाषाण-सुस रस्ता");
});
