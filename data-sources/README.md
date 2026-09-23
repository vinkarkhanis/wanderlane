# Pune data sources

Map data © OpenStreetMap contributors, available under ODbL 1.0.
[OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

This is the first **Baner–Aundh–Pashan pilot**, not all Pune. Bounds are
73.772–73.810° E, 18.534–18.570° N (about 4.0 × 4.0 km). The polygon is in
[pune/bounds.geojson](pune/bounds.geojson). Pashan Lake is included; Sus itself
lies beyond the pilot, with the Pashan–Sus approach represented.

The source was retrieved on 2026-09-19 UTC. Three Overpass endpoints failed;
a single OSM API export exceeded its 50,000-node limit. Four adjoining API
exports succeeded. Exact URLs, retrieval timestamp and decompressed snapshot
SHA-256 are in [pune/source-metadata.json](pune/source-metadata.json).
`pune/query.overpassql` is an equivalent future extraction query, **not** the
source of this snapshot. Normal gameplay never accesses these services.

## Reproduce

`npm run import:pune` uses the committed `pune/osm-source.json.gz`, without network
access or Python. `npm run validate:pune` verifies generated chunks and route.
The snapshot has 67,167 deduplicated OSM elements. Four original XML quadrants
are in ignored `raw/`; `python tools/convert-osm.py` reproduces JSON from them.
To refresh, retrieve the four documented URLs into `raw/quadrant-0.osm` through
`raw/quadrant-3.osm`, run the converter, then import. Do not repeatedly hit public
APIs or use raster tiles. Review metadata and import-report.json after refresh.

A modified geographic database is distributed: local projection, filtered public
roads, directed graph, inferred widths/heights, assembled/clipped polygons, route
selection, and chunk partitioning. It remains **ODbL 1.0**, including inferred
geographic attributes. Raw snapshot and modifications are offered alongside the
static release. Procedural art licensing does not override ODbL.

## Projection and elevation

Origin: 18.552 N, 73.791 E. Local equirectangular approximation, radius
6,371,008.8 m; X east, Z south, Y up. Utilities perform round trips, tested to
1e-10 degrees. This local approximation is suitable for the pilot, not a national
survey projection.

**No verified DEM is bundled. Terrain is synthetic, not real Pune elevations.**
Original smooth hills use arbitrary metres and CC0 terms. This is visibly labelled
in the UI, manifest and report. Waterbeds are lowered and water levels held flat;
bridge decks and ramps are gameplay approximations, not civil-engineering data.

The importer accepts `npm run import:pune -- --dem path/to/pune-grid.json`.
Supply a resampled local metric grid with `origin`, `x0`, `z0`, `cellSize`, `cols`,
`rows`, row-major `values` (Z increasing south), `baseElevation`, `source`,
`licence`, `retrievedAt`, `commercialReuseConfirmed: true`, and optional datum and
attribution details. No nodata is accepted; cover the full documented bounds.
Keep source citation/licence and conversion commands with the DEM. The boolean
records the provider's assertion; it does not independently verify a licence.

NASA SRTM is a possible next source; Earthdata may require authentication.
Consult the exact product licence and [NASA data-use guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy).
Copernicus products have product-specific terms; do not assume all DEM products
share a licence. No private keys or credentials belong in this repository.

## Larger future extracts

Obtain `india-latest.osm.pbf` from [Geofabrik](https://download.geofabrik.de/asia/india.html),
record its timestamp/checksum, then use locally installed Osmium:

```
osmium extract -b 73.772,18.534,73.810,18.570 india-latest.osm.pbf -o pune.osm.pbf --strategy complete_ways
osmium cat pune.osm.pbf -o pune.osm
```

Retain complete multipolygon members with an appropriate relation-complete
extract strategy before import; inspect boundary errors. Adapt the XML converter
to the single extract and record that source separately. Never download India
PBF during gameplay. The current runtime loads only processed local JSON.
