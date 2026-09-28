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

`puneStreetDetails.js` records eight stable positions. Selection searched
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

Resources: street geometry merges into owning chunks, people use shared box
instances (1/3/4 per scene for Low/Medium/High), and signals share lamp materials.
Eight scenes bound pedestrians to 32 globally, with streaming lowering the
active count. Traffic retains Off/Light/Normal counts 0/3/7. City audio adds a
fixed graph only after a gesture; switching mode ramps its gains to zero.

The trip controller has no timers, DOM nodes or scene references. It rejects
implausible nearest-route jumps, off-route shortcuts and backwards credit.
An objective needs both earned distance and physical proximity. Returning to
the road preserves earned progress. A missed checkpoint must be approached
again; this pilot does not calculate alternate routes.
