# WANDERLANE

_Take the long way._

A peaceful browser driving game featuring the original fictional **Aster GT**. Drive manually or follow the road automatically through Meadow, Desert, Snow and Canyon, under Dawn, Day, Sunset or Night skies.

This is a playable procedural first pass, not a finished commercial release. The driving and streaming foundation is implemented; environment art still needs the next substantial refinement pass. See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the exact scope and remaining work.

## Run

From this directory:

```sh
python -m http.server 8123 --bind 127.0.0.1
```

Open **http://127.0.0.1:8123** and select **Begin your drive**. Python 3 and a modern WebGL-capable browser are sufficient. There is no build step, npm installation requirement, CDN dependency, remote vehicle model, external font, analytics or downloaded audio at runtime. Do not open `index.html` directly with `file://`.

## Controls

| Action                                | Keyboard              |
| ------------------------------------- | --------------------- |
| Accelerate                            | W / Up                |
| Brake (does not engage reverse)       | S / Down              |
| Steer                                 | A / D or Left / Right |
| Reverse                               | Hold B                |
| Manual / auto-drive                   | Space                 |
| Chase / bumper / wide chase / cockpit | C                     |
| Meadow / Desert / Snow / Canyon       | R                     |
| Dawn / Day / Sunset / Night           | T                     |
| Cockpit / chase shortcut              | F                     |
| Paint palette                         | V                     |
| Off / Light / Normal traffic          | G                     |
| Return to Road                        | H                     |
| Mute                                  | M                     |
| Pause / settings                      | Escape / P            |

The toolbar exposes the main actions. Touch devices get steering, braking and acceleration buttons. Settings include quality, shadows, traffic, three volume sliders, reduced motion, auto-drive lane and route seed. Settings persist locally where storage is available. Change the seed and press **Restart with this seed** to reset the journey. No data is sent anywhere.

Auto-drive follows the selected lane, slows for curves and traffic, and yields temporarily to manual steering. Braking always takes priority. Return to Road stops the vehicle and places it on the nearest road in the selected lane. Start position is the centre of the road. Traffic uses right-hand travel; selecting the left lane intentionally puts auto-drive in the oncoming lane.

## Architecture

- `src/config.js` — metre/second/radian tuning, quality budgets and paint palette.
- `src/roadPath.js` — seeded, arc-length road sampling; tangent, normal, height, curvature, lanes and nearest-point lookup.
- `src/roadChunk.js` — connected asphalt, markings, shoulders, instanced rails/posts/reflectors and chevrons.
- `src/worldManager.js` — bounded chunk lifetime, shared resources, instancing and disposal.
- `src/vegetation.js` - original branched trees, leaf/needle artwork, curved grass and ground-detail shaders.
- `src/biomes.js`, `src/scenery.js`, `src/heightfield.js` — biome palettes, terrain and deterministic scenery.
- `src/car.js`, `src/carGeometry.js` — smooth Aster GT coachwork, wheel arches, glossy paint/reflections, lights, wheels and batched static trim.
- `src/cockpit.js` — driver cabin, animated steering wheel and live instrument display.
- `src/vehicle.js`, `src/camera.js` — fixed-step handling, lane following, surfaces, recovery and camera rigs.
- `src/traffic.js`, `src/trafficCar.js` — pooled fictional traffic, following, recycling and forgiving contact.
- `src/environment.js`, `src/particles.js` — blended time presets, player-anchored sky, stars, moon, clouds and local particles.
- `src/audio.js` — user-gesture-gated procedural Web Audio.
- `src/controls.js`, `src/settings.js`, `src/main.js` — input, persistence, UI and orchestration.

`road.js` and `terrain.js` are small compatibility re-exports. Three.js r160 is vendored in `vendor/`; its MIT licence is retained.

## Route and performance

The route streams in both directions without a terminal road end. Its horizontal harmonic pattern repeats every **32.768 km**; seed changes alter its phases. A monotonic longitudinal coordinate avoids self-intersections. This is not an assertion of literally infinite unique scenery. Very large world coordinates can eventually lose GPU precision; floating-origin rendering is not implemented.

Nine 160 m chunks are retained (current, two behind, six ahead). Normal movement builds at most one missing chunk per rendered frame. Terrain vertices and normals are computed on chunk creation, never per frame. Nearest-road lookup uses a fixed 8,193-entry table and local refinement. Trees, grass, road furniture and distant landforms use instancing. Traffic is pooled and capped at 0 / 3 / 7 vehicles. Distant scenery uses simplified geometry; shadows are limited to nearby crowns and the hero car. DPR caps: Low 1, Medium 1.5, High 2.

Biome and quality changes rebuild the nine active chunks synchronously while the route stays in place; a short hitch is possible. Low quality and shadows Off are the starting point for weaker devices. The 60 FPS desktop target has **not** been certified by a representative hardware benchmark.

## Verification

Optional development tools need Node 20+:

```sh
npm ci
npm test
# Keep the Python server running, with Google Chrome installed:
npm run test:browser
npm run test:systems
npm run test:environment
```

The browser tests use installed Chrome via Playwright. No browser download is needed. See [VERIFICATION.md](VERIFICATION.md) for measured results and coverage limits. Screenshots and JSON reports are written under `tests/` by the browser scripts. `window.wanderlane.state` provides read-only local diagnostics.

## Assets

Vehicle geometry, original scenic art, signs, sky reflections and audio are generated locally. Pune geographic structure is derived from the separately licensed OpenStreetMap database. No third-party 3D art or sound assets are used. See [ASSETS.md](ASSETS.md) for provenance and licensing, including the retained Three.js notice.

## Environment update

The roadside now uses branched trees with cutout leaf sprays, slender birch-style
forms, conifers in Snow, and lower scrub in Canyon. Trees grow in uneven groves;
short and tall curved grass tufts, shrubs and small flowers break up the verge.
Roots follow the actual terrain triangles. Ground colour has procedural patch
and grain detail, and leaves and grass move subtly in the wind. Bark has local grain/bump detail, branches bend at their joints, and grass gradually recedes from 95 to 165 metres.

Vegetation remains local, deterministic and instanced. Dense ground cover is
restricted to the current and neighbouring chunks. Low/Medium/High grass budgets
are 1,000/2,200/3,600 placement attempts per chunk, with biome/patch thinning.
This is a substantial vegetation upgrade; distant landforms and buildings still
retain the simpler first-version style.

## Aster GT refinement and cockpit

The hero car now has smoothly sculpted panels and wheel arches, framed glazing,
a crowned roof, alloy wheels and brake hardware, panel seams, flush handles,
inset light housings and an original rear identifier. Clear-coated metallic paint
uses a locally generated sky-reflection map. No external model or texture was added.

Press **F** for the driver/steering view (F again returns to Chase), or press **C**
to cycle Chase, Bumper, Wide chase and Cockpit. The cockpit includes a rotating
steering wheel, digital speed and auto-drive indicator, dashboard, vents, cabin
trim and roof lining. Its camera follows the cabin transform; reduced motion
suppresses visual roll/squat. The forward windscreen is hidden in cockpit mode
to keep road visibility clear. Reflections are baked sky approximations, not
live scene reflections; side mirrors do not display a rear-facing camera.

## WANDERLANE cockpit update

**Take the long way.** The Aster GT now has a right-hand-drive cockpit: the
driver camera, animated leather steering wheel and instruments share the right
seat position. A stitched padded dashboard, horizontal vents, satin trim and
a restrained centre display refine the cabin. Instruments show live speed,
drive/reverse and manual/auto status; decorative cabin buttons are not interactive.
Exterior styling is unchanged. Existing saved preferences migrate on first load.

## Real Routes → Pune (first playable pilot)

Settings → **Drive Mode → Pune City** selects the Baner–Aundh–Pashan region.
Endless Drive and all its biomes remain available. Pune uses Summer, Monsoon
and Winter palettes, the four existing times, and left-hand route traffic.
The 10.7 km Baner–Pashan Explorer loop follows connected OSM roads; auto-drive
uses the loop, while manual driving and Return to Road use the public network.
Pune has a finite boundary and **synthetic, visibly labelled elevation** pending
a licensed DEM. It is not a reconstruction of the entire city.

Map data © OpenStreetMap contributors, available under ODbL 1.0.
[OpenStreetMap copyright](https://www.openstreetmap.org/copyright).
Source: four OSM API exports, retrieved 2026-09-19, bounds 18.534–18.570 N,
73.772–73.810 E. The modified geographic database is distributed under ODbL.
[Sources, exact queries and DEM contract](data-sources/README.md).

```
npm run import:pune
npm run validate:pune
npm run test:pune
node tests/pune-browser.mjs
npm run serve
npm run build
```

Import is offline and deterministic from the committed gzip source snapshot.
Build produces `dist/` and `wanderlane-pune.zip`; see [DEPLOYMENT.md](DEPLOYMENT.md).
No build is required for local play.

Main additions: `tools/import-pune.mjs`, `tools/lib/*`, `src/city/cityPath.js`,
`cityWorld.js`, `cityTraffic.js`, shared projection/spatial utilities, and
`assets/cities/pune/*`. 256 square tiles stream a 3×3 (Low) or 5×5 (Medium/High)
ring. Buildings batch by shared facade; windows use one texture, not separate
meshes. Seasons recolor shared materials without rebuilding geometry.

Completed foundation: offline import/provenance, projection, public road graph,
footprints, generated buildings, chunk streaming and a playable route prototype.
Next acceptance stage: review junction lane connectors, full route collision and
traffic behavior, then replace synthetic terrain with a verified DEM. Signals
are imported but not simulated; city traffic is forward-route-only. Complex
interchanges, full building-style library, distant skyline LOD, Pune-specific
botany and street furniture remain incomplete. See deployment limitations.

Pune road update: short curved lane connectors improve junction targets, and
nearest-road/Return to Road preserve bridge elevation. Bridge rail contact slows
and gently contains the car. A streamed full-loop test measured 3.68 m maximum
route-centre deviation (previously 5.50 m); further lane and intersection review
is still needed. See [VERIFICATION.md](VERIFICATION.md) for current results.
