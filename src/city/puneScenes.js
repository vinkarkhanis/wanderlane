// Original Pune-inspired set dressing, not replicas or surveyed businesses.
// Everything stays inside the existing seven-metre scene clearance footprint.
export const PUNE_SCENES = Object.freeze({
  "evening-chai-crowd": "Misal & chai courtyard · Pune-inspired",
  "compound-garden": "Wada-style courtyard · Pune-inspired",
  "park-ridge": "Phool & bhaji market · Pune-inspired",
});

export function dressPuneScene(scene, b, r) {
  if (!PUNE_SCENES[scene.id]) return;
  if (scene.id === "evening-chai-crowd") {
    // Tiled dining shelter behind the tea counter; steel plates and stools.
    for (const x of [-2.8, 2.8]) b(x, 1.4, 3.2, 0.15, 2.8, 0.15, r.dark);
    for (let i = 0; i < 5; i++)
      b(
        0,
        2.85 + (2 - Math.abs(2 - i)) * 0.14,
        1.7 + i * 0.45,
        6.2,
        0.18,
        0.52,
        r.terracotta,
      );
    for (const x of [-2.1, 2.1]) {
      b(x, 0.76, 2.1, 1.3, 0.12, 0.85, r.steel);
      b(x, 0.37, 2.1, 0.12, 0.74, 0.12, r.dark);
      for (const z of [1.35, 2.9]) {
        b(x, 0.4, z, 0.6, 0.12, 0.5, r.teal);
        b(x, 0.17, z, 0.12, 0.34, 0.12, r.dark);
      }
      for (const dx of [-0.35, 0.35]) {
        b(x + dx, 0.85, 2.1, 0.3, 0.045, 0.3, r.steel);
        b(x + dx, 0.9, 2.1, 0.18, 0.08, 0.18, r.terracotta);
      }
    }
    // Stainless snack display and a stack of bread trays.
    b(0.8, 1.62, 0.1, 1.1, 0.08, 0.65, r.steel);
    for (let i = 0; i < 4; i++)
      b(0.42 + i * 0.24, 1.72, 0.1, 0.2, 0.14, 0.23, r.cream);
  } else if (scene.id === "compound-garden") {
    // Basalt plinth, timber door, limewashed wings, tiled eaves and balcony.
    b(0, 0.22, 2.4, 8.6, 0.44, 2.1, r.dark);
    for (const x of [-2.85, 2.85]) {
      b(x, 2, 2.8, 2.7, 3.6, 1.3, r.cream);
      b(x, 2.3, 2.09, 1.3, 1.1, 0.12, r.timber);
      for (const dx of [-0.4, 0, 0.4])
        b(x + dx, 2.3, 2, 0.07, 1.15, 0.12, r.ochre);
    }
    b(0, 1.8, 2.6, 2.6, 3.15, 0.3, r.timber);
    for (let x = -1.15; x < 1.2; x += 0.28)
      b(x, 1.8, 2.39, 0.05, 3, 0.08, r.ochre);
    b(0, 3.7, 2.6, 8.8, 0.35, 1.9, r.timber);
    b(0, 4.3, 2.8, 4.2, 0.9, 1.3, r.cream);
    for (let x = -2; x <= 2; x += 0.4)
      b(x, 4.2, 1.98, 0.08, 0.8, 0.09, r.timber);
    b(0, 4.65, 1.98, 4.3, 0.12, 0.16, r.timber);
    for (let i = 0; i < 5; i++)
      b(
        0,
        4.95 + (2 - Math.abs(2 - i)) * 0.18,
        1.6 + i * 0.45,
        4.8,
        0.16,
        0.55,
        r.terracotta,
      );
    // Courtyard tulsi planter, outside the pedestrian's central path.
    b(-3, 0.5, -1.4, 0.9, 1, 0.9, r.terracotta);
    b(-3, 1.04, -1.4, 1.05, 0.12, 1.05, r.cream);
    b(-3, 1.4, -1.4, 0.65, 0.65, 0.65, r.leaf);
  } else {
    // Two handcarts, striped fabric awnings, produce crates and flower garlands.
    for (const x of [-2.2, 2.2]) {
      b(x, 0.9, 1.5, 2.5, 0.28, 1.6, r.timber);
      for (const dx of [-1, 1]) {
        b(x + dx, 0.36, 1.5, 0.18, 0.72, 0.72, r.dark);
        b(x + dx, 1.85, 2.1, 0.09, 2.1, 0.09, r.timber);
      }
      for (let i = 0; i < 6; i++)
        b(
          x - 1.25 + i * 0.5,
          2.85,
          1.4,
          0.5,
          0.12,
          2.2,
          i % 2 ? r.cream : r.terracotta,
        );
      for (let i = 0; i < 3; i++) {
        const xx = x - 0.8 + i * 0.8;
        b(xx, 1.12, 1.4, 0.7, 0.22, 1.1, r.ochre);
        for (let j = 0; j < 3; j++)
          b(
            xx,
            1.3,
            1.05 + j * 0.33,
            0.5,
            0.18,
            0.25,
            x < 0 ? (i % 2 ? r.cream : r.orange) : r.leaf,
          );
        if (x < 0)
          for (let j = 0; j < 5; j++)
            b(xx, 2.6 - j * 0.18, 0.38, 0.13, 0.15, 0.13, r.orange);
      }
    }
  }
}
