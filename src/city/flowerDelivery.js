import { JOURNEY_PLACES } from "./puneJourney.js";
import { wrappedDistance } from "./cityExperience.js";

export const FLOWER_POSTCARD = {
  ...JOURNEY_PLACES["pashan-chai"],
  id: "flower-delivery",
  label: "Flowers in the rain · fictional Pashan courtyard",
};

export function flowerTrip(path) {
  const start = 1439.25;
  const map = (s) => path.journeyDistance?.(s) ?? s;
  const pickup = {
    ...JOURNEY_PLACES["baner-pause"],
    label: "Baner flower stall · fictional stop",
    s: map(JOURNEY_PLACES["baner-pause"].s),
  };
  const arrival = { ...FLOWER_POSTCARD, s: map(FLOWER_POSTCARD.s) };
  return {
    id: "flower-delivery",
    name: "Monsoon Flower Delivery",
    description:
      "Collect a bouquet at the fictional Baner stall, then bring it to a sheltered courtyard on the Pashan approach. No hurry.",
    season: "Monsoon",
    time: 2,
    start: map(start),
    arrival,
    destination: "Courtyard",
    completion:
      "Thank you! These will brighten our rainy evening. Save a postcard of your delivery.",
    objectives: [
      {
        s: pickup.s,
        label: "Collect flowers · park at the Baner stall",
        district: "Baner",
        stop: pickup,
      },
      {
        s: map(2875),
        label: "Carry the flowers · Baner–Pashan Link Road",
        district: "Baner Road",
      },
      {
        s: map(3880),
        label: "Choose your road to the courtyard",
        district: "Pashan approach",
      },
      {
        s: arrival.s,
        label: "Deliver flowers · park at the courtyard porch",
        district: "Pashan approach",
      },
    ].map((o) => ({
      ...o,
      distance: wrappedDistance(map(start), o.s, path.length),
    })),
    distance: wrappedDistance(map(start), arrival.s, path.length),
  };
}
