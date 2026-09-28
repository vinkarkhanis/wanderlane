# Real Pune completion report

Implementation and checks: 27–28 September 2026. Branch `feature/real-pune`, starting local main commit `c7dd086` (`physics improvement`). The pre-existing modified/untracked gameplay work was retained. No commit, push, merge, rebase or PR was made.

## Delivered scope

- A 2.6 km hero section: Explorer progress 9690 m through the loop seam to 1559.25 m, joining the existing chai, shopfront and bus-stop scenes in Baner. Coordinates and selection rationale are in `real-pune.md`.
- Seven deterministic building families, original facade/emission textures, balcony fronts, sunshades, AC boxes, parapets, rooftop tanks and solar-heater silhouettes. Nearby buildings cast shadows; asphalt/shoulder shading has procedural surface variation.
- A checked hero-route street kit: footpaths, covered drains, walls, gates, parked paired scooters, rickshaws, compact cars, utility equipment and carts. Original fictional focal structures use a replaceable landmark registry. No source road or footprint geometry was moved.
- Road-class/junction-aware worn center dashes, cosmetic repair patches and monsoon roadside puddles. Existing crossing/signal/bridge geometry is retained.
- More rickshaws and two-wheelers, improved curved silhouettes, motorcycle/delivery variants, bounded traffic counts of 8/11/14 on Low/Medium/High Normal traffic. Body meshes batch by material; actual model envelopes expand collision bounds conservatively.
- Baner Evening Drive and Monsoon Pashan Drive, earned progress/completion, smoothness evaluation, session discovery journal, and a stopped-car postcard interaction near the chai scene. Original Evening Chai Run remains available.
- Fixed stale queued chunks being activated after route restart/quality changes. Added a regression test and verified the Low-quality nine-chunk limit. Escape closes the postcard without opening Settings.
- A local-only preview server with a larger connection backlog for concurrent ES-module/browser-test requests.

## Files changed in this pass

New modules: `src/city/puneStyle.js`, `puneBuildings.js`, `puneEdges.js`, `puneEdgeView.js`, `puneDiscovery.js`, `puneLandmarks.js`.

Extended existing working-tree files: `src/city/cityWorld.js`, `cityActors.js`, `cityExperience.js`, `cityTripUI.js`, `cityVehicles.js`, `cityTraffic.js`, `cityTrafficRules.js`; `src/main.js`, `src/traffic.js`, `index.html`, `styles.css`, `package.json`.

New tooling/tests: `tools/serve.py`; `tests/real-pune.test.mjs`, `real-pune-capture.mjs`, `real-pune-discovery-browser.mjs`, `real-pune-keyboard-browser.mjs`. Updated `tests/pune-browser.mjs`, `pune-world.mjs`, `city-traffic.test.js`, `city-systems-browser.mjs`, and `city-journey-browser.mjs`. Added this report and `docs/real-pune.md`. Other dirty files listed by Git predate this pass.

## Provenance and limitations

New textures and geometry are original procedural assets embedded in source. No external models, imagery, logos, advertising or recorded audio were downloaded. Existing project licensing applies; OSM data remains ODbL with attribution intact. Fictional scenes and focal structures are labelled as such. Elevation is still explicitly synthetic. The existing licensed, offline DEM import interface is documented; no authoritative elevation or exact landmark reference was available.

This is a working visual/experience pass, **not completion of every item in the original art brief**. It remains stylized, and open land between imported footprints still looks sparse. Missing features include bicycle traffic, a distinct moving SUV, bus-stop dwell/shoulder-pull-in behaviour, a complete median/arrow/speed-breaker treatment, surveyed landmark replicas, richer new ambience, and continuous authored commercial frontages. Some architectural details are simplified geometry/texture approximations. Existing signal/traffic/audio systems were extended or retained, not all newly implemented here.

## Verification

Full command logs are under `tests/real-pune-validation/`. Browser suites use real Chrome via Playwright. The keyboard route used W/A/S/D automation with a 4x frame clock, not a human driving session, teleporting, or built-in auto-drive. The two discovery and original journey checks use accelerated frame clocks while retaining the game's fixed simulation steps. Their displayed `frameMs` must not be used as performance measurements.

| Command | Result |
|---|---|
| `npm test` | 18 passed, 0 failed |
| `npm run test:collisions` | 8 passed, 0 failed |
| `npm run test:city` | 10 passed, 0 failed |
| `npm run test:pune` | 9 passed, 0 failed |
| `npm run test:real-pune` | 4 passed, 0 failed |
| `npm run validate:pune` | Passed: 256 chunks, 5576 roads, 5331 buildings |
| `npm run test:ride:browser` | Passed at 30/60/90/120/144/165 Hz |
| `npm run test:collisions:browser` | Passed player/AI collision, recovery, disposal and keyboard checks |
| `npm run test:city:browser` | Passed trip start/restart, signals and mode switching |
| `npm run test:city:input` | Passed keyboard and multi-pointer touch paths |
| `npm run test:city:systems` | Passed queue/release, fleet budgets, disposal and audio checks |
| `npm run test:city:journey` | Passed complete original journey and three mode switches |
| `npm run test:pune:browser` | Passed seasons, controls, cameras, traffic and local request checks |
| `npm run test:pune:world` | Passed full loop, stable streaming resources and stale-queue regression |
| `npm run test:pune:deployment` | Passed packaged subdirectory and corrupt-chunk recovery |
| `npm run test:real-pune:browser` | Passed both drives, journal, postcard button/Escape, Low quality and no external requests |
| `npm run test:real-pune:keyboard` | Passed full 2600 m hero route using keyboard inputs |
| `npm run build` | Passed static site and ZIP creation |

The keyboard controller completed with two road departures, 17.1 seconds outside the road corridor, zero signal violations and an Eventful rating. Its repeated brake pulses produced 335 hard-brake events. This proves input/progression continuity, not a smooth human drive. Existing browser input checks separately cover brake-to-reverse, cameras, pause/resume, simultaneous touch steering/acceleration and pointer cleanup.

Initial validation exposed localhost connection refusals, an old test expectation of 3/7 cars, a comparison of differently advanced traffic views, and the stale-queue Low-quality defect. Final checks use the larger preview backlog, updated intended traffic counts, identical paused resource views, and the queue fix. Failures were investigated rather than treated as passing.

## Screenshots and resources

Before: `tests/real-pune-before/day.png`, `sunset.png`, `night.png`, `monsoon.png`.

Matching stationary after views: `tests/real-pune-after/day.png`, `sunset.png`, `night.png`, `monsoon.png`. Additional evidence: `postcard.png`, `baner-evening-arrival.png`, `monsoon-pashan-arrival.png`, `keyboard-arrival.png`; `tests/chai-mixed-traffic-red.png` and `chai-mixed-traffic-green.png` show the denser original vehicle mix. Captures are rendered game/browser output, not generated concept art.

Fresh unaccelerated Pune browser sample at 1440×900 Medium: median 11.1 ms, p95 12.9 ms. This is a local sample, not a cross-device guarantee. Three identical paused Pune → Endless → Pune views held at 259 GPU geometries, 27 textures, 16 audio nodes and 11 pooled/active traffic records. The systems test observed 215 registered vehicle resources disposed, 215 expected. The streamed full-loop test retained at most 25 chunks and repeated stable resource counts; Low remains limited to nine.

The highest-value next art step is a carefully authored commercial/residential frontage pass along this same route: continuous pavements, boundary transitions, believable ground-floor depth and clustered parking. That will address the remaining sparse, procedural appearance more effectively than adding more random vehicle types.


## 2026-09-28: bounded 200 m benchmark

Implemented road-clear pavement bays, driveway gaps, drainage and compound forecourts in loop interval 10,380–10,580 m; original local facade PNG on nearby buildings; deterministic tinted merged geometry; textured pavement/concrete; nearby static shop/wall shadow participation. Eight focused tests passed, including 86 accepted pavement bays. `tests/benchmark-browser.mjs` passed: facade loaded, 7 new shared texture disposal events, 8 pedestrians/6 shops, walking matrices and reduced-motion freeze, no page errors. `npm run test:city:input` passed keyboard and multi-pointer touch. Build includes 588 files. Packaged subdirectory, corrupt-chunk recovery and relative-asset test passed after adding the art directory to the build copier.

Preview: `tests/real-pune-after/benchmark-drive.png` uses the actual CameraRig and Environment in a static test fixture, with no player car or HUD. The earlier before image used different fixture lighting; do not describe it as a controlled lighting comparison. 251 draw calls is a fixture observation, not an FPS claim. Higher-quality character/tree models and broader street continuity remain open art work. No commit, push or public deployment.
