# Pune driving slice — implementation and validation

## Outcome

Evening Chai Run is playable through the existing Start screen and the new
Start drive button. It is a 5.98 km directed journey with manual or auto-drive,
four objectives, bilingual road guidance, elapsed time, driving-quality results,
Drive again and Free roam. The live browser journey completed twice, crossed
the route seam, encountered all eight authored scenes, and returned a Smooth
result with no red-light violations. The latest recorded trip took 15m 55s of
simulation time.

The start is on the curated route about 296 m east of mapped Baner High Street.
The destination is on Pashan–Sus Road, about 765 m from the nearest mapped lake
shore. It is labelled **lake approach**, not a lake entrance or shoreline.

## Content and architecture

- `CityExperience` owns trip definitions, state, ordered objectives, monotonic
  earned progress, departure time, manual hard-braking events, red crossings,
  encounters and copied debug snapshots. It has no timers or scene references.
- `CitySignals` projects imported nodes to three directed route approaches.
  Original deterministic cycles use 18 s green, 3 s amber and 15 s red, offset
  by source ID. `CitySignalView` provides streamed poles, bright lamps and stop
  lines. These simplified timings are not claimed to match Pune's controllers.
- `CityTraffic` handles following, safe spawning and red-light stops. Its
  factory creates hatchbacks, three-wheelers, helmeted scooters and compact
  buses; different dimensions and acceleration feed the queue rules.
- `CityActors` merges static scene pieces into chunk geometry and instances
  bounded people. `puneStreetDetails` holds independently validated anchors.
- `CityWorld` loads and unloads resources; `main` binds the systems and UI.
  Audio remains a fixed synthesized Web Audio graph unlocked by a gesture.

Objectives: leave Baner via Pancard Club Road; pass the Baner–Pashan Link Road
junction; enter Park Ridge Road; arrive at the Pashan–Sus Road lake approach.

District treatments: Baner chai/shop awnings, parked scooters and a parked
three-wheeler; Baner Road shelters, waiting people and shoulder works; Pashan
garden compounds, planted railings and an arrival chai stall. Props include
utility posts/cables, counters, benches, planters and bilingual signs.
The evening chai crowd and pulsing amber shoulder-work scene are safe,
deterministic moments. Decorative motion reduces with quality/reduced motion.

City audio adds a filtered traffic/crowd bed, low large-vehicle presence,
scooter texture, sparse low-volume horn pulses, quieter bird-like tones and a
monsoon noise layer. Speed, zone, evening light and season change the mix.
No external audio, textures, models, logos or runtime map services were added.

## Changed files

| File | Purpose |
| --- | --- |
| `index.html` | Accessible journey panel and controls |
| `styles.css` | Desktop, portrait and short-landscape trip layout |
| `package.json` | Focused city test commands |
| `src/main.js` | System lifecycle, trip actions, HUD/audio/debug integration, traffic preference persistence |
| `src/audio.js` | Fixed city audio layer, smooth gains, failure guard and node accounting |
| `src/traffic.js` | Overridable vehicle factory; existing Endless behavior retained |
| `src/city/cityTraffic.js` | Mixed city fleet, bounds-aware spacing, signal stops and safe spawning |
| `src/city/cityWorld.js` | Chunk-owned signal/actor integration and cleanup |
| `src/city/cityExperience.js` | Trip state, progress, scoring, reset and snapshots |
| `src/city/cityTripUI.js` | Text-only DOM binding and journey/summary presentation |
| `src/city/citySignals.js` | Source-node selection, phases, stop limits and crossing detection |
| `src/city/citySignalView.js` | Shared signal meshes/materials and stop lines |
| `src/city/cityTrafficRules.js` | Pure deterministic fleet specs and following gap |
| `src/city/cityVehicles.js` | Original procedural vehicle silhouettes and bounds |
| `src/city/puneStreetDetails.js` | Eight authored scene anchors, budgets and clearance validation |
| `src/city/cityActors.js` | Chunk-merged props, instanced figures, decorative moments and signage |
| `tests/city-experience.test.js` | Seam, progress, objective, scoring, reset/disposal tests |
| `tests/city-signals.test.js` | Phase durations, stop limits, crossing deduplication and spatial guards |
| `tests/city-streets.test.js` | Every anchor's clearance, budgets and Unicode sanitization |
| `tests/city-traffic.test.js` | Fleet composition, relative bounds and following rules |
| `tests/city-experience-browser.mjs` | Visible trip launch, driving, red/green queue integration and mode switching |
| `tests/city-journey-browser.mjs` | Full live journey, encounters, summary, restart and resource cycles |
| `tests/city-input-browser.mjs` | Keyboard and simultaneous touch regressions, responsive screenshots |
| `tests/city-systems-browser.mjs` | Mixed-fleet render fixture, spawning/bounds, disposal and audio gain checks |
| `docs/pune-experience.md` | Map evidence, placement rationale and design boundaries |
| `docs/pune-slice-report.md` | This implementation/validation report |

Generated build output is ignored: `dist/`, `dist-files.json` and
`wanderlane-pune.zip`. Screenshots/results stay in the existing ignored
`tests/*.png` and `tests/*-results.json` locations. No generated source chunks,
OSM source files, database licenses or attribution were changed.

## Tests

| Command | Result |
| --- | --- |
| `npm test` | PASS — 18 tests |
| `npm run test:pune` | PASS — 9 tests, full route and grade separation |
| `npm run test:pune:world` | PASS — full lap, traffic, streaming and repeated resource checks |
| `npm run test:systems` | PASS |
| `npm run test:car` | PASS — both car scripts |
| `npm run test:environment` | PASS |
| `npm run build` | PASS — static site and upload ZIP |
| `npm run test:pune:browser` | PASS — Pune controls, seasons, performance and mode switching |
| `npm run test:browser` | PASS — Endless and touch regression |
| `npm run test:improvements:browser` | PASS |
| `npm run test:ride:browser` | PASS — 30–165 Hz interpolation and browser drive |
| `npm run test:pune:deployment` | PASS — packaged subdirectory, relative assets, corrupt-chunk recovery |
| `npm run test:city` | PASS — 10 focused tests |
| `npm run test:city:browser` | PASS — also invoked directly with `node tests/city-experience-browser.mjs` |
| `npm run test:city:journey` | PASS — also invoked directly with `node tests/city-journey-browser.mjs` |
| `npm run test:city:input` | PASS — also invoked directly with `node tests/city-input-browser.mjs` |
| `npm run test:city:systems` | PASS — also invoked directly with `node tests/city-systems-browser.mjs` |

No requested script was skipped, and no existing assertion was weakened.
The first baseline browser attempt failed because the server was not ready;
the subsequent baseline passed. Later city-script attempts intermittently
timed out during startup. Diagnostic loading and reruns passed without page
errors; those failed attempts are not counted as successful validation.
One intermediate screenshot was rejected because the settings dialog obscured
the fixture; it was recaptured and visually inspected.

## Browser evidence

Actual installed Chrome rendered the game, using Playwright mouse/keyboard
and CDP multi-touch events. The interactive browser connector exposed no
available browsers. The full trip used 10x requestAnimationFrame timestamps
to shorten wall time, while the production loop retained its delta cap and
executed every fixed 1/60 physics step. It used the visible Start, Start drive,
traffic and auto-drive controls; no vehicle teleports or mutable game hooks
were used to finish the journey. The red/green close-ups use a separately
staged, rendered integration fixture on the actual imported junction.

Keyboard: W/ArrowUp, A/D/arrow steering, lowercase s/ArrowDown brake-reverse,
B reverse, Space auto-drive, H Return to Road, C/F cameras, G traffic, M mute,
Escape/settings. Touch: 390×844 simultaneous throttle with both steering
directions, brake/reverse, pointer cancel, blur and visibility event cleanup,
settings/restart, plus 844×390 landscape overlap checks. Attribution remains
visible in the real gameplay screenshots.

The queue test stopped the lead car about 3.11 m before the stop boundary
(1.99 m half-length plus more than 1 m clearance), maintained at least 2 m
bumper gaps even in a 2-second catch-up update, and resumed on green. It
observed disposal of all 56 tracked traffic geometries, instance resources and
materials. The final successful browser runs recorded no page/console errors.

Screenshots, inspected rather than merely generated:

| Path | Evidence |
| --- | --- |
| `tests/chai-baner-sunset.png` | Real trip start, sunset HUD and source-backed Baner area |
| `tests/chai-start.png` | Close roadside chai stall and crowd during live driving |
| `tests/chai-street-life.png` | Authored Baner shop scene ahead on the route |
| `tests/chai-roadworks.png` | Shoulder-work moment encountered during the trip |
| `tests/chai-signal-queue.png` | Signalized junction approached during the live trip |
| `tests/chai-mixed-traffic-red.png` | Staged close-up of all four vehicle types queued at red |
| `tests/chai-mixed-traffic-green.png` | Same fixture after green, showing lead vehicles departing |
| `tests/chai-arrival.png` | Completed journey, elapsed time, quality and replay/free-roam controls |
| `tests/chai-mobile-portrait.png` | Touch HUD and controls at 390×844 |
| `tests/chai-mobile-landscape.png` | Short landscape layout at 844×390 |

## Performance and resource limits

Measured at 1440×900, DPR 1, Medium on this machine:

| Sample | Median | p95 |
| --- | ---: | ---: |
| Pre-change `test:pune:browser` | 10.9 ms | 13.7 ms |
| After-change same browser sample | 10.4 ms | 12.3 ms |
| Active Chai Run, Normal traffic, 300 frames | 10.1 ms | 12.8 ms |

These samples meet 33.3 ms and show no measured regression. They are short
local samples, not a guarantee for every device. An earlier environment run
under concurrent test load produced higher timings; the table uses the
isolated comparison and the active-trip sample.

Traffic stays at 0/3/7. There are eight authored scenes and three signal
approaches, with 1/3/4 people per populated scene at Low/Medium/High (garden
scenes use one), bounded above by 32 globally and fewer with streaming.
Static details merge by material, signals share resources, and decorative
animation updates at 12 Hz near the player. Medium retains at most 25 chunks.

Three repeated Pune/Endless round trips returned to exactly 196 geometries,
14 textures, six people and 16 audio nodes at the same spawn. The existing
world test alternated streamed locations repeatedly with identical returning
counts. City audio allocates no per-frame sources. Gain measurements verified
mode fade-out, pause, mute and engine/ambience controls. This was a graph/gain
check, not a subjective speaker/headphone listening review.

## Known boundaries and Git

- Lake approach only: the curated route never reaches the lake shore/entrance.
- Existing synthetic terrain and repeated base buildings remain; this adds
  bounded district scenes, not a surveyed reconstruction of Pune.
- Signals control only the curated directed traffic approaches. There is no
  cross-traffic junction simulation, real timing claim or unrestricted walking.
- Missing objectives after a shortcut may require returning to the checkpoint;
  the controller deliberately does not invent GPS rerouting or shortcut credit.
- No collision score is claimed. Quality uses manual hard braking, time outside
  the road corridor and validated red-light crossings.

The starting working tree was clean. The resulting changes are local working
tree modifications/new files listed above. Nothing was committed or pushed.
