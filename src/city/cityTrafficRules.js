export const FLEET = Object.freeze([
  "car",
  "rickshaw",
  "scooter",
  "bus",
  "rickshaw",
  "car",
  "scooter",
  "rickshaw",
  "scooter",
  "rickshaw",
  "scooter",
  "car",
  "scooter",
  "rickshaw",
]);
export const VEHICLE_SPECS = Object.freeze({
  car: Object.freeze({
    width: 1.75,
    length: 3.9,
    speed: 8.5,
    acceleration: 0.7,
  }),
  rickshaw: Object.freeze({
    width: 1.35,
    length: 2.65,
    speed: 7.5,
    acceleration: 0.65,
  }),
  scooter: Object.freeze({
    width: 0.68,
    length: 1.9,
    speed: 9,
    acceleration: 0.85,
  }),
  bus: Object.freeze({
    width: 2.15,
    length: 7.2,
    speed: 6.8,
    acceleration: 0.4,
  }),
});
export const followingGap = (a, b) => a.halfLength + b.halfLength + 2.5;
