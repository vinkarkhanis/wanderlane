import { clamp } from "./config.js";
import { vehicleSpec } from "./vehicleCatalog.js";

// Virtual gears give each synthesized engine a rev rise and gentle shift drop.
// Parameters describe a fictional voice, not a recording of a real engine.
export function engineVoice(spec = vehicleSpec("gt"), speed, throttle) {
  const s = spec.sound,
    pace = Math.abs(speed);
  const gear = Math.min(5, 1 + Math.floor(pace / s.spacing));
  const revs = clamp(
    (pace - (gear - 1) * s.spacing) / (s.spacing * 1.35),
    0,
    1,
  );
  const load = clamp(throttle, 0, 1);
  const frequency = s.idle + s.rev * (revs * 0.75 + load * 0.25);
  return {
    gear,
    frequency,
    harmonic: frequency * s.harmonic,
    fundamentalGain: s.tone * (0.22 + load * 0.78),
    bodyGain: s.body * (0.25 + load * 0.75),
    grainGain: s.grain * (0.15 + load * 0.85),
    filter: s.filter * (0.7 + revs + load * 0.4),
  };
}
