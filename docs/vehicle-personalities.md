# Vehicle personalities

Select a ride in Settings → Vehicle. The vehicle description explains its feel.

The stronger personality pass separates automatic cruising speeds as well as
manual handling. On open roads the GT targets 26 m/s, bike 24, sedan 21,
hatch 19, SUV 17 and pickup 14.5; bends, traffic and city limits still lower
these targets. The pickup takes nearly twice the coupe's braking distance from
the same speed, while the coupe launches over three times faster in the first
three seconds. The SUV visibly rolls more than the coupe, and the bike leans
into corners. Body angles remain bounded and settle when stationary.

Chase framing and follow lag now differ by vehicle: a closer, lower GT/bike
view and a higher, more deliberate SUV/pickup view. Engine waveforms now have
six different harmonic patterns rather than sharing one sine tone; the sedan
stays smooth, the hatch and bike are brighter, and the pickup sounds deeper.

| Vehicle | Driving character |
| --- | --- |
| Aster GT | Crisp throttle, strong brakes, firm suspension, restrained body roll and sporty revs |
| Mira Compact | Quick steering and return, lively response, light body motion and a brighter engine |
| Serein Sedan | Gentle throttle, soft settling, the calmest camera and a quiet warm engine |
| Terra SUV | Measured steering, soft suspension, more corner roll and low rumble |
| Kestrel 400 | Eager throttle, quick brakes and steering, assisted corner lean and higher revs |
| Atlas Pickup | Gradual acceleration, wider turning response, longer stops, slower body settling and a deep engine |

Suspension height follows actual wheel contacts. Acceleration/braking pitch and
corner roll are damped and bounded; they settle when stopped. Camera response
uses acceleration, lateral force and suspension displacement rather than random
shake. Reduced motion removes added camera and body motion. Auto-drive retains
its existing route guidance, city speeds and parking support.

Engine voices are original procedural synthesis, with per-vehicle fundamental,
harmonics, filtered mechanical texture and virtual gear shifts. Switching models
reuses the audio graph. Master/engine volume, mute and pause apply as before.

Validation: `npm run test:vehicle:feel`, `npm run test:garage`,
`npm run test:vehicle:feel:browser` and `npm run test:garage:browser`.
Browser evidence lives in `output/vehicle-feel` and `output/garage`.
