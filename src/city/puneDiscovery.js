import { HERO_ROUTE } from "./puneStyle.js";
import { STREET_SCENES } from "./puneStreetDetails.js";
import { JOURNEY_PLACES } from "./puneJourney.js";
import { wrappedDistance } from "./cityExperience.js";
export function discoveryTrip(path, id) {
  const monsoon = id === "monsoon-pashan";
  const start = monsoon ? 2700 : HERO_ROUTE.start,
    canonicalLength = path.canonicalLength ?? path.length;
  const place = JOURNEY_PLACES[monsoon ? "pashan-chai" : "baner-pause"];
  const offsets = monsoon
    ? [800, 1280, wrappedDistance(start, place.s, canonicalLength)]
    : [60, 790, 1341, wrappedDistance(start, place.s, canonicalLength)];
  const labels = monsoon
    ? [
        "Wada-style courtyard · fictional scene",
        "Flower & produce market · fictional scene",
        "Pull in for chai · Pashan approach",
      ]
    : [
        "Misal & chai courtyard · fictional scene",
        "Pancard Club Road shopfronts",
        "Neighbourhood bus stop · fictional scene",
        "Pull in for an evening pause · Baner",
      ];
  return {
    id: monsoon ? "monsoon-pashan" : "baner-evening",
    name: monsoon ? "Monsoon Pashan Drive" : "Baner Evening Drive",
    description: monsoon
      ? "A quieter drive along the Pashan approach."
      : "Chai, shopfronts and a little time in Baner.",
    start: path.journeyDistance?.(start) ?? start,
    distance: wrappedDistance(
      path.journeyDistance?.(start) ?? start,
      path.journeyDistance?.(place.s) ?? place.s,
      path.length,
    ),
    arrival: { ...place, s: path.journeyDistance?.(place.s) ?? place.s },
    season: monsoon ? "Monsoon" : "Summer",
    time: monsoon ? 1 : 2,
    objectives: offsets.map((distance, i) => ({
      distance: wrappedDistance(
        path.journeyDistance?.(start) ?? start,
        path.journeyDistance?.((start + distance) % canonicalLength) ??
          (start + distance) % path.length,
        path.length,
      ),
      s:
        path.journeyDistance?.((start + distance) % canonicalLength) ??
        (start + distance) % path.length,
      label: labels[i],
      district: monsoon ? "Pashan approach" : "Baner",
    })),
  };
}
export class DiscoveryJournal {
  constructor(storage) {
    this.storage = storage;
    this.drives = new Map();
    this.scenes = new Set();
    this.postcards = new Set();
    this.photos = new Map();
    try {
      this.storage = storage ?? globalThis.localStorage;
      const saved = JSON.parse(
        this.storage?.getItem("wanderlane.discovery.v1") || "null",
      );
      if (saved?.version === 1) {
        for (const d of (Array.isArray(saved.drives) ? saved.drives : []).slice(
          0,
          12,
        ))
          if (
            [
              "evening-chai-run",
              "baner-evening",
              "monsoon-pashan",
              "flower-delivery",
            ].includes(d?.id) &&
            typeof d.name === "string" &&
            ["Smooth", "Mostly smooth", "Eventful"].includes(d.quality)
          )
            this.drives.set(d.id, {
              id: d.id,
              name: d.name.slice(0, 80),
              quality: d.quality,
            });
        for (const id of Array.isArray(saved.scenes) ? saved.scenes : [])
          if (STREET_SCENES.some((s) => s.id === id)) this.scenes.add(id);
        for (const id of Array.isArray(saved.postcards) ? saved.postcards : [])
          if (
            [
              "sandhya-postcard",
              "flower-delivery",
              ...Object.keys(JOURNEY_PLACES),
            ].includes(id)
          )
            this.postcards.add(id);
        for (const photo of (Array.isArray(saved.photos)
          ? saved.photos
          : []
        ).slice(0, 4))
          if (
            this.postcards.has(photo?.id) &&
            typeof photo.image === "string" &&
            /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo.image) &&
            photo.image.length < 160000
          )
            this.photos.set(photo.id, {
              id: photo.id,
              image: photo.image,
              ...Object.fromEntries(
                ["label", "vehicle", "weather", "route"].map((k) => [
                  k,
                  String(photo[k] ?? "").slice(0, 100),
                ]),
              ),
            });
      }
    } catch {
      /* A blocked or damaged store still permits a visit journal. */
    }
  }
  save() {
    try {
      this.storage?.setItem(
        "wanderlane.discovery.v1",
        JSON.stringify({
          version: 1,
          drives: [...this.drives.values()],
          scenes: [...this.scenes],
          postcards: [...this.postcards],
          photos: [...this.photos.values()],
        }),
      );
    } catch {}
  }
  complete(snapshot) {
    this.drives.set(snapshot.tripId, {
      id: snapshot.tripId,
      name: snapshot.name,
      quality: snapshot.quality,
    });
    this.save();
  }
  encounter(id) {
    if (STREET_SCENES.some((s) => s.id === id) && !this.scenes.has(id)) {
      this.scenes.add(id);
      this.save();
    }
  }
  postcard(id, photo) {
    this.postcards.add(id);
    if (photo) {
      this.photos.delete(id);
      this.photos.set(id, { id, ...photo });
      while (this.photos.size > 4)
        this.photos.delete(this.photos.keys().next().value);
    }
    this.save();
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
      photos: [...this.photos.values()],
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
