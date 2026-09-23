export function terrainHeight(path, s, offset, biome = "meadow") {
  const d = Math.abs(offset),
    blend = Math.min(1, Math.max(0, (d - 22) / 36));
  const hills =
    Math.sin(s * 0.014 + offset * 0.026) * 5 +
    Math.sin(s * 0.031 - offset * 0.018) * 2;
  const rise =
    biome === "canyon" ? d * 0.23 : biome === "snow" ? d * 0.12 : d * 0.04;
  return path.height(s) + blend * (hills + rise);
}
