# Implementation plan and status

The repository was inspected completely before changes: one HTML page, one stylesheet, README, and eleven JavaScript modules. There was no existing test/build system or licensed original vehicle asset.

Plan followed: replace vehicle/road/driving/cameras; connect bounded streamed scenery and atmosphere; add traffic, audio and UI; verify simulations and local browser rendering; document limitations. The final repository is playable with a static HTTP server.

## Phase status

| Phase                       | Status                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Playability             | Implemented: correctly scaled car, four cameras, road-centred spawn and heading, lane-following auto-drive, recovery, fixed-step physics and explicit DOM references.                                                                                                                                                       |
| 2 — Identity                | Implemented: Wanderlane title, wordmark, tagline, warm text, quiet panels, documentation and six-colour palette.                                                                                                                                                                                                             |
| 3 — Aster GT                | Implemented: original 4.645 m visible length, separated body/glass/trim/lights, four rotating wheels, front-wheel steering, geometric badge, paint and camera anchors.                                                                                                                                                      |
| 4 — Road coordinates/chunks | Implemented: seeded continuous route, all requested sampling APIs, limited active chunks, disposal, seed restart and player-anchored sky. Horizontal route pattern repeats; no claim of unique infinite terrain.                                                                                                            |
| 5 — Road/rails              | Core implemented: connected asphalt with subtle vertex colour variation, dashed centre line, solid edge lines, shoulders, contextual paired rails, posts, end caps, reflectors, chevrons and snow poles; basic contact response. Asphalt microtexture/roughness variation, kilometre markers and a broader sign set remain. |
| 6 — Environment             | First pass only: four distinct palettes, instanced tree silhouettes, grass/flowers/cacti/snow crowns, rocks, simple barns and distant hills/mesas. Detailed species, slope-aware material blending, layered canyon geology and richer clustered ecosystems remain.                                                          |
| 7 — Time/lighting           | Functional: smooth colour/intensity/exposure/fog transitions, stars/moon, clouds, readable night and real player headlight spotlights. Biome-specific lighting calibration remains.                                                                                                                                         |
| 8 — Traffic                 | Functional: pooled 0/3/7 fictional sedan/hatch/utility/van variants, same-direction and oncoming traffic, following, curve speeds, braking lights and gentle contact. Traffic headlights are emissive, without projected road illumination; no overtaking AI.                                                               |
| 9 — Handling                | Functional: smoothed throttle, braking, speed-sensitive steering, body motion, lower off-road grip/resistance, explicit reverse and collisions. Simplified kinematics rather than suspension/tyre simulation.                                                                                                               |
| 10 — Atmosphere/audio       | Functional baseline: crown wind, drifting clouds, dust/snow/fireflies, restrained engine/wind/road/ambient synthesis, mute and three volumes. No birds, heat haze or rich biome-specific soundscape.                                                                                                                        |
| 11 — UI/settings            | Implemented functional controls, local settings, loading/start, responsive layout and basic touch controls. Touch-device driving and audio comfort need real-device acceptance testing.                                                                                                                                     |
| 12 — Performance            | Core structural fixes and bounded-resource tests implemented. Representative hardware profiling, floating origin, incremental biome switching and richer near/far LOD remain.                                                                                                                                               |

**Exact fully completed phase: 4.** Phase 5 has a playable implementation but remaining surface/furniture detail. Later phases also have working baselines; they are not all claimed complete.

**Next concrete phase: finish Phase 5** with locally generated asphalt roughness/microtexture and distance markers, then undertake the Phase 6 art pass: species-specific branched trees, clustered understory, slope-based terrain materials and layered canyon formations. Preserve the fixed-step physics and bounded streaming architecture during that work.

## Deliberate limits

- The art currently reads as clean low-poly stylization, not finished stylized realism. This is not described as commercially polished completion.
- No bridges, tunnels, arches, photo textures, external audio or external models were introduced.
- Traffic body silhouettes are simplified; collision is a forgiving geometric separation, not rigid-body physics. Traffic can stop for the player but does not plan overtakes.
- No floating origin or fully novel never-repeating route; sampled continuity was tested to very large distances, rendered precision was not.
- Chunk-count stability and released GPU resources are verified; that is not a full multi-hour JS heap/leak certification.
- Browser audio successfully starts after user input; its subjective mix still needs listening on real speakers/headphones.

## Follow-up: natural grass and trees

Implemented a focused vegetation pass after the first version: three shared
branched tree templates, original alpha-cutout leaf/needle sprays, grove-based
placement, varied lean and scale, instanced shrubs, curved grass blades,
terrain-matched roots, ground grain and patches, and wind-aware foliage shadows.
This advances Phase 6; it does not mark the remaining environment-art scope done.

## Follow-up: polished Aster GT and steering view

Rebuilt the original car with smooth coachwork, real wheel-well openings, separate
windows, roof framing, refined light housings, alloy rims/brakes, panel seams and
clear-coated paint with local sky reflections. Added `carGeometry.js` for shared
geometry/camera definitions and `cockpit.js` for the driver cabin. F selects the
steering view directly; C cycles all four views. The instrument display follows
speed and auto-drive state, and the steering wheel follows the live steering input.
Static body meshes are batched by material to keep draw-call growth small.

### WANDERLANE cabin and identity update

Rebranded UI, metadata, documentation, package identity and diagnostic API to
WANDERLANE / `window.wanderlane`. The previous storage key is read only for
preference migration. Cockpit geometry and camera now use right-hand drive.
Static cabin parts are batched by material, shared leather bump texture is
generated once, and instrument textures redraw only when displayed state changes.

### Pune pilot architecture and stopping point

Pune retains the shared car, right-hand cockpit, camera, audio, input and four-time
lighting. A separate CityPath adapts a directed OSM graph to vehicle sampling;
CityWorld streams square 256 m tiles by X/Z, not endless distance. Shared materials
and per-tile merged geometry keep buildings/windows inexpensive. CityTraffic
reuses original generic vehicles and follows the curated forward route. The
finite boundary returns the driver to the Explorer route. City-specific low-speed
steering and conservative cruise speed do not change endless physics defaults.

The Node offline importer has no new dependencies. Original OSM API exports were
converted once with Python stdlib and cached as gzip JSON. Importing thereafter
is entirely offline and deterministic. Production parses only processed navigation
and nearby chunks. Source and modified database remain ODbL, independently of
CC0 procedural art. Source queries, bounds, checksum and fallback rules are
recorded. Synthetic elevation is labelled throughout and can be replaced by the
licensed-grid importer contract.

Completed stopping point: first playable pilot foundation. It is not a complete
implementation of every requested city phase; see VERIFICATION.md for exact
coverage, results and next acceptance stage.

### Pune junction and bridge continuation

`src/city/laneConnectors.js` generates short, corridor-checked cubic connections
without altering OSM topology. `CityPath` has a bounded lane-guide lookup and
height-aware nearest-road queries. Bridge rail response is independent of the
endless-road rail constant. City auto slows for heading error; manual and endless
handling retain their previous behavior apart from the shared optional road hook.
Pune traffic spawning uses actual graph junction degree and mapped signal nodes,
with spatial checks and a safe hidden retry instead of forcing an invalid spawn.
