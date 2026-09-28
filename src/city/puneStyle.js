import { hashSeed } from "../random.js";
export const HERO_ROUTE = Object.freeze({
  start: 9690,
  length: 2600,
  label: "Baner neighbourhood drive",
});
export const ARCHETYPES = [
  "plaster",
  "modern",
  "shops",
  "bungalow",
  "office",
  "construction",
  "society",
];
export function heroProgress(s, length) {
  return (((s - HERO_ROUTE.start) % length) + length) % length;
}
export function buildingStyle(b) {
  const seed = hashSeed(String(b.id)),
    tag = b.tags?.building || b.style;
  let family;
  if (tag === "construction") family = "construction";
  else if (["office", "commercial", "retail", "industrial"].includes(tag))
    family = tag === "retail" ? "shops" : "office";
  else if (["house", "detached", "bungalow"].includes(tag) || b.height < 7)
    family = "bungalow";
  else if (b.height > 25) family = seed % 3 ? "modern" : "society";
  else
    family = [
      "plaster",
      "plaster",
      "society",
      "modern",
      "shops",
      "construction",
      "office",
    ][seed % 7];
  return {
    family,
    index: ARCHETYPES.indexOf(family),
    seed,
    lit: 0.3 + (seed % 5) * 0.13,
  };
}
export function markingRanges(r, junctionNodes) {
  if (
    r.oneway ||
    r.width < 6 ||
    !["primary", "secondary", "tertiary", "trunk"].includes(r.tags?.highway)
  )
    return [];
  const start = junctionNodes.has(r.a) ? Math.max(14, r.width) : 2;
  const end = r.length - (junctionNodes.has(r.b) ? Math.max(14, r.width) : 2);
  const ranges = [];
  for (let d = start; d + 4 < end; d += 12)
    if ((Math.floor(d / 12) + r.id) % 7 !== 0)
      ranges.push([d / r.length, (d + 4) / r.length]);
  return ranges;
}
