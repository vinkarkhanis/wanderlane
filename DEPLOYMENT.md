# Static deployment — WANDERLANE

## Local run and import

```
npm install
npm run import:pune
npm run validate:pune
npm run serve
```

Open http://127.0.0.1:8123. Begin driving, open Settings, choose Drive Mode →
Pune City. Import is offline using the committed gzip OSM snapshot. Python 3 is
needed for the convenience HTTP server and ZIP packaging; Node is needed only
for development/import, never by the production site.

## Package

```
npm run build
```

`dist/` is a static site; `wanderlane-pune.zip` contains index.html at its root,
local Three.js, game modules, referenced Pune chunks, provenance and the source
database offer. The build has an explicit file list and checks the 25 MiB limit.
It does not require a frontend bundler or server. Re-import before building after
changing importer configuration. Gzip sidecars are generated; plain JSON remains
available because itch.io does not guarantee custom Content-Encoding handling.
Cloudflare/host HTTP compression can compress JSON automatically.

Cloudflare Pages: build command `npm run build`, output `dist`. The build needs
Node and Python 3. `_headers` makes hashed chunks immutable; index.html and the
mutable manifest must revalidate. Do not add a catch-all immutable cache rule.
No deployment has been performed by this implementation.

itch.io: upload `wanderlane-pune.zip` as an HTML project and select “This file will
be played in the browser”. All gameplay paths are relative and support hosted
subdirectories. Keep the attribution link visible in the embedded frame.

## Geographic licence / credits

**Map data © OpenStreetMap contributors, available under ODbL 1.0.**
[OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

Pune chunks/navigation are a modified ODbL geographic database; distribute
`assets/cities/pune/DATABASE-LICENSE.txt`, `attribution.json`, and the downloadable
`source.osm.json.gz` offer with the game. Do not apply the art CC0 note to OSM data.
See [data-sources/README.md](data-sources/README.md) for exact bounds and processing.
Current terrain is explicitly synthetic; no actual Pune DEM has been bundled.

## Pilot limitations

This first playable pilot is not a fully accepted city release. Junction lane
connectors and collision behavior need further road-by-road review. Signal nodes
are imported but signal-controlled traffic is not implemented. Traffic follows
only the curated route, in the forward direction; no city-wide traffic routing or
oncoming vehicles yet. Bridge grades are approximations, tunnels are not present
in this snapshot, and complex interchanges need manual review. Distant skyline
LOD, authored Pune tree species, street furniture and detailed building variants
remain next-stage work. OSM coverage and inferred footprints/heights are uneven.
No 60 FPS guarantee or complete manual traversal is claimed.
