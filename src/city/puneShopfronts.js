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
    };
  }
  if (i >= 10)
    return {
      x: -4.75 + (i - 10) * 1.9 + 0.3,
      z: 1.5,
      yaw: Math.PI,
      moving: false,
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

export function shopfronts(b, r) {
  b(0, -0.06, -0.35, 11.4, 0.12, 7.4, r.cream);
  b(0, 0.08, -4.05, 11.4, 0.16, 0.18, r.ochre);
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
          [r.terracotta, r.teal, r.cream, r.orange, r.leaf][(i + j) % 5],
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
  }
  b(5.7, 1.6, 2.17, 0.13, 3.2, 0.65, r.cream);
  b(5.7, 1.3, -0.08, 0.09, 2.6, 0.12, r.cream);
}
