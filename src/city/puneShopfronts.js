// Fictional businesses, authored inside the existing seven-metre scene clearance.
export const SHOPS = [
  ["मित्र किराणा", "MITRA GROCERY", "#596e53"],
  ["आरोग्य मेडिकल", "AROGYA MEDICAL", "#536e79"],
  ["संध्या चहा", "SANDHYA CHAI", "#946842"],
  ["घरची बेकरी", "GHARCHI BAKERY", "#8b655a"],
  ["सायकल दुरुस्ती", "CYCLE REPAIR", "#586367"],
  ["ताजी भाजी", "FRESH VEGETABLES", "#637951"],
];
export const SHOP_CROWD = { Low: 6, Medium: 12, High: 16 };

// Separate pavement lanes and door queues keep routes away from merchandise
// and parked scooters. Motion is analytic: streaming order cannot change it.
export function pedestrianPose(kind, i, time) {
  if (kind !== "shops") {
    const phase = (time + i * 5) % 18;
    const t =
      phase < 6
        ? phase / 6
        : phase < 9
          ? 1
          : phase < 15
            ? 1 - (phase - 9) / 6
            : 0;
    return {
      x: -1.4 + i * 1.05,
      z: -2.8 + t * 0.9,
      yaw: phase < 9 ? 0 : Math.PI,
      moving: phase < 6 || (phase >= 9 && phase < 15),
    };
  }
  // Customers use the clear left side of a bay, pause inside, then leave.
  // Walkers remain on the pavement; up to six shopkeepers tend rear counters.
  if (i >= 4 && i < 10) {
    const phase = (time + (i - 4) * 6) % 28;
    const t =
      phase < 8
        ? phase / 8
        : phase < 14
          ? 1
          : phase < 22
            ? 1 - (phase - 14) / 8
            : 0;
    return {
      x: -4.75 + (i - 4) * 1.9 - 0.28,
      z: -1.35 + t * 2.55,
      yaw: phase < 14 ? 0 : Math.PI,
      moving: phase < 8 || (phase >= 14 && phase < 22),
      action:
        phase >= 8 && phase < 14
          ? i === 6
            ? "collecting chai"
            : "browsing"
          : phase >= 14
            ? "carrying purchase"
            : "approaching shop",
      reach:
        phase >= 8 && phase < 14 ? Math.sin(((phase - 8) / 6) * Math.PI) : 0,
      carry: phase >= 14 && phase < 24,
      purchase: i === 6 ? "cup" : "bag",
    };
  }
  if (i >= 10)
    return {
      x: -4.75 + (i - 10) * 1.9 + 0.3,
      z: 1.5,
      yaw: Math.PI,
      moving: false,
      action: "tending counter",
      reach: (1 + Math.sin(((time % 28) / 28) * Math.PI * 2 + i)) * 0.3,
    };
  const phase = (time + i * 7.1) % 32;
  const t =
    phase < 12
      ? phase / 12
      : phase < 16
        ? 1
        : phase < 28
          ? 1 - (phase - 16) / 12
          : 0;
  return {
    x: -4.6 + t * 9.2,
    z: -2.1 - i * 0.55,
    yaw: phase < 16 ? Math.PI / 2 : -Math.PI / 2,
    moving: phase < 12 || (phase >= 16 && phase < 28),
  };
}

export function shopfronts(b, r, quality = "Medium") {
  b(0, -0.06, -0.35, 11.4, 0.12, 7.4, r.cream);
  b(0, 0.08, -4.05, 11.2, 0.16, 0.18, r.ochre);
  b(0, 1.7, 2.6, 11.5, 3.4, 0.22, r.ochre);
  b(0, 3.4, 1.2, 11.7, 0.18, 3.1, r.cream);
  for (let i = 0; i < SHOPS.length; i++) {
    const x = -4.75 + i * 1.9;
    // Deep full-height partitions hid the entire interior on approach.
    // Keep rear dividers and narrow frontage posts, like an open market row.
    b(x - 0.88, 1.6, 2.17, 0.13, 3.2, 0.65, r.cream);
    b(x - 0.88, 1.3, -0.08, 0.09, 2.6, 0.12, r.cream);
    b(x, 1.35, 2.42, 1.7, 2.6, 0.1, r.cream);
    b(x, 0.025, 0.9, 1.7, 0.05, 3, r.cream);
    // Fully raised shutter rolls leave the entrance open above head height.
    const shutter = 0.18;
    b(
      x,
      2.6 - shutter / 2,
      -0.18,
      1.68,
      shutter,
      0.09,
      i % 2 ? r.teal : r.ochre,
    );
    for (let h = 2.6 - shutter; h < 2.6; h += 0.12)
      b(x, h, -0.24, 1.66, 0.025, 0.025, r.dark);
    b(x, 2.7, -0.55, 1.83, 0.1, 1.05, i % 2 ? r.ochre : r.teal);
    b(x, 2.59, -1.02, 1.83, 0.17, 0.06, i % 2 ? r.ochre : r.teal);
    b(x, 2.15, 1.65, 1.1, 0.07, 0.12, r.glow);
    if (quality !== "Low") {
      // Awning ribs and alternating stripes catch the approaching car camera.
      for (let stripe = -0.75; stripe <= 0.75; stripe += 0.3)
        b(x + stripe, 2.76, -0.55, 0.12, 0.025, 1.02, r.cream);
      b(x + 0.78, 1.4, -0.08, 0.065, 2.8, 0.065, r.dark);
      b(x + 0.67, 1.67, 2.32, 0.23, 0.32, 0.12, r.steel);
    }
    // Stocked rear shelves and a side counter retain a clear entry lane.
    for (const shelfY of [0.65, 1.25, 1.85]) {
      b(x, shelfY, 2.12, 1.55, 0.07, 0.4, r.timber);
      for (let j = 0; j < 5; j++)
        b(
          x - 0.6 + j * 0.3,
          shelfY + 0.18,
          2.1,
          0.2,
          0.29,
          0.22,
          i === 1
            ? r.cream
            : i === 3
              ? r.orange
              : i === 5
                ? r.leaf
                : [r.terracotta, r.teal, r.cream, r.orange, r.leaf][
                    (i + j) % 5
                  ],
        );
    }
    b(x + 0.53, 0.48, 0.65, 0.46, 0.96, 0.85, r.teal);
    b(x + 0.53, 1, 0.65, 0.54, 0.08, 0.95, r.cream);
    if (i !== 4) {
      b(x + 0.5, 0.38, 0.15, 0.52, 0.76, 0.7, r.ochre);
      for (let j = 0; j < 3; j++)
        b(
          x + 0.34 + j * 0.16,
          0.82,
          0.15,
          0.13,
          0.15,
          0.38,
          i === 5 ? r.leaf : r.cream,
        );
    }
    if (quality !== "Low") {
      // Displays stay on the counter side, clear of the existing customer lane.
      if (i === 2) {
        b(x + 0.53, 1.23, 0.7, 0.26, 0.36, 0.26, r.steel);
        b(x + 0.53, 1.43, 0.7, 0.3, 0.05, 0.3, r.dark);
        b(x + 0.72, 1.2, 0.7, 0.14, 0.08, 0.08, r.steel);
        for (const z of [0.35, 0.5])
          b(x + 0.39, 1.13, z, 0.09, 0.17, 0.09, r.cream);
      } else if (i === 1) {
        b(x + 0.54, 1.26, 0.65, 0.24, 0.38, 0.24, r.cream);
        b(x + 0.54, 1.26, 0.51, 0.18, 0.045, 0.025, r.teal);
        b(x + 0.54, 1.26, 0.51, 0.045, 0.18, 0.025, r.teal);
      } else if (i === 4) {
        b(x + 0.53, 1.05, 0.68, 0.38, 0.08, 0.42, r.steel);
        for (const z of [0.48, 0.72, 0.9])
          b(x + 0.53, 1.14, z, 0.27, 0.055, 0.08, r.dark);
        b(x + 0.61, 1.63, 2.28, 0.4, 0.65, 0.06, r.timber);
        for (const h of [1.4, 1.6, 1.8])
          b(x + 0.61, h, 2.23, 0.3, 0.055, 0.065, r.steel);
      } else if (i === 0 || i === 5) {
        for (let crate = 0; crate < 2; crate++) {
          b(x + 0.54, 0.12 + crate * 0.23, -0.44, 0.45, 0.2, 0.36, r.timber);
          b(
            x + 0.54,
            0.24 + crate * 0.23,
            -0.44,
            0.39,
            0.07,
            0.3,
            crate ? r.orange : r.leaf,
          );
        }
      } else {
        b(x + 0.53, 1.22, 0.65, 0.44, 0.32, 0.65, r.steel);
        b(x + 0.53, 1.22, 0.31, 0.38, 0.22, 0.025, r.dark);
        for (const z of [0.48, 0.75])
          b(x + 0.53, 1.11, z, 0.25, 0.1, 0.18, r.orange);
      }
    }
  }
  if (quality !== "Low") {
    // A compact lived-in upper storey replaces the flat strip-mall silhouette.
    // Original fictional architecture, entirely inside the checked scene parcel.
    b(0, 4.7, 2.5, 11.4, 2.6, 0.22, r.cream);
    b(0, 3.48, 2.05, 11.4, 0.12, 1.4, r.cream);
    for (const x of [-5.6, 5.6]) b(x, 4.7, 2.02, 0.16, 2.6, 1.25, r.ochre);
    for (let i = 0; i < SHOPS.length; i++) {
      const x = -4.75 + i * 1.9;
      // Separate parapets break the skyline within the same cleared parcel.
      const roofY = 6.05 + (i % 3) * 0.22;
      b(x, roofY, 2.02, 1.92, 0.18, 1.8, i % 2 ? r.terracotta : r.ochre);
      b(x, roofY + 0.18, 2.62, 1.84, 0.3, 0.16, r.cream);
      b(x, 4.75, 2.35, 1.2, 1.65, 0.12, r.timber);
      b(x, 4.75, 2.26, 1.02, 1.47, 0.06, i % 3 ? r.dark : r.teal);
      b(x, 4.75, 2.21, 0.045, 1.47, 0.04, r.cream);
      b(x, 5.66, 2.04, 1.4, 0.1, 0.65, r.ochre);
      b(x, 3.85, 1.9, 1.45, 0.12, 1.15, r.cream);
      for (const h of [4.05, 4.65]) b(x, h, 1.34, 1.4, 0.055, 0.055, r.dark);
      for (let dx = -0.6; dx <= 0.61; dx += 0.3)
        b(x + dx, 4.35, 1.34, 0.04, 0.65, 0.04, r.dark);
      b(x + 0.46, 4.07, 1.75, 0.25, 0.32, 0.28, r.terracotta);
      b(x + 0.46, 4.35, 1.75, 0.35, 0.3, 0.34, r.leaf);
    }
    b(5.48, 3, 2.15, 0.08, 6, 0.08, r.dark);
  }
  b(5.7, 1.6, 2.17, 0.13, 3.2, 0.65, r.cream);
  b(5.7, 1.3, -0.08, 0.09, 2.6, 0.12, r.cream);
}
