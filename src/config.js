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
  maxStep: 1 / 60,
  maxDelta: 0.1,
  steeringAngle: 0.56,
  steeringSpeed: 11,
  lateralAcceleration: 7.5,
  steerIn: 4.8,
  steerOut: 7.5,
  suspensionRate: 18,
  suspensionTravel: 0.045,
  axles: [-1.4, 1.34],
  halfTrack: 0.94,
};
export const CAMERA = { horizontal: 10, vertical: 4.5, pitch: 4 };
export const CITY_DETAILS = {
  spacing: 38,
  clearance: 2.4,
  signSpacing: 180,
  budgets: { Low: 18, Medium: 30, High: 40 },
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
