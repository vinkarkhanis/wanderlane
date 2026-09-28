# Real Pune feature pass

Branch: `feature/real-pune`, based on local main `c7dd086`. Existing uncommitted gameplay, collision, city and audio work was retained. No commit or push was made.

## Hero route

The 2,600 m directed section starts at Explorer progress 9,690 m and crosses the 10,730.75 m loop seam to 1,559.25 m. Start: local (-1152.415, -199.605), approximately 18.553795 N, 73.780068 E. End: (306.590, -579.859), approximately 18.557215 N, 73.793908 E. These coordinates derive from the existing local OSM projection, not a new survey.

This section joins the existing fictional Sandhya Chai, Baner shopfront and neighbourhood bus-stop scenes. It was chosen for existing authored activity and varied road/building density. The road and building coordinates are unchanged. The second discovery route follows existing progress 2,700–4,935 m toward Pashan; it is not a claim of driving to the lake shore.

## Visual rules and ownership

`puneStyle.js` chooses seven families by stable OSM building id, imported tags and height: plaster apartments, modern residential, shops, bungalow, office, construction and society. Untagged styles are artistic inference, never real building identities. `puneBuildings.js` paints seven original shared facade/emission atlases and merges rooftop tanks, solar-heater shapes, parapets, sunshades, balcony fronts, small AC boxes and laundry accents into chunk batches. Construction has unlit open-bay treatment. Windows are sparse and seeded; there is no per-window light.

Add a family to `ARCHETYPES`, its tag/height selection, and the matching painted atlas. Keep geometry within checked roof/footprint clearances; test stable id selection. More families alone will not deliver realism: future art passes should concentrate on ground-floor frontage and coherent blocks.

`puneEdges.js` creates a single deterministic hero-road placement plan, excluding bridges, junction approaches, other roads, pre-existing detail and scene reservations. Whole-object radii remain within one owning chunk. `tileEdges` rejects expanded building bounds and water polygon boundaries before applying budgets. The `puneEdgeView.js` kit renders pavement/drain panels, walls/gates, parked pairs of scooters, rickshaws, compact cars, carts and utility equipment. Models merge by material, with no individual static-prop scene nodes. Trees also avoid the new reservations.

Center dashes now require major two-way roads of adequate width, omit seeded worn intervals, and stop before network junction nodes. Sparse cosmetic repairs do not change road contact. Existing signal stop lines, crossings and bridge rails are retained. Monsoon uses the existing sky/rain/audio changes plus wet asphalt and new roadside puddles. No road condition is represented as surveyed.

Moving traffic remains on the existing directed loop, with its signal/following/collision rules. The 14-entry visual mix emphasizes scooters and rickshaws. Moving motorcycles and delivery silhouettes are variants; parked scooters are paired. Rickshaws have rounded canopies/fronts, driver silhouettes and rails; bikes have helmets, arms and mirrors. Static moving-vehicle body pieces are batched per material and disposed with the vehicle.

## Discovery and scene provenance

The existing trip panel offers the original Evening Chai Run, Baner Evening Drive (2.6 km), and Monsoon Pashan Drive (2.235 km). New drives use existing earned-distance/proximity checks. Smoothness includes hard acceleration, braking, off-road time and red-light crossings. Completion and scene discovery enter an in-memory journal that survives route restart and mode switching, but resets on page reload.

Stop within 90 m of the chai viewpoint at progress 9,750 m to enable Take a postcard. It pauses driving, clears input, captures the current canvas and shows an in-memory postcard. Only the latest image is retained. This is a view of the game scene, not a photo of the real location.

Add authored scenes through `STREET_SCENES`, using complete-network road clearance plus owning-chunk building/water checks in `safeStreetScene`. Preserve radius 7 and include a test against the imported data. `puneLandmarks.js` registers two original fictional focal structures at existing safe scenes. Add/replace a registry record and renderer template there; placement continues through `CityActors` and the scene safety gate. No exact real landmark replicas were added.

## Asset rights and elevation

All new visual meshes and canvas textures are original procedural code; no photographs, external models, logos, copied advertisements, Google data or downloaded media were used. Existing project licensing applies to this code. OSM-derived data remains governed by the included ODbL licence and attribution; attribution remains visible in game. Existing synthesized urban audio was retained, with no new recording or music.

Elevation remains **Synthetic terrain — not surveyed Pune elevation**. No licensed DEM was present or downloaded. The existing build-time path is `npm run import:pune -- --dem <local-grid.json>`. The JSON must provide source, licence, retrievedAt, commercialReuseConfirmed, matching origin, baseElevation, x0/z0, cellSize, cols/rows and finite row-major values. Values are metres, +x east/+z south in the pilot projection. Cover the complete import bounds; document vertical datum. The importer rejects missing provenance, origin mismatch, nodata and insufficient coverage, then rebuilds road ramps/chunks. Run validation and full contact/bridge tests before replacing the fallback. Existing hills remain mathematical silhouettes, not measured Pune hills.

## Budgets and checks

Chunk limits remain 9 on Low and 25 on Medium/High. New edge budgets per tile: 12 / 28 / 40. Rooftop placement attempts: 1 / 3 / 3; facade detail bays per building: 4 / 16 / 28. Moving traffic limits Off/Light/Normal: Low 0/4/8, Medium 0/5/11, High 0/6/14. Unsafe spawn slots wait rather than forcing vehicles onto the road. Existing actor limits remain 1/3/4 per scene. Shared facade textures/materials live for the world lifetime; merged chunk geometry is disposed on unload. No full-map work was added to the frame loop.

Run `node --test tests/real-pune.test.mjs`, the existing test/collision/city/Pune suites and `npm run validate:pune`. Start `npm run serve` for browser suites. New browser checks: `node tests/real-pune-discovery-browser.mjs`; comparison captures: `node tests/real-pune-capture.mjs after`. Build with `npm run build`, then run `npm run test:pune:deployment` for packaged subdirectory and corrupted-chunk recovery. Exact results and remaining gaps belong in `real-pune-validation.md`.

## Remaining art scope

This is a procedural visual improvement, not a complete recreation of Pune. Large spaces between source footprints still feel sparse; high-quality continuous street frontages need further authored work. There are no surveyed shop identities, authoritative hill geometry, bicycle AI, bus-dwell or shoulder-pull-in behaviours, overhead wire spans, accurate landmark replicas, new audio recordings, planted median network, direction-arrow network or physical potholes. The new props do not introduce solid collision obstacles. Existing building/traffic collision remains authoritative. Synthetic façades still repeat within each family, and roofs are simplified.


## Neighbourhood scene update — 2026-09-28

The fictional `baner-shops` scene at loop distance 10,480 m now contains six adjoining shops, a shared raised pavement, recessed doors, varied shutters, awnings, merchandise and a separate paired-scooter parking bay. Its frontage faces the road. This is an approximately 12 m shop cluster inside the existing validated seven-metre clearance, not a completed 150–250 m neighbourhood frontage. Business names are invented, including Marathi/English grocery, medical, chai, bakery, cycle repair and vegetables signs.

`puneShopfronts.js` owns the static kit and deterministic pedestrian paths. Medium has eight people (four walking and four waiting), High ten, Low three. Walkers traverse separate short pavement lanes with endpoint pauses and turnarounds. Other existing roadside scenes now have short walking motions as well. Reduced motion and Low freeze pedestrian animation; nearby Medium/High instances update at 12 Hz. The people use shared capsule and sphere geometry, clothing colours, and heading-aligned limbs. Paths remain decorative, with no pedestrian collision or road-crossing AI. Door customers wait outside; entering interiors is not implemented. Vegetation placement reserves the scene clearings.

Validation: `node --test tests/neighbourhood.test.mjs tests/city-streets.test.js tests/real-pune.test.mjs` (7 passed); `node tests/neighbourhood-browser.mjs` (eight people, six shops, moving matrices, reduced-motion freeze, disposal and no page errors); `npm run test:city:input` (keyboard and multi-pointer touch); `npm run test:city:systems` (traffic queues, bounds, disposal, audio). Screenshot: `tests/real-pune-after/neighbourhood-shops.png`, rendered using actual streamed city geometry and an inspection camera with fixture lighting; it is not the gameplay camera. The fixture recorded 177 draw calls, not a frame-time benchmark.


## 200 m visual benchmark — 2026-09-28

`puneBenchmark.js` defines loop distance 10,380–10,580 m, about 690–890 m into the Baner Evening drive. It produces two-metre pavement bays after imported-building, water, road and junction clearance checks. There are 86 accepted bays across the two sides, with gaps where the site is constrained; this is not 200 m of uninterrupted frontage on both sides. Lowered driveway bays, drainage grilles, concrete compound walls and forecourts replace selected empty roadside ground. Forecourts avoid the existing shop clearing. This decorative kit does not add physical collisions or alter navigation geometry. Vegetation avoids the dressed corridor.

`puneSurfaceMaterials.js` creates deterministic local pavement/concrete maps with subtle bump and roughness. The generated residential facade in `assets/art/` is applied to nearby buildings within 65 m of a benchmark sample, with stable per-building tints. Existing building footprints and heights remain unchanged. Texture loading falls back to procedural facades on failure; shared maps are released on world disposal. The source asset, built-in generation method and exact prompt are in `assets/art/PROVENANCE.md`. Other procedural facades gained subdued frames, varied curtains and sill weathering. Nearby shop structures and compound walls now participate in the existing shadow system.

Validation for this update: eight focused Node tests passed (benchmark, neighbourhood, street clearances and existing real-Pune checks); keyboard and multi-pointer touch browser checks passed. `tests/benchmark-browser.mjs` uses the production CameraRig at loop distance 10,500 m and production Environment for the after image. The before image used the earlier fixed fixture lighting, so the pair compares layout and material appearance, not isolated lighting changes. Neither image includes the player car or HUD. The after fixture rendered 251 draw calls; this is not a performance benchmark. The test verifies the facade loaded, all seven new shared textures were disposed, and pedestrians still move and respect reduced motion.

Remaining: high-quality rigged people, more varied authored building silhouettes, realistic tree assets, broader frontage continuity and real-world elevation. This is a stronger benchmark foundation, not photographic realism. No commit, push or deployment was performed.
