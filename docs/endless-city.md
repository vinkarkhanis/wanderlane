# Endless City

Choose **Endless City · Pune inspired** in Settings → Drive Mode for a continuous drive without a map boundary. The road and city blocks stream ahead in both directions. Only the nearby nine road chunks remain loaded on the ground, with a larger buffer during flight.

This is a fictional Pune-inspired city boulevard, with apartment blocks, shops, continuous footpaths and streetlights. It uses procedural geometry rather than OpenStreetMap street locations. **Pune & outskirts** still offers the source-backed mapped routes and original journeys separately; those maps retain their finite geographical bounds and real dead ends.

The endless city supports all garage vehicles, manual/auto driving, reverse, traffic, flight, camera modes, and saved mode selection. Auto driving cruises at up to 43 km/h before curve/traffic slowing. Districts vary the density and height of the buildings; parks, lake shores, hills, and landmark forecourts have clear space. Chunk resources are released as they fall behind.

The 5.12 km district sequence includes Aster Galleria, The Boulevard Hotel, Willow Lake with a promenade and boats, Greenridge hill roads and a lookout, Lotus Garden Temple, Skyline Grand Hotel, and Garden Avenue Park. These are fictional names and procedural architecture. Later sequences alternate the side of the road. This expands the variety of the endless-city environment; it does not enlarge the OpenStreetMap bounds of the separate Pune map.

Settings → **City starting area** lets you start near any of the six districts. The starting area is saved. The route continues from there with no terminal road end. The HUD names the current district and distance to the next place, and the minimap marks nearby places.

Large building footprints have collision proxies and flight-clearance bounds. Landmark parcels reserve space from other buildings; lakes carve an off-road basin and exclude grass/trees from the water. Landmarks use shared geometry and materials; signs and per-chunk resources are disposed when streamed out.

Trees use shared branched trunks, bark detail and layered leaf sprays, including the landmark gardens and lake promenade. Meadow and snow hills are continuous terrain ridges rather than enlarged rock models. A finer terrain mesh follows slopes and stays beneath the road surface to prevent green terrain appearing through asphalt. These remain procedural, stylized environments, not photorealistic assets or surveyed hills.

Validation: `node --test tests/endless-city.test.mjs` and `node tests/endless-city-browser.mjs`.

Place validation: `node --test tests/city-places.test.mjs`, `node tests/city-places-browser.mjs` (six districts, keyboard/auto, saved starting area and simultaneous touch), and `node tests/city-places-views.mjs` (production camera views and resource disposal).
