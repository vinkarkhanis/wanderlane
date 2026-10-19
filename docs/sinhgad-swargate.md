# Sinhgad Road–Swargate drive

Added locally on 19 October 2026. Select **Settings → Drive Mode → Pune & outskirts → Pune Route → Sinhgad Road–Swargate**.

The 12,194 m closed exploration loop uses 390 directed road segments through mapped Sinhagad Road / flyover, Dandekar Bridge, the Swargate bus-station approach and Parvati-side streets. The loop starts on the station approach so the landmark appears early in the drive. It supports the existing manual controls, auto-drive, vehicles, traffic and seasons. Existing destination challenges remain on the original Baner–Pashan route.

The southern source extract is bundled offline, with its query, timestamp and checksum in `data-sources/pune/expansion-metadata.json`. The original 23,202 western road records and all three existing exploration loops are preserved exactly, using `data-sources/pune/western-navigation.json.gz` as the rebuild baseline. Buildings are stylized, terrain is synthetic, and flyover heights are simplified. This route does not extend to Sinhagad Fort.

## Swargate bus station and road detail

The original procedural scene is located at the mapped MSRTC bus stand (source ways 817474247 and 817474249). It includes a large yellow Marathi/English name board, a long low canopy, platform numbers, six off-road buses, ticket windows, benches, luggage and 26 waiting passengers on Medium/High (12 on Low). The forecourt follows the synthetic terrain and is clipped around public-road corridors, leaving the mapped entrance ramp intact; it is excluded from generic trees, frontage walls and overlapping generic buildings. A BUS marker appears on the nearby-road map.

Visual references: [Swargate bus stand, Wikimedia Commons photograph from 2012](https://commons.wikimedia.org/wiki/File:Swargate_bus_stand.JPG), and [Free Press Journal photo report from June 2025](https://www.freepressjournal.in/pune/punes-swargate-st-stand-in-shambles-leaks-cracks-no-relief-in-sight-photos). The identifiable yellow sign, canopy and bus-bay arrangement guide the scene; this is an approximation, not a survey of the current terminal. Reference photographs are not redistributed as game textures. Sign art, buses, buildings and passengers are generated locally.

Road additions include divided-carriageway lane paint, edge lines, approach stop lines and zebra crossings, black/yellow arterial curbs, fewer freestanding compound walls, urban retaining edges near the terminal, concrete flyover parapets and piers placed clear of lower road corridors. These are decorative and do not change source road widths, centre lines or existing handling.

## Verification

- Map validation: 2,499 chunks, 40,781 road segments and 40,456 building footprints; passed.
- `test:swargate`: station/source placement, six off-road buses, lane-paint bounds, station-approach start, forecourt clearance, flyover support clearance, and a full simulated truck lap. Existing western-road and exploration-route preservation is covered by the expansion suite.
- Driving, ride, vehicle feel, Pune journey, flower delivery and scene regressions: 34/34 passed.
- Real-Pune suite: 15/15 passed.
- Chrome: all four route selectors, keyboard driving, auto-drive progress, saved southern selection after reload, original Monsoon Pashan journey startup, and simultaneous accelerator/steering touch input passed; no browser errors.
- Production-world visual checks: flyover, Swargate terminal and Parvati-side street rendered with no browser errors. These are inspection views, not full-trip gameplay recordings.
- `test:swargate:browser` passed a 1.24 km drive through the station approach in the actual game, including the public-road curve beside the forecourt. Reports and driving-camera screenshots are saved in `output/swargate-station/`.
- Cached import rebuilt successfully; unchanged output files are retained in place. `npm run build:site` packages the active map and scene modules.

Browser evidence is under `output/map-expansion/`: `browser-report.json`, `views-report.json`, `sinhgad-swargate-ui.png`, `sinhgad-swargate-touch.png`, `sinhgad-flyover-view.png`, `swargate-terminal-view.png` and `parvati-streets-view.png`. Full-lap validation is simulated; real-time Chrome tests cover the station approach plus a short portion of each other exploration route.

Cloudflare publishes this game from `feature/real-pune` at [Wanderlane](https://wanderlane.karkhanisvinayak.workers.dev/). Release hash checks are saved in `output/swargate-promo/deployment-report.json`; live route, station, keyboard and touch checks are saved in `output/swargate-live/browser-report.json` after they pass.
