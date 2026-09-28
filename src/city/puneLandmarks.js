// Replaceable original focal structures, not surveyed replicas. Placement is
// delegated to the same road/building/water clearance gate as authored scenes.
export const LANDMARKS = Object.freeze([
  {
    id: "baner-chai-canopy",
    sceneId: "evening-chai-crowd",
    kind: "canopy",
    label: "Sandhya Chai canopy",
    provenance: "Original fictional local-style structure",
  },
  {
    id: "pashan-garden-gate",
    sceneId: "compound-garden",
    kind: "garden-gate",
    label: "Garden society gateway",
    provenance: "Original fictional local-style structure",
  },
]);
export function dressLandmark(scene, b, res) {
  const item = LANDMARKS.find((l) => l.sceneId === scene.id);
  if (!item) return null;
  if (item.kind === "canopy") {
    for (const x of [-2.3, 2.3]) b(x, 1.6, 1.8, 0.16, 3.2, 0.16, res.cream);
    b(0, 3.2, 1.8, 5, 0.18, 1.5, res.ochre);
    for (let x = -2.2; x <= 2.2; x += 0.4)
      b(x, 3.35, 1.8, 0.12, 0.12, 1.7, res.dark);
  } else {
    for (const x of [-2.5, 2.5]) {
      b(x, 1.5, 0, 0.6, 3, 0.6, res.cream);
      b(x, 3.12, 0, 0.8, 0.2, 0.8, res.ochre);
    }
    b(0, 2.85, 0, 5, 0.35, 0.4, res.ochre);
    for (let x = -2; x <= 2; x += 0.35) b(x, 1, 0, 0.06, 1.8, 0.08, res.dark);
  }
  return item;
}
