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

This is an early playable city pilot. Imported signals now drive deterministic traffic queues along the curated route; city-wide routing and oncoming traffic remain unimplemented. Terrain elevation is synthetic, bridge grades are approximations, and decorative shops are fictional. The neighbourhood benchmark is bounded rather than a complete Pune reconstruction. People, vegetation and distant buildings remain stylized. No universal 60 FPS or physical-phone production validation is claimed. See docs/real-pune-validation.md for tested scope.

## First public release

The current candidate is commit 18974a7 on feature/real-pune (PR #1). Do not deploy main expecting these changes unless the PR has been merged. A direct upload of the checked local ZIP can deploy this candidate without merging. For Git integration, select the intended release branch explicitly.

For Cloudflare Pages Direct Upload, upload dist/ or wanderlane-pune.zip. For itch.io, create an HTML game, upload the ZIP, mark it playable in-browser and use click-to-launch fullscreen. The same ZIP contains all assets and geographic attribution. Draft store copy is in docs/itch-listing.md. Bundle dimensions and SHA-256 are in docs/release-preflight.json.

After upload, verify Begin, a discovery drive, manual steering/braking, traffic, sound after interaction, settings/pause, camera controls, texture loading and visible OSM attribution at the live URL. Test touch on a real phone before claiming physical-device support. No paid promotion budget has been authorized.

Official guides: https://developers.cloudflare.com/pages/get-started/direct-upload/ and https://itch.io/docs/creators/html5


## Cloudflare Workers Git builds

The `wanderlane` Worker is a static-assets deployment. `wrangler.jsonc` explicitly selects `./dist` and runs `npm run build:site` before upload. The site-only build does not need Python; `npm run build` still makes the itch.io ZIP locally.

Dashboard deploy command: `npx wrangler deploy`. The dashboard build command may remain empty because Wrangler runs the configured build. Production must use the branch containing this configuration and the desired game changes (currently `feature/real-pune` until PR #1 is merged).

A build with no Wrangler configuration can infer the repository root as the assets directory and accidentally include node_modules. The observed failed build tried to upload the 128 MiB workerd binary. Do not fix this by increasing limits or deleting dependencies: select the prepared dist assets instead.
