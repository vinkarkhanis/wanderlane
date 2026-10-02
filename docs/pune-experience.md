# Evening Chai Run

The slice follows the existing directed Baner–Pashan Explorer. No generated
map files or import rules are changed. All distances are metres along CityPath.

Start: s=9690, on the curated unnamed local road, roughly 296 m east of
Baner High Street (navigation roads 3761–3766, OSM ways 856685153/154 and
related segments). The interface says **area**, not that the car is on High Street.
The route crosses its seam before reaching Pancard Club Road at s=440.
Baner is supported by place node 6616602606. The busy corridor is Gopal Hari
Deshmukh Marg, whose source alt_name is Baner Road, and the Baner–Pashan Link
Road junction at s=2848. Park Ridge Road begins at s=3801.

Destination: s=4935 on Pashan–Sus Road, supported by its road tags and Pashan
place node 761969935. Pashan Lake is relation 2794610 in chunks -4,6 through
-1,7. The curated route does **not** reach the lake entrance or shore. Arrival
is explicitly the lake approach, approximately 765 metres northeast of the
mapped water. No invented shoreline, lake gate, or entrance is rendered.

`puneStreetDetails.js` retains the eight original landmark positions alongside
the generated market sites described below. Original-site selection searched
forward from route anchors 9750, 10450, 300, 1800, 2700, 3500, 3980 and 4860
for a 7 m radius clear of every imported road corridor, building bounding box,
water polygon and tile edge. Tests revalidate every position against the shipped
data. Stalls, shelters, gardens and works are original fictional scene dressing,
not claims of real businesses or surveyed infrastructure. The chai crowd and
amber shoulder-work beacon are deterministic city moments. Scene encounters
are recorded only within 100 m of their actual visible scene positions.

Signals use imported nodes 247431934 and 2476292433, projected to the three
directed approaches of the route. Nearby source nodes are deduplicated per
approach. Cycles are original simplified 18 s green / 3 s amber / 15 s red,
offset by node ID; they do not claim real traffic-controller timings. Stop
boundaries are 9 m before the projected node and have painted stop lines. AI
stops its front bumper plus 1 m before that boundary. Player centre crossings
are scored once per pass, with lane, height and heading checks. Return to Road
resets the crossing baseline so a teleport cannot incur a red-light violation.

The route has 41 additional fictional six-shop markets, placed offline with
`node tools/plan-pune-markets.mjs`. Sites target 180 m intervals and search
nearby safe parcels; the actual average is about 260 m and the longest gap
between new clusters is under 650 m. Every site retains the seven-metre
clearance checks above. More eligible building frontages also have retail
displays. These are invented businesses, not surveyed shops.

Street geometry and signboards merge into owning chunks. Shop artwork is
shared across all markets and disposed with the city. Each loaded market has
6/12/16 people on Low/Medium/High: pavement walkers, customers entering shops,
and shopkeepers. Only nearby people animate at 12 Hz; Low and reduced-motion
retain static crowds. Non-market scenes retain their smaller budgets.

Pune traffic caps (Off/Light/Normal) are 0/6/12 on Low, 0/9/20 on Medium and
0/12/28 on High. The mixed fleet includes buses, rickshaws, motorcycles,
scooters and cars, following the existing directed route with safe following
gaps and signal stops. Unsafe spawns wait rather than overlap. First load of
this city-activity update enables Normal traffic once; subsequent Off/Light
choices persist. City audio still adds a fixed graph only after a gesture.

Validation: `npm run test:city`, `npm run test:real-pune`,
`npm run test:city:systems`, and `npm run test:city:activity` (local preview
server required for browser checks). The activity browser check covers the
one-time setting update, explicit Off persistence, drive progress, local
vehicle mix, market crowds and repeated mode-switch resource counts.

## Route choice and arrival

The original Explorer remains the geographic reference. An alternate branch
replaces route edges 202–211: 418 m of existing Park Ridge Road, Wakeshwar Road
and unnamed residential roads reconnect at the same imported node, compared
with 279 m on the main branch. The alternate roads are surface roads and follow
their permitted direction. No map import or road geometry was added. Choose
the branch before an Evening Chai Run or Monsoon Pashan Drive, or near the fork.
Manual drivers can also take either turn. Progress earned before the fork is
retained; turn guidance, the nearby-road map, traffic and auto-drive follow the
selected branch. This is one authored fork, rather than general city routing.

Two original roadside parcels are validated against imported roads, buildings,
water and chunk boundaries in `puneJourney.js`. The Pashan destination is now
s=4905, beside the Pashan–Sus Road approach, rather than s=4935. The Baner stop
is s=1519.25, about 40 m before its former end. Each has a ground-following
marked bay and a small fictional chai shelter. Pavement walls, roadside props
and vegetation leave the parking approach clear. Neither stop is a surveyed
business or a lake entrance.

Arrival requires the earlier objectives, earned distance into the final 70 m
approach, and a continuous two-second stop below 0.5 m/s in the usable bay.
Passing through cannot complete the drive. Auto-drive eases into the bay and
stops; manual drivers receive pull-in guidance. Free roam remains available.
Completed stops offer downloadable PNG postcards. Journal entries and collected
postcard IDs persist locally under `wanderlane.discovery.v1`; image files are
saved only when downloaded. Blocked or damaged storage permits a visit journal.

Residential frontages favour entrances, slatted gates, planted ledges, shutters
and balconies; main road classes retain more retail frontages. Building and shop
details are fictional additions on imported geometry. Low quality omits the
extra shutter and balcony detail.

`npm run test:pune:journey` checks route connectivity and directions, anchor
mapping, parking clearance, stop semantics and journal storage.
`npm run test:pune:journey:browser` drives both Pashan branches and Baner through
the real loop, checks parking, postcards and reload persistence, and saves
screenshots and a report in `tests/journey-evidence/`.

The trip controller has no timers, DOM nodes or scene references. It rejects
implausible nearest-route jumps, off-route shortcuts and backwards credit.
An objective needs both earned distance and physical proximity. Returning to
the road preserves earned progress. A missed checkpoint must be approached
again; alternate progress is supported only on the authored fork.
