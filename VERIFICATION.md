# Verification results

Tested locally with Node 20.12 and installed Google Chrome in headless mode. Screenshots were inspected directly. The connected browser/computer-use surface was unavailable, so verification used a local browser test runner.

## Passing automated checks

- `npm test`: seven tests passed. Determinism, signed-distance and period-boundary continuity, nearest-road queries, a simulated **100+ km** auto-drive, both lane choices, manual override, Return to Road, brake/reverse separation, guardrail contact, four off-road surfaces, and 30/60/120 Hz comparisons.
- `npm run test:browser`: start screen; manual and auto driving; manual departure onto grass and recovery; four cameras; all four biomes and times; 0/3/7 traffic; paint/mute; quality/shadow settings; volume inputs; reduced motion; seed restart; pause/resume; 390×844 layout.
- Browser console: **zero errors and zero warnings**. Request capture: **zero remote runtime requests**.
- Auto-drive browser sample: about **204 m**, settled offset **1.894 m** in the 2 m right lane.
- Night: both player headlights reached about **177** intensity during the 3.3-second transition; screenshots show their pools of light on asphalt.
- Twelve biome selections returned to the same per-biome geometry and texture counts. Each retained **nine chunks**.
- `npm run test:systems`: five simulated minutes / **4.738 km** with seven traffic vehicles. Minimum same-lane spacing **32.9 m**; maximum settled player lane error **0.157 m**.
- Aster GT rendered bounding box: about **4.645 m long × 2.239 m wide including mirrors × 1.486 m high**.
- Thirty large world relocations through **46.4 km** retained nine chunks and **60 registered geometries** in the isolated Low-quality test. After world disposal, registered geometries and textures were **zero**.
- Source audit: no legacy game title, branded vehicle loader, decoder or remote runtime asset URL in application source.

## Visual observations

Road remained visible after correcting terrain clearance. Chase and wide cameras show the complete car; bumper is ahead of the body and does not intersect it. Canyon rails follow both edges around bends. Night maintains readable terrain, markings and headlights. Desert, Snow, Canyon and Meadow screenshots are distinct. Responsive settings stay within the narrow viewport.

## Scope of evidence

These tests are not a 60 FPS certification. A sampled Medium frame used roughly 160–165 draw calls and 206k–213k triangles with traffic off, but hardware-dependent frame pacing has not been characterized. Resource disposal tests do not replace a multi-hour heap profile. Touch input and the subjective audio mix need real-device testing. The 100 km drive was a simulation; the rendered browser driving test was much shorter. Further real-time manual driving through many bends remains an acceptance task.

Screenshots and machine-readable reports are generated under `tests/` by the browser scripts. They are ignored by Git so test runs do not create source changes.

## Natural vegetation follow-up

The new tree/grass pass was inspected in headless Chrome screenshots. The initial
Medium scene now reports roughly **189 draw calls and 878,000 triangles**
(including render passes), versus the simpler scene documented above. The added
leaf/branch/blade detail increases GPU work; no representative-device FPS claim
is made. Dense ground cover is culled by chunk distance and tree shadows remain
limited to nearby chunks.

The seven driving tests and the 30-relocation resource-disposal test pass after
this change. The isolated Low world remains at 60 geometries and two vegetation textures
across all relocations; disposal returns both counters to zero.

The subsequent refinement adds bark grain/bump detail, bent branch joints, finer
blades, and a 95-165 m grass fade. Hidden branch caps and nearly degenerate blade
faces were removed. `npm run test:environment` passes across all four biomes and
quality levels, including repeated biome resource checks, with no console errors
or warnings. A short 120-frame, 1440-900 headless Chrome sample measured:

| Quality | Median frame interval | 95th percentile | Rendered triangles |
| ------- | --------------------- | --------------- | ------------------ |
| Low     | 16.7 ms               | 16.8 ms         | 542,030            |
| Medium  | 16.7 ms               | 17.0 ms         | 878,004            |
| High    | 16.7 ms               | 33.5 ms         | 1,309,030          |

This stationary local sample is a useful comparison, not a hardware-independent
60 FPS guarantee or a long-driving benchmark. Medium remains the default.

## Car and cockpit follow-up

- `node tests/car.mjs`: F enters/exits cockpit; steering input moves the wheel;
  speed updates the instrument screen; recovery and night rendering pass with no
  console errors/warnings. Day, steering and night screenshots inspected.
- `node tests/car-model.mjs`: front/rear model screenshots inspected. Four
  create/render/dispose cycles including cockpit, dashboard and reflection maps
  return to the same renderer resource baseline (12 geometries / 1 texture,
  including the test floor and renderer internals).
- Seven driving tests, the systems suite and the four-camera browser suite pass.
- Static-body batching reduced the refined exterior scene from about 257 to
  **200 draw calls** (roughly 921k triangles at the initial Medium-quality scene).
  This is a rendering workload measurement, not a new device-wide FPS guarantee.
- No external runtime asset or manufacturer branding was introduced. New textures
  are generated by project code. Sky and mirror reflections are approximations.

## Pune pilot verification — 2026-09-19

This is a first playable imported-city foundation, not completion of all requested
Pune production phases. Phases 1 (audit), 2 (offline pipeline) and 4 (projection)
are complete. Phase 3 feature import supports the core graph/footprints/polygons;
unsupported line classes are counted explicitly. Basic implementations of roads,
terrain fallback, buildings, streaming, route, left-hand traffic, seasons and UI
are runnable. Full phase 5–16 acceptance remains incomplete as described below.

- `npm run validate:pune`: passed; 256 chunks, 5,576 road segments, 5,331 buildings,
  10,731 m connected directed route, largest JSON chunk 40,496 bytes.
- Offline repeatability: reimported into `tests/pune-reimport/`; all 518 generated
  referenced files (including gzip sidecars) matched byte-for-byte.
- `npm run test:pune`: 6/6 passed: projection round trips, legal directed route
  continuity/no immediate U-turns, full-loop auto, Return to Road, labelled DEM
  fallback and synthetic multipolygon-hole fixture.
- `npm test`: 7/7 existing driving tests passed, including 100 km endless auto.
- `npm run test:car`: cockpit, right-hand driver anchors, steering animation,
  instruments/reverse, mobile WANDERLANE title, exterior views and four car
  disposal cycles passed. Approved exterior preserved.
- `npm run test:pune:browser`: all four times, three traffic modes, manual input,
  auto, Return to Road, cockpit, 9 season changes, mode switching, responsive UI,
  attribution, local-only runtime requests; no warnings/errors/network failures.
- `npm run test:pune:world`: accelerated fixed-step simulation completed a full
  route with streamed chunks and building contacts (96,744 physics steps).
  Maximum distance to route centre 5.50 m. This indicates lane precision still
  needs refinement at tight junctions; it is not proof of ideal lane following.
  A separate 100-second traffic simulation with 7 vehicles had minimum measured
  centre spacing 8.98 m. This is not full-route intersection traffic acceptance.
- Streaming stayed at <=25 active chunks. Twelve repeated relocations/season
  switches returned to identical geometry/texture counts: 160/164 geometries
  by location, 9 textures in the isolated renderer. Disposal left 14 geometries
  and 2 textures owned by the test environment/renderer, not city chunks.
- Short 1440×900 Medium headless-Chrome frame sample: median 16.7 ms, p95 17.9 ms;
  initial rendered city ~234 calls / 416k triangles. No broad hardware/1080p
  guarantee or transition-stutter budget certification is claimed.
- `npm run test:pune:deployment`: generated `dist/` under a hosted subdirectory,
  relative asset resolution, attribution, corrupt-chunk error and recovery passed.
- Static ZIP built successfully with index.html at root, source database offer,
  metadata and locally served assets; about 3.4 MiB. No live deployment performed.

Visual review: inspected `tests/pune-day.png`, `pune-sunset.png`,
`pune-night.png`, `pune-monsoon.png`, `pune-dense.png`, and `pune-lake.png`.
Screenshots are locally generated and Git-ignored. Buildings use actual footprints
but simple repeated generic facades; night windows are restrained. Headlights
illuminate asphalt. Road network, dense housing, divided carriageways and Pashan
Lake read clearly. Intersection shoulder joins, sparse ground detail and generic
botany still have prototype fidelity. Lake is clipped by the finite pilot boundary.
A short manual steering test was performed; **the full route was not manually
traversed in real time**. Full-loop verification used accelerated simulation.

Known data caveats: 2 missing multipolygon boundary members are reported;
132 driveable segments lie outside the largest weakly connected component;
1,139 building footprints are omitted by conservative road/water overlap checks;
only 32 building heights are explicit. Railway/barrier/waterway lines and pedestrian
paths remain source-only. Complex relation restrictions, conditional access,
intersection signals, authored junction connectors, full building style/roof
variants, city skyline LOD, Pune species, detailed props, bridge collision and
surveyed terrain still require work. The DEM contract exists, but the bundled
terrain is deliberately synthetic and visibly labelled.

Next concrete stage: author and validate junction lane connectors on the Explorer
route, improve grade-separated nearest-road selection/collision, then ingest a
verified licensed DEM and rerun road/terrain alignment checks. After this pilot
passes those gates, extend west along the Pashan–Sus corridor toward Sus.

## Pune road continuation — 2026-09-23

Added 343 short cubic lane connectors along the existing 468-segment Explorer
route. Each connector is checked against the union of its two source road
corridors, with a car-width allowance; unsafe cuts fall back to the original
geometry. OSM roads/topology and the cached database were not modified. A bounded
2 m lane-guide spatial index gives auto-drive progress through curved connections.
Traffic also uses these lane samples, avoiding abrupt node-to-node headings.

Steering targets now use their actual distance. City auto-drive slows further
when its heading differs substantially from the target. The full simulated loop
with streamed building contacts completed in 99,315 steps, with maximum distance
to the route centre **3.68 m**, improved from 5.50 m. This is a centreline-distance
metric, not a guarantee of perfect lane centring at every junction.

Nearest-road queries use vehicle elevation and a small continuity preference,
so overlapping bridge and ground roads remain distinct. Return to Road uses the
same height-aware selection. Bridge rails now gently constrain and slow player
contact; vehicles underneath are unaffected. Synthetic crossing tests cover both
levels and both rail edges.

Traffic spawn candidates avoid actual connected junctions/signals, sharp bends,
nearby vehicles and the player, with a bounded active range. A vehicle waits out
of view when no safe candidate exists. Traffic signals are still not simulated.

Validation: 9 Pune unit/integration checks passed (including full loop, lane
connector continuity and bridge fixtures); 7 existing driving checks passed.
Rendered-world loop and 12 relocation/season cycles passed; active chunks remain
<=25 and memory returns to the same per-location counts (158/164 geometries,
9 textures in the isolated renderer). The 100-second traffic sample retained
minimum centre separation of 8.98 m. See the JSON results under tests/ for the
latest browser/world run. Full manual traversal and full-city traffic certification
remain outstanding; no real elevation dataset has been added.

Current stopping point: a playable imported-city pilot with improved junction
navigation and bridge contact. Next: verified licensed DEM ingestion and terrain
alignment, then signal/intersection right-of-way behavior and Pune-specific art.

## Driving, camera and city details — 2026-09-24

Baseline: the original 7 driving tests, 9 Pune tests and desktop/mobile browser
suite passed before the implementation. Added tests cover progressive steering,
reverse coasting/brake priority, simultaneous pointer ownership and cleanup,
continuous road-edge height, wheel-footprint pitch, park triangles, elevated approach contact,
large-delta substeps, deterministic prop placement, name validation and deduplication.

Browser verification uses installed Chrome and the local server. It exercises
18 controlled entry/exit runs at 5/18/35 m/s and 0.2/0.55/1.1 radians, steering
maneuvers at all three speeds, keyboard driving, four off-road camera views, and
real simultaneous touch contacts through Chrome's input protocol. Touch layouts
are captured at 390×844 and 844×390. The existing browser suites cover braking
into reverse, Return to Road, auto-drive, all biomes/cameras, reduced motion,
Pune day/sunset/night, settings and all quality levels. Screenshots were reviewed.

The artificial 8 cm rapid-height camera test reduced total vertical camera
travel to about 6.2% of the input travel with the final single-stage vertical filter; this measures high-frequency rejection,
not general camera latency. Longer off-road runs include natural hill slopes;
tests bound changes per step rather than expecting a level body on a hill.
All 18 final runs crossed between asphalt and off-road. Maximum body-height change
was 0.063 m per 1/60-second step, with maximum pitch change 0.0155 radians per step.

Pune's streamed full loop completed with a 3.68 m maximum route-centre distance
and <=25 active chunks. Twelve relocation/season cycles returned to identical
per-location resource counts: 178/193 geometries and 12/18 textures in the
isolated world test. The remaining 14 geometries/2 textures after world and car
disposal belong to the test's retained environment. Endless-world disposal
returned to zero geometries/textures. New sign atlases/materials are chunk-owned.

The Pune browser sample measured 11.2 ms median / 13.3 ms p95 frame intervals.
Environment quality samples measured 7.0/13.8/13.8 ms medians for Low/Medium/High.
These are local-machine samples, not a mobile hardware certification. No console
errors were reported. Street fixtures add zero dynamic lights; geometry is batched
by material and roadside trees share the existing instanced tree resources.

Commands: `npm test`, `npm run test:pune`, `npm run test:browser`,
`npm run test:improvements:browser`, `npm run test:systems`,
`npm run test:pune:world`, `npm run test:pune:browser`, `npm run test:car`,
`npm run test:environment`, `npm run build`, `npm run test:pune:deployment`.
JSON reports and screenshots are generated under `tests/` and remain git-ignored.

Limits: Pune elevation is still synthetic; complex imported junction geometry,
traffic signals and real-phone ergonomics need broader field testing. This is
lightweight ground-following suspension, not an airborne rigid-body simulation.

### Pune paved-road judder follow-up

The previous pass filtered terrain motion but missed a render-clock mismatch:
physics steps at 60 Hz were shown directly while the camera moved each display
frame. The 300-frame Pune driving sample repeated the physical car position on
131 frames. `VehiclePose` now interpolates position, heading, body attitude and
wheel contact between simulation ticks; the car, camera, environment anchors and
particles share that visual pose. Chase/wide cameras smooth their orbit rather
than separately delaying world translation. Collision and steering physics are
unchanged; interpolation adds at most one 16.7 ms tick of presentation latency.

`npm run test:ride:browser` verifies 30/60/90/120/144/165 Hz presentation, camera
screen stability, actual Pune driving, camera cycling and Return to Road. The
Pune sample now has zero repeated rendered positions. Unit regressions also cover
uneven display intervals, heading wrap, wheel contact, pause and teleport resets.
Reports are written to `tests/ride-results.json`; all browser console errors are
checked. These replace the earlier terrain-only checks as the smoothness test.
