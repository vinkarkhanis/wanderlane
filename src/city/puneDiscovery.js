import { HERO_ROUTE } from "./puneStyle.js";
import { STREET_SCENES } from "./puneStreetDetails.js";
export function discoveryTrip(path, id) {
  const monsoon = id === "monsoon-pashan";
  const start = monsoon ? 2700 : HERO_ROUTE.start,
    length = monsoon ? 2235 : HERO_ROUTE.length;
  const offsets = monsoon ? [800, 1280, 2235] : [60, 790, 1341, 2600];
  const labels = monsoon
    ? [
        "Compound gardens · local-style scene",
        "Park Ridge Road",
        "Pashan–Sus Road · arrival",
      ]
    : [
        "Sandhya Chai · fictional scene",
        "Pancard Club Road shopfronts",
        "Neighbourhood bus stop · fictional scene",
        "Baner neighbourhood · arrival",
      ];
  return {
    id: monsoon ? "monsoon-pashan" : "baner-evening",
    name: monsoon ? "Monsoon Pashan Drive" : "Baner Evening Drive",
    description: monsoon
      ? "A quieter drive along the Pashan approach."
      : "Chai, shopfronts and a little time in Baner.",
    start,
    distance: length,
    season: monsoon ? "Monsoon" : "Summer",
    time: monsoon ? 1 : 2,
    objectives: offsets.map((distance, i) => ({
      distance,
      s: (start + distance) % path.length,
      label: labels[i],
      district: monsoon ? "Pashan approach" : "Baner",
    })),
  };
}
export class DiscoveryJournal {
  constructor() {
    this.drives = new Map();
    this.scenes = new Set();
    this.postcards = new Set();
  }
  complete(snapshot) {
    this.drives.set(snapshot.tripId, {
      id: snapshot.tripId,
      name: snapshot.name,
      quality: snapshot.quality,
    });
  }
  encounter(id) {
    if (STREET_SCENES.some((s) => s.id === id)) this.scenes.add(id);
  }
  postcard(id) {
    this.postcards.add(id);
  }
  get snapshot() {
    return {
      drives: [...this.drives.values()],
      scenes: [...this.scenes].map((id) => ({
        id,
        label: STREET_SCENES.find((s) => s.id === id).label,
        provenance: "Fictional local-style scene",
      })),
      postcards: [...this.postcards],
    };
  }
}
export const POSTCARD = {
  id: "sandhya-postcard",
  scene: "evening-chai-crowd",
  label: "A pause for chai · Baner",
  s: 9750,
  radius: 90,
};
