# Vehicle collision response

Implemented 26 September 2026, on top of the existing uncommitted Pune slice.

## Behaviour and ownership

- `src/vehicleCollisions.js`: renderer-independent oriented-box contact detection, height rejection, mass/inertia-based impulses, tangential friction, positional separation, and damped impact motion. Masses are gameplay tuning values, not specifications of branded vehicles.
- `src/trafficCollisions.js`: bounded player/traffic and traffic/traffic pair solver, four contact iterations, event cooldowns, gradual traffic recovery, and copied diagnostics. No timers, listeners, models, textures, or audio nodes are allocated by this system.
- `src/vehicle.js`: applies the player's impact slide and yaw in existing physics substeps; reset clears them.
- `src/city/cityPath.js`: Return to Road also clears impact motion.
- `src/traffic.js` and `src/city/cityTraffic.js`: replace the old player-only speed reduction/nudge, apply forces to both vehicles, preserve navigation anchors, render displaced/rotated poses, cap catch-up to 0.1 seconds and substep it. Spawn clears impact offsets; disposal clears contacts. Normal traffic remains bounded at seven vehicles.
- `src/main.js`: exposes copied collision events, player impact speed/yaw, and traffic positions/impact offsets for QA.
- `package.json`: adds the two collision test commands.
- `tests/collisions.test.js`: eight pure tests covering bounds, bridge heights, momentum/energy, mass differences, off-centre rotation, head-on impacts, pile-ups, recovery, reset, and snapshot isolation.
- `tests/collisions-browser.mjs`: actual rendered Pune contacts, AI-to-AI contact, recovery/disposal, and a real keyboard-driven collision using the visible Start and trip controls. Keyboard feedback steering aims at traffic; it never teleports or mutates the running game.

## Browser evidence

Ignored local artifacts, visually inspected:

- `tests/collision-before.png`: staged scene before contact.
- `tests/collision-glancing.png`: struck car displaced and rotated after an off-centre collision.
- `tests/collision-keyboard.png`: actual game immediately after a keyboard-driven impact.
- `tests/collision-results.json`: measurements and empty browser error array.

The staged glancing impact displaced traffic by about 1.21 m; its peak speed after being struck was 12.71 m/s. The independent AI-to-AI impact produced about 0.33 radians of rotation after 20 steps. Recovery left under 0.002 m of offset after 20 simulated seconds. Return to Road cleared the player's slide/yaw. Disposal left zero vehicles and zero contact cooldowns.

## Limits

This is a lightweight planar, arcade-style rigid-body response, not a six-axis crash simulator. Vehicles remain supported by the existing terrain system. There is no body deformation, detached debris, rollover, injury simulation, or new crash sound. AI gently recovers toward its legal route after the initial impact; it is not an unrestricted off-road physics agent. Bridge separation uses a conservative vertical-distance filter. Existing building and road-boundary handling remain unchanged.

The collision solver adds no rendering resources. Seven traffic vehicles plus the player require at most 28 pairs per iteration; expired contact cooldowns are removed. Existing queue/spawn tests continue to verify safe normal driving.

## Verification for this change

Final runs passed:

```text
npm run test:collisions              (8 tests)
npm run test:collisions:browser      (rendered contacts and actual keyboard crash)
npm test                            (18 tests)
npm run test:city                    (10 tests)
npm run test:pune                    (9 tests)
npm run test:systems
npm run test:pune:world
npm run test:car
npm run test:environment
npm run test:pune:browser
npm run test:browser
npm run test:improvements:browser
npm run test:ride:browser
npm run test:city:input
npm run test:city:systems
npm run build
npm run test:pune:deployment
git -c safe.directory=C:/Vinayak/game/slow-roads-plus diff --check
```

The input tests exercised acceleration, steering, brake/reverse, dedicated reverse, auto-drive, Return to Road, cameras, traffic/mute, pause, and simultaneous multi-pointer touch with cancellation cleanup. The collision browser test reported no page/console errors. The full city journey replay was not repeated for this collision-only follow-up; Pune's full-loop physics/world regression was repeated and passed.

At 1440x900, DPR 1, Medium, a 300-frame Normal-traffic sample measured 13.7 ms median / 14.2 ms p95. The existing Pune browser sample measured 10.4 / 12.4 ms with traffic off. These are local after-change samples, not a controlled collision-specific before/after benchmark. Three successive Pune/Endless/Pune cycles returned to exactly 196 geometries, 14 textures, 16 audio nodes, seven cars and zero stale collision events.

Existing uncommitted city work was retained. This follow-up adds the collision modules, tests and this report, and modifies the integration files listed above. Nothing was committed or pushed. Screenshots and result JSON remain ignored test artifacts.
