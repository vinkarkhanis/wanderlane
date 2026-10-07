# Pune and western outskirts

The prepared OpenStreetMap map covers 73.745–73.834 E and 18.508–18.588 N, approximately 9.4 × 8.9 km (84 km²), compared with the original 4 × 4 km slice. It has 1,332 streamed chunks, 23,202 public-road segments, 22,733 building footprints and 4,194 pedestrian-path segments. This is a finite map, not all of Pune.

Open Settings → Drive Mode → Pune & outskirts → Pune Route:

- Baner–Pashan Explorer retains the original journeys and detour.
- Sus–Pashan Hill Roads: 11.9 km through source-backed Sus Road and Pashan-Sus Road.
- Bavdhan Outskirts: 12.8 km through Pashan-Bavdhan Road, Aditya Shagun Road and Bavdhan Gaon Road.
- Aundh & Baner City Loop: 10.1 km through Aundh-Baner Road and the northern road network.

The new loops support manual driving, auto-drive, garage vehicles, traffic, seasons, flight and the nearby-road map. They are free-roam loops; the destination challenges and postcards remain on the original route. Route selection is saved on the device. Switching areas stops auto-drive and resets the vehicle onto the chosen loop; it also ends an active original journey.

## Source and presentation

`data-sources/pune/osm-expansion.json.gz` is a bounded build-time Overpass extract merged with the original pilot snapshot. Original element versions are retained to preserve the existing 5,576 road records and curated route exactly. `pilot-navigation.json.gz` is the immutable baseline used during rebuilds. `expansion-metadata.json` documents the query, timestamp, checksum and merge. The downloadable database offer at `assets/cities/pune/source.osm.json.gz` now contains the merged source. OSM attribution and ODbL distribution files remain included. Gameplay fetches only bundled files, never OSM services.

OSM woodland, meadow, farmland, rock and water polygons guide ground surfaces. The expanded western hills are **synthetic elevations**, blended outside the preserved original slice, not measured Pune terrain. Building footprints and explicit heights/levels come from OSM; missing heights use a deterministic rule. Generic building façades, pavement dimensions and mall architecture are stylized original art, not exact real-world façades.

Five mapped shopping-centre buildings gain glass bands, stone trim and source-backed names, including Westend Mall and Aditya Shagun Mall. No logos or commercial photographs are used. Urban pavement panels are inferred beside mapped buildings, or enabled by explicit sidewalk tags; they stop at intersections, water, other roads and obstructing building bounds. Public footways, paths, cycleways and steps are decorative surfaces rather than vehicle routes. Buildings and road navigation retain their existing collision behavior; pavements do not add raised collision barriers.

Only nearby chunks are active: 9 on Low and 25 on Medium/High on the ground. Static street elements are batched; pavement panels have per-chunk quality budgets. Mall sign textures belong to their owning chunks and are disposed on unload. Flight keeps the existing wider streaming radius.

## Rebuild and verification

`npm run fetch:pune:expansion` downloads a fresh bounded extract; normal rebuilding needs no network. `npm run import:pune` rebuilds the expansion from its cache. `npm run import:pune:pilot` explicitly rebuilds the smaller original slice instead. `npm run validate:pune` checks all chunks and the preserved route. `npm run build:site` packages only current manifest files.

`npm run test:pune:expansion` checks exact original-route preservation, connected legal exploration loops, complete pickup laps, land-use classes, imported paths, shopping centres and pavement budgets. `npm run test:pune:expansion:browser` checks all new selectors, keyboard driving, auto-drive, saved selection, original journey availability and real CDP multi-touch. `node tests/pune-expansion-views.mjs` renders production scenery from inspection positions and checks browser errors/disposal; these images are visual fixtures, not gameplay recordings.

This expansion is implemented locally. No deployment is performed by these import or test commands.
