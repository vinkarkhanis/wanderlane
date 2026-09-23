// Metres, seconds, radians; conversion to km/h happens only in the HUD.
export const ROAD = {
  width: 8,
  lane: 2,
  step: 4,
  chunk: 160,
  behind: 2,
  ahead: 6,
  shoulder: 1.1,
  railOffset: 5.35,
};
export const PHYS = {
  maxSpeed: 42,
  reverseSpeed: 5,
  acceleration: 4.2,
  brake: 9,
  wheelbase: 2.65,
  cruise: 23,
};
export const COLORS = [
  ["Lagoon", 0x477c7c],
  ["Pearl", 0xe7dfc9],
  ["Ember", 0xad593c],
  ["Slate", 0x465666],
  ["Sage", 0x81937e],
  ["Midnight", 0x242d3b],
];
export const QUALITY = {
  Low: { dpr: 1, trees: 28, grass: 1000 },
  Medium: { dpr: 1.5, trees: 44, grass: 2200 },
  High: { dpr: 2, trees: 65, grass: 3600 },
};
export const damp = (a, b, rate, dt) =>
  a + (b - a) * (1 - Math.exp(-rate * dt));
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const angleDelta = (a, b) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
