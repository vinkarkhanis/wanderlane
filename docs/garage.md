# Vehicle selection

Open Settings → Vehicle to choose Aster GT (sport coupe), Mira Compact
(hatchback), Serein Sedan, Terra SUV, Kestrel 400 (motorbike), or Atlas Pickup.
The choice is saved locally and follows you between Pune and Endless Drive.
Swapping stops the vehicle and turns off auto-drive while preserving position,
journey progress, camera selection, and the current paint. Land before swapping
vehicles during flight.

Each vehicle has distinct acceleration, top speed, steering wheelbase,
wheel contact positions, and traffic collision dimensions/mass. The motorbike
uses assisted balance and a visual lean; this is relaxed driving rather than
a motorcycle balance simulator. Truck selection is an open-bed pickup.
Chase, wide chase, bumper and cockpit/rider views remain available, as do
paint cycling, lights, brake/reverse, auto-drive and flight.

Models are generated locally with fictional names. Sculpted coachwork includes
wheel arches, raked windscreens, separate reflective glass, cabin apertures,
seats, panel seams, mirrors, projector lamps, segmented tails and pickup bed
detail. Wheels have rounded tyres, tread, alloy spokes and brake discs. The
bike includes engine fins, a chain, exhaust, springs, curved fenders, a shaped
rider and helmet visor, plus a live speed display. These are procedural game
models with improved realism rather than photorealistic scanned assets.

Validation commands:

- `npm test`
- `npm run test:garage`
- `npm run test:collisions`
- `npm run test:garage:browser` (local preview on port 8128, or set GAME_URL)
- `npm run build:site`

The garage browser check covers six vehicles with keyboard acceleration,
steering, reverse and all camera views, saved selection, drive-mode switching,
repeated-swap resource counts, Endless auto-drive, and simultaneous touch
acceleration/steering. Evidence is saved under `output/garage/`.
