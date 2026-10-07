import * as THREE from "three";
import { panel } from "./carGeometry.js";

// Metre-scale authored profiles; +Z is the nose. Roof glass is separate from
// the coachwork, with a real cabin aperture rather than a tinted solid box.
export function buildCoachwork(spec, art) {
  const { mesh, box, tube, paint, trim, alloy, glass, head, tail, material } =
    art;
  const { width: w, length: l, height: h, radius: r, kind } = spec;
  const truck = kind === "truck",
    suv = kind === "suv",
    hatch = kind === "hatch";
  const belt = truck || suv ? 1.12 : 0.91;
  const roof = h - 0.035;
  const frontBase = truck ? 1.28 : hatch ? 0.83 : suv ? 1.04 : 1.08;
  const frontTop = truck ? 0.78 : hatch ? 0.2 : suv ? 0.45 : 0.24;
  const rearBase = truck ? -0.66 : hatch ? -1.61 : suv ? -1.86 : -1.46;
  const rearTop = truck ? -0.54 : hatch ? -1.17 : suv ? -1.45 : -0.88;
  const roofWidth = w * (truck || suv ? 0.395 : 0.35),
    beltWidth = w * 0.455;
  const sections = [
    [-l / 2, w * 0.39, r * 0.92, belt - 0.12],
    [-l / 2 + 0.17, w * 0.47, r * 0.68, belt - 0.035],
    [spec.physics.axles[0], w * 0.49, r * 0.61, belt + 0.025],
    [-0.35, w * 0.48, r * 0.67, belt],
    [0.55, w * 0.48, r * 0.67, belt],
    [spec.physics.axles[1], w * 0.49, r * 0.68, belt - 0.015],
    [l / 2 - 0.18, w * 0.45, r * 0.92, belt - 0.14],
    [l / 2, w * 0.38, r * 1.14, belt - 0.22],
  ].sort((a, b) => a[0] - b[0]);
  const curves = [1, 2, 3].map(
    (key) =>
      new THREE.CatmullRomCurve3(
        sections.map((s) => new THREE.Vector3(s[0], s[key], 0)),
        false,
        "catmullrom",
        0.15,
      ),
  );
  const positions = [],
    indices = [],
    rings = 128,
    sides = 40;
  for (let j = 0; j <= rings; j++) {
    const values = curves.map((c) => c.getPoint(j / rings));
    const z = values[0].x,
      width = values[0].y,
      top = values[2].y;
    let bottom = values[1].y;
    for (const axle of spec.physics.axles) {
      const dz = z - axle,
        arch = r + 0.085;
      if (Math.abs(dz) < arch)
        bottom = Math.max(bottom, r + Math.sqrt(arch ** 2 - dz ** 2));
    }
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2,
        s = Math.sin(angle),
        c = Math.cos(angle);
      positions.push(
        width * Math.sign(s) * Math.abs(s) ** 0.48,
        (top + bottom) / 2 +
          ((top - bottom) / 2) * Math.sign(c) * Math.abs(c) ** 0.5,
        z,
      );
    }
  }
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i,
        b = j * sides + ((i + 1) % sides);
      const z = (positions[a * 3 + 2] + positions[(a + sides) * 3 + 2]) / 2;
      const x = (positions[a * 3] + positions[b * 3]) / 2,
        y = (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2;
      const cabin =
        z > rearBase &&
        z < frontBase &&
        Math.abs(x) < beltWidth * 0.96 &&
        y > belt - 0.05;
      const bed =
        truck &&
        z < rearBase - 0.04 &&
        z > -l / 2 + 0.13 &&
        Math.abs(x) < w * 0.41 &&
        y > belt - 0.12;
      if (!cabin && !bed)
        indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  for (const row of [0, rings]) {
    const start = row * sides,
      centre = positions.length / 3;
    positions.push(
      0,
      (positions[start * 3 + 1] + positions[(start + sides / 2) * 3 + 1]) / 2,
      positions[start * 3 + 2],
    );
    for (let i = 0; i < sides; i++)
      row === 0
        ? indices.push(centre, start + i, start + ((i + 1) % sides))
        : indices.push(centre, start + ((i + 1) % sides), start + i);
  }
  const bodyGeometry = new THREE.BufferGeometry();
  bodyGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  bodyGeometry.setIndex(indices);
  bodyGeometry.computeVertexNormals();
  mesh(bodyGeometry, paint, 0, 0, 0);

  const windows = [];
  const glazing = (points) => {
    const obj = mesh(panel(points), glass, 0, 0, 0);
    windows.push(obj);
    return obj;
  };
  glazing([
    [-beltWidth, belt, frontBase],
    [-roofWidth, roof - 0.07, frontTop],
    [roofWidth, roof - 0.07, frontTop],
    [beltWidth, belt, frontBase],
  ]);
  glazing([
    [-beltWidth, belt, rearBase],
    [beltWidth, belt, rearBase],
    [roofWidth, roof - 0.07, rearTop],
    [-roofWidth, roof - 0.07, rearTop],
  ]);
  // Crown the roof with a shallow double curvature, not a flat slab.
  const roofGeometry = new THREE.PlaneGeometry(
    roofWidth * 2 + 0.065,
    frontTop - rearTop + 0.08,
    20,
    24,
  );
  roofGeometry.rotateX(-Math.PI / 2);
  const p = roofGeometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      length = (frontTop - rearTop + 0.08) / 2;
    p.setXYZ(
      i,
      x,
      roof -
        0.045 +
        0.035 * (1 - (x / (roofWidth + 0.033)) ** 2) +
        0.016 * (1 - (z / length) ** 2),
      z + (frontTop + rearTop) / 2,
    );
  }
  roofGeometry.computeVertexNormals();
  mesh(roofGeometry, paint, 0, 0, 0);
  const split = truck ? -0.12 : -0.42;
  for (const side of [-1, 1]) {
    const b = side * beltWidth,
      t = side * roofWidth;
    glazing([
      [b, belt, frontBase - 0.03],
      [t, roof - 0.075, frontTop - 0.035],
      [t, roof - 0.075, split + 0.035],
      [b, belt, split + 0.035],
    ]);
    glazing([
      [b, belt, split - 0.04],
      [t, roof - 0.075, split - 0.04],
      [t, roof - 0.075, rearTop + 0.025],
      [b, belt, rearBase + 0.045],
    ]);
    tube(
      [
        [b, belt, frontBase],
        [
          (side * (beltWidth + roofWidth)) / 2,
          (belt + roof) / 2,
          (frontBase + frontTop) / 2,
        ],
        [t, roof - 0.025, frontTop],
      ],
      0.035,
      paint,
    );
    tube(
      [
        [b, belt, rearBase],
        [
          (side * (beltWidth + roofWidth)) / 2,
          (belt + roof) / 2,
          (rearBase + rearTop) / 2,
        ],
        [t, roof - 0.025, rearTop],
      ],
      truck ? 0.07 : 0.055,
      paint,
    );
    tube(
      [
        [b, belt, split],
        [t, roof - 0.035, split],
      ],
      0.027,
      trim,
    );
    tube(
      [
        [t, roof - 0.026, rearTop],
        [t, roof + 0.003, (rearTop + frontTop) / 2],
        [t, roof - 0.026, frontTop],
      ],
      0.024,
      paint,
    );
    tube(
      [
        [b, belt + 0.01, rearBase],
        [b, belt + 0.012, split],
        [b, belt + 0.01, frontBase],
      ],
      0.012,
      alloy,
    );
    // Door cuts, flush handles, wing mirror and contrasting rocker sill.
    for (const z of truck ? [split] : [split, rearBase + 0.08]) {
      tube(
        [
          [side * w * 0.482, r * 0.76, z],
          [side * w * 0.484, belt - 0.1, z],
          [b, belt, z],
        ],
        0.006,
        trim,
      );
      box(
        0.023,
        0.036,
        0.19,
        alloy,
        side * w * 0.488,
        belt - 0.115,
        z + 0.17,
        0.015,
      );
    }
    box(
      0.09,
      0.095,
      frontBase - rearBase - 0.16,
      trim,
      side * w * 0.476,
      r * 0.71,
      (frontBase + rearBase) / 2,
      0.03,
    );
    const mirror = box(
      0.19,
      0.105,
      0.27,
      paint,
      side * (w * 0.5 + 0.035),
      belt + 0.21,
      frontBase - 0.17,
      0.05,
    );
    mirror.rotation.y = side * 0.12;
    box(
      0.15,
      0.068,
      0.012,
      alloy,
      side * (w * 0.5 + 0.035),
      belt + 0.212,
      frontBase - 0.308,
      0.015,
    );
    tube(
      [
        [b, belt + 0.05, frontBase - 0.2],
        [side * w * 0.52, belt + 0.16, frontBase - 0.17],
      ],
      0.023,
      trim,
    );
    for (const axle of spec.physics.axles) {
      const points = [];
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI;
        points.push([
          side * w * 0.489,
          r + Math.sin(a) * (r + 0.086),
          axle + Math.cos(a) * (r + 0.086),
        ]);
      }
      tube(points, truck || suv ? 0.032 : 0.014, truck || suv ? trim : paint);
    }
    // Narrow optics with visible projector lenses, DRLs and segmented tails.
    box(
      w * 0.18,
      0.135,
      0.07,
      trim,
      side * w * 0.285,
      belt - 0.17,
      l / 2 - 0.035,
      0.055,
    );
    box(
      w * 0.155,
      0.084,
      0.025,
      head,
      side * w * 0.285,
      belt - 0.157,
      l / 2 + 0.003,
      0.025,
    );
    for (const offset of [-0.065, 0.065]) {
      const lens = mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.028, 16),
        alloy,
        side * w * 0.285 + offset,
        belt - 0.153,
        l / 2 + 0.02,
      );
      lens.rotation.x = Math.PI / 2;
    }
    box(
      w * 0.17,
      0.016,
      0.025,
      head,
      side * w * 0.285,
      belt - 0.105,
      l / 2 + 0.018,
      0.006,
    );
    box(
      truck ? 0.16 : w * 0.18,
      truck ? 0.3 : 0.135,
      0.045,
      trim,
      side * w * (truck ? 0.34 : 0.285),
      belt - 0.14,
      -l / 2 + 0.01,
      0.035,
    );
    for (let i = 0; i < 3; i++)
      box(
        truck ? 0.12 : w * 0.155,
        0.024,
        0.025,
        tail,
        side * w * (truck ? 0.34 : 0.285),
        belt - 0.185 + i * 0.041,
        -l / 2 - 0.019,
        0.01,
      );
    box(
      0.12,
      0.027,
      0.018,
      head,
      side * w * (truck ? 0.34 : 0.285),
      belt - 0.225,
      -l / 2 - 0.02,
      0.005,
    );
    tube(
      [
        [side * w * 0.26, belt - 0.01, frontBase],
        [side * w * 0.25, belt - 0.065, l / 2 - 0.36],
      ],
      0.006,
      paint,
    );
  }
  box(w * 0.54, 0.18, 0.055, trim, 0, belt - 0.24, l / 2 + 0.01, 0.045);
  for (let i = 0; i < 5; i++)
    box(
      w * 0.49,
      0.012,
      0.015,
      alloy,
      0,
      belt - 0.315 + i * 0.035,
      l / 2 + 0.042,
      0.004,
    );
  box(w * 0.8, 0.075, 0.11, trim, 0, r * 0.97, l / 2 - 0.07, 0.035);
  box(
    w * 0.81,
    0.105,
    0.12,
    truck ? alloy : trim,
    0,
    r * 0.92,
    -l / 2 + 0.05,
    0.035,
  );
  box(0.42, 0.1, 0.025, alloy, 0, belt - 0.27, -l / 2 - 0.015, 0.015);
  box(0.065, 0.05, 0.027, alloy, 0, belt - 0.125, -l / 2 - 0.025, 0.012);
  box(
    w * 0.82,
    0.045,
    frontBase - rearBase,
    trim,
    0,
    r + 0.08,
    (frontBase + rearBase) / 2,
    0.025,
  );
  for (const z of truck
    ? [frontTop - 0.38]
    : [frontTop - 0.38, rearBase + 0.68])
    for (const side of [-1, 1]) {
      const seatMat =
        art.seatMaterial || (art.seatMaterial = material(0x292b2e, 0, 0.92));
      box(0.43, 0.12, 0.48, seatMat, side * w * 0.21, r + 0.21, z + 0.07, 0.07);
      const seat = box(
        0.43,
        0.47,
        0.14,
        seatMat,
        side * w * 0.21,
        r + 0.47,
        z - 0.2,
        0.07,
      );
      seat.rotation.x = -0.12;
      box(
        0.26,
        0.16,
        0.105,
        seatMat,
        side * w * 0.21,
        r + 0.77,
        z - 0.23,
        0.04,
      );
    }
  if (hatch || suv) {
    box(w * 0.81, 0.055, 0.17, paint, 0, roof - 0.04, rearTop - 0.04, 0.035);
    tube(
      [
        [-0.16, belt + 0.14, rearBase - 0.015],
        [0.19, belt + 0.18, rearBase - 0.015],
      ],
      0.011,
      trim,
    );
  }
  if (suv || truck)
    for (const side of [-1, 1]) {
      box(
        0.16,
        0.07,
        frontBase - rearBase,
        alloy,
        side * w * 0.49,
        r * 0.76,
        (frontBase + rearBase) / 2,
        0.025,
      );
      if (suv)
        tube(
          [
            [side * w * 0.32, roof + 0.015, rearTop + 0.15],
            [side * w * 0.32, roof + 0.08, rearTop + 0.25],
            [side * w * 0.32, roof + 0.08, frontTop - 0.14],
          ],
          0.026,
          trim,
        );
    }
  if (truck) {
    const bedLength = l / 2 + rearBase - 0.18,
      bedCentre = (-l / 2 + rearBase) / 2;
    box(w * 0.81, 0.055, bedLength, trim, 0, r + 0.3, bedCentre, 0.02);
    for (const side of [-1, 1]) {
      box(
        0.11,
        0.4,
        bedLength,
        paint,
        side * w * 0.446,
        belt - 0.2,
        bedCentre,
        0.05,
      );
      box(
        0.115,
        0.028,
        bedLength,
        trim,
        side * w * 0.446,
        belt + 0.01,
        bedCentre,
        0.01,
      );
    }
    box(w * 0.86, 0.41, 0.1, paint, 0, belt - 0.19, -l / 2 + 0.08, 0.035);
    box(0.26, 0.05, 0.028, trim, 0, belt - 0.1, -l / 2 + 0.018, 0.01);
    for (let i = 0; i < 7; i++)
      box(
        0.018,
        0.014,
        bedLength - 0.07,
        alloy,
        (i - 3) * w * 0.1,
        r + 0.336,
        bedCentre,
        0.005,
      );
  }
  return {
    windows,
    roof,
    cabinZ: (frontTop + rearTop) / 2,
    cockpitAnchor: [-0.34, roof - 0.2, (frontTop + rearTop) / 2 - 0.14],
  };
}
