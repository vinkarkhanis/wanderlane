# Asset provenance and licence notes

## Original project content

| Content                                                             | Local source                                                             | Origin / licence                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Aster GT and geometric diamond/star badge                           | `src/car.js`                                                             | Original procedural artwork created for Wanderlane; CC0-1.0 for the generated visual asset.                     |
| Fictional commuter vehicles                                         | `src/trafficCar.js`                                                      | Original procedural artwork; CC0-1.0 for generated visual assets.                                              |
| Terrain, trees, grass, flowers, cacti, rocks, barns, road and rails | `src/scenery.js`, `src/worldManager.js`, `src/roadChunk.js`              | Original procedural artwork; CC0-1.0 for generated visual assets.                                              |
| Chevron texture and sky-reflection gradient                         | Canvas-generation code in `src/worldManager.js` and `src/environment.js` | Created locally at runtime from original code; CC0-1.0 for generated images. No binary source image is needed. |
| Sky, stars, moon, clouds and weather particles                      | `src/environment.js`, `src/particles.js`                                 | Original procedural artwork; CC0-1.0 for generated visual assets.                                              |
| Engine, noise and ambient tones                                     | `src/audio.js`                                                           | Original Web Audio synthesis; CC0-1.0 for generated sound. No recorded samples.                                |
| Typography                                                          | CSS system font stack                                                    | Uses fonts supplied by the operating system; no font files distributed.                                        |

The original generated visual and audio assets listed above are dedicated to the public domain under **CC0 1.0 Universal**: https://creativecommons.org/publicdomain/zero/1.0/. This asset dedication does not purport to relicense pre-existing repository code, vendored software, platform fonts, or product names as trademarks. No project-wide source-code licence has been added.

## Third-party software

`vendor/three.module.js` is the unmodified Three.js **0.160.0** ESM distribution, obtained from `https://unpkg.com/three@0.160.0/build/three.module.js`. Its **MIT** licence is retained verbatim as `vendor/THREE-LICENSE.txt`. The module is served locally; browsers do not request it from a CDN.

Playwright and Prettier are development-only npm dependencies. Their package licence notices remain in their distributions; neither is shipped to the browser or required to play.

## Runtime audit

The application has no model loader, decoder URL, hotlinked texture, external font, prerecorded audio download or runtime third-party fetch. Local browser request capture confirmed only same-origin application resources. The hero and traffic designs are fictional and carry no real manufacturer badges.

## Natural vegetation pass

`src/vegetation.js` adds original branched broadleaf/birch/conifer templates,
curved grass-blade geometry, and seeded Canvas leaf/needle and bark textures. The texture
is generated from drawn leaves and twigs, without photographs or external files.
These generated visual assets use the same CC0-1.0 dedication described above.
All geometries, materials and textures are shared and disposed by WorldManager.

## Aster GT refinement

The selectable Mira Compact, Serein Sedan, Terra SUV, Kestrel 400 motorbike
and helmeted rider, and Atlas Pickup in `src/garageVehicle.js` and
`src/garageCoachwork.js` are original
fictional procedural artwork. Their generated visual assets use the same
CC0-1.0 dedication above, with no external models or textures.

The smooth body, wheel arches, trim and wheels in `src/car.js` and
`src/carGeometry.js`, and the cabin in `src/cockpit.js`, are original procedural
project artwork. The sky-reflection map, rear Aster identifier and instrument
screen are drawn locally with Canvas. Their generated visual assets use the
same CC0-1.0 dedication above. No external car model, badge, image or font file
was introduced.

The refined right-hand-drive cabin includes original generated leather grain,
instrument graphics and WANDERLANE centre-display artwork. These are covered by
the same project-created-art licence above; no external cabin assets are loaded.

## Pune geographic data — separate ODbL terms

Map data © OpenStreetMap contributors, available under ODbL 1.0.
[OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

The CC0 art dedication above applies to original artwork, **not** the Pune
geographic database. Roads, footprints, landuse, inferred geographic attributes,
route and chunk database retain ODbL 1.0. The cached source and modification
metadata are distributed with the site. See
[data-sources/README.md](data-sources/README.md) and
[database licence](assets/cities/pune/DATABASE-LICENSE.txt).

Pune facade/window Canvas textures and abstract materials are original CC0 art.
Pune vegetation currently reuses the original generic broadleaf templates;
species-specific Pune trees are not yet implemented. Terrain is a labelled
original synthetic fallback; no DEM has been bundled or claimed as real elevation.


## Benchmark facade (2026-09-28)

`assets/art/pune-residential-facade.png` is an original AI-generated fictional residential facade, created with the built-in image-generation tool for this project. It uses no supplied reference photography or map imagery. The exact prompt and provenance are bundled in `assets/art/PROVENANCE.md`. The local build includes both files; no external texture service is required.

## Baner neighbourhood frontages (2026-09-29)

The shopfronts, entrance canopies, cornices and Marathi/English sign atlas in
`src/city/puneFrontages.js` are original procedural artwork covered by the
project-created-art dedication above. Business and society names are fictional;
they do not identify surveyed premises. System fonts render the local Canvas
atlas; no external font or texture is fetched. The imported building footprints,
roads and geographic attribution remain unchanged. Street treatment now follows
eligible surface roads across the Pune map, including free roam and every
journey, wherever building, water, junction and chunk-boundary clearance permits.
It is procedural local-style decoration, not a surveyed city reconstruction.

Endless Drive includes occasional original neighbourhoods, spaced every eight
160-metre chunks, using the same generated sign atlas and frontage kit. Building
sites that are too steep or too close to the road are omitted. These fictional
settlements are not claimed to represent actual Pune locations. Buildings and
materials are streamed and disposed with the world, and nearby vegetation is
excluded from their footprints.
# Pune-inspired courtyards and market

The Pune outskirts expansion uses cached OpenStreetMap road, building,
pedestrian-path and land-use geometry under the existing ODbL attribution.
`src/city/puneStreetscape.js` and `cityWorld.js` supply original stylized mall
facades, source-name signs and inferred pavement treatment. These are not
surveyed facade replicas. No mall logos, photographs or external 3D models are
used. Extended hills are original synthetic terrain, not a measured elevation
dataset. Source and rebuilding details are in `docs/pune-expansion.md`.

`src/city/puneScenes.js` contains original procedural misal-and-chai tables,
a wada-inspired timber gateway with tiled eaves and a tulsi planter, and flower
and vegetable handcarts. These dress fictional scenes along the Baner–Pashan
pilot; they are not surveyed businesses or replicas of historic monuments.
All geometry and colors are generated locally and share chunk cleanup.
