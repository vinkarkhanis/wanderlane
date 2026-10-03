# Flying in Wanderlane

Flight is available in Pune City and every Endless biome.

- **L / Fly button:** take off; while airborne, start assisted landing. Press again during landing to cancel it.
- **W / Up:** accelerate. **S / Down:** slow to a hover.
- **A / D or Left / Right:** turn, including while hovering.
- **Q / E:** rise / descend. Touch devices have Rise and Lower buttons alongside the steering and pedals.
- **H / Return to Road:** immediately recover to the nearest road.
- **C:** camera views. **F:** cockpit.

Takeoff rises vertically before horizontal flight starts. Landing aligns with a nearby road, waits for its scenery to load, reserves space from traffic, and lowers the car onto the road before restoring driving. A ring marks the landing spot. Pause freezes flight and clears held inputs.

Auto-drive is disabled on takeoff and requires landing before it can be enabled. Pune journey progress and player signal violations are suspended in flight; city traffic and signals continue running.

Pune flight remains inside the pilot boundary. Endless flight remains within the generated scenery corridor. Cruise clearance starts at 45 metres in Pune and 18 metres in Endless, with extra clearance for nearby tall buildings or large rock formations. The selected cruise height is capped at 110 metres; obstacle clearance can raise the car further. This is assisted arcade flight, not an aircraft simulation.

## Verification

Run `npm run test:flight` for flight physics and landing checks. With the local server running on port 8123, run `npm run test:flight:browser` for keyboard and actual multi-touch checks. Set `WANDERLANE_URL` to the deployed URL to run the same browser suite live; evidence is saved under `output/flight-live/`.
