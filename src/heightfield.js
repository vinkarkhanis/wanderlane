import { cityTerrainHeight } from "./city/endlessCityPlaces.js";
export function terrainHeight(path, s, offset, biome = "meadow") {
  const d = Math.abs(offset),
    blend = Math.min(1, Math.max(0, (d - 22) / 36));
  const hills =
    Math.sin(s * 0.014 + offset * 0.026) * 5 +
    Math.sin(s * 0.031 - offset * 0.018) * 2;
  const rise =
    biome === "canyon" ? d * 0.23 : biome === "snow" ? d * 0.12 : d * 0.04;
  // Continuous ridgelines replace isolated oversized polygonal rock hills.
  const ridgeBlend = Math.max(0, Math.min(1, (d - 85) / 155));
  const rolling =
    biome === "meadow" || biome === "snow"
      ? ridgeBlend *
        ridgeBlend *
        (32 +
          24 * Math.sin(s * 0.003 + offset * 0.004) ** 2 +
          12 * Math.sin(s * 0.009 - offset * 0.011) ** 2)
      : 0;
  const y = path.height(s) + blend * (hills + rise) + rolling;
  return path.urban ? cityTerrainHeight(path, s, offset, y) : y;
}
