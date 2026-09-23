# Pune pilot implementation plan

The existing WANDERLANE (formerly Milelight) build uses metres, local +Z vehicle
forward, a single arc-length RoadPath with streamed 160 m strips, and spatial
nearest-road queries. Vehicle reset samples the road; lightweight fixed-step
physics, pooled traffic, four blended times, local procedural art and local
Three.js r160 are working. Preserve these and the approved Aster exterior/RHD cabin.

1. Cache an OSM Overpass JSON extract with query, bounds, source date and checksum.
2. Deterministically project and preprocess a separate graph, footprints, landuse,
   quality report, height field and square chunks. Retain geographic data under ODbL.
3. Add a city path adapter and streamed renderer without replacing Endless Drive.
4. Add connected route navigation, left-hand traffic and seasonal UI incrementally.
5. Validate imported topology, projection, determinism, runtime resource lifetime,
   browser controls, visuals and static subdirectory hosting.

Pilot bounds proposed: west 73.772, south 18.534, east 73.810, north 18.570.
Origin: 18.552 N, 73.791 E. About 4.0 km east-west by 4.0 km north-south.
This is a finite pilot; no claim of covering all Pune. Height data must be verified
or labelled synthetic. Unsupported source structures must appear in the report.
