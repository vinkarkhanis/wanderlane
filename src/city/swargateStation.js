import * as THREE from "three";
import { nearest } from "./spatial.js";
import {
  SWARGATE,
  stationFrame,
  stationPoint,
  stationBusPlan,
  stationLevel,
  stationPad,
  stationPadCell,
} from "./swargatePlan.js";

export function stationMaterials() {
  const make = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      ...extra,
    });
    m.userData.station = true;
    return m;
  };
  return {
    stationCream: make(0xc6b58c),
    stationRoof: make(0x6f6558),
    stationRed: make(0xa92f28),
    stationBlue: make(0x466875),
    stationYellow: make(0xd8af38),
    stationWhite: make(0xdad4bc),
    stationGlass: make(0x253a3c, { roughness: 0.28, metalness: 0.2 }),
    stationSkin: make(0x9c7258),
    stationShirt: make(0x6c8994),
    stationSari: make(0xa54765),
    stationDark: make(0x323c3a),
  };
}

function textBoard(
  lines,
  width,
  height,
  add,
  owned,
  p,
  yaw,
  background = "#efd05d",
) {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#6c4d2b";
  ctx.lineWidth = 15;
  ctx.strokeRect(10, 10, 2028, 492);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [i, line] of lines.entries()) {
    ctx.font = `${i === 1 ? "bold 176" : "bold 78"}px "Nirmala UI", "Mangal", sans-serif`;
    ctx.fillStyle = i === 1 ? "#922b26" : "#343b38";
    ctx.fillText(line, 1024, [85, 258, 421][i], 1940);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({
    map: texture,
    side: THREE.DoubleSide,
    roughness: 0.8,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.18,
  });
  owned.push(texture, m);
  const g = new THREE.PlaneGeometry(width, height);
  g.rotateY(yaw);
  g.translate(p.x, p.y, p.z);
  add(g, m);
}

// A reference-based approximation on the mapped terminal site, not a surveyed replica.
export function renderSwargate(
  data,
  path,
  height,
  block,
  add,
  res,
  owned,
  quality,
) {
  const frame = stationFrame(path.manifest.origin);
  if (
    Math.floor(frame.x / 256) !== data.x / 256 ||
    Math.floor(frame.z / 256) !== data.z / 256
  )
    return null;
  const y = height(frame.x, frame.z);
  const b = (x, h, z, w, t, d, m = res.stationCream) => {
    const p = stationPoint(frame, x, z);
    block(p.x, y + h, p.z, w, t, d, frame.yaw, m);
  };
  // Broad worn apron, low platforms, column-supported canopy and ticket rooms.
  const padBounds = stationPad(path.manifest.origin);
  for (let x = padBounds[0] + 1.5; x < padBounds[2]; x += 3)
    for (let z = padBounds[1] + 1.5; z < padBounds[3]; z += 3) {
      const cell = stationPadCell(path, x, z);
      if (!cell) continue;
      const bottom = height(cell.x, cell.z) + 0.005;
      block(
        cell.x,
        bottom + 0.025,
        cell.z,
        cell.width,
        0.05,
        cell.depth,
        0,
        res.forecourt,
      );
    }
  b(0, 0.2, -3, 76, 0.4, 12, res.pavement);
  b(0, 1.7, -8, 75, 3.4, 1.1);
  b(0, 4.65, -2, 80, 0.28, 15, res.stationRoof);
  b(0, 4.48, 5.3, 80, 0.42, 0.3, res.stationYellow);
  for (let x = -37; x <= 38; x += 6.2) {
    b(x, 2.27, 3.9, 0.33, 4.5, 0.33, res.stationCream);
    b(x, 4.88, -2, 0.1, 0.14, 15.3, res.trim);
    b(x, 0.85, -6, 3.7, 1.1, 0.1, res.stationGlass);
    b(x, 1.95, -7.35, 1.6, 1.4, 0.12, res.stationGlass);
    b(x, 1.1, -7.1, 1.9, 0.15, 0.45, res.stationWhite);
    b(x, 0.65, -2.5, 3.3, 0.14, 0.65, res.stationDark);
    for (const dx of [-1.25, 1.25])
      b(x + dx, 0.35, -2.5, 0.1, 0.6, 0.6, res.trim);
  }
  // The large yellow Marathi board and open bus bays are the identifying features.
  const sign = stationPoint(frame, -5, 5.55);
  textBoard(
    [
      "महाराष्ट्र राज्य मार्ग परिवहन महामंडळ",
      "स्वारगेट बस स्थानक",
      "SWARGATE BUS STATION · PUNE",
    ],
    35,
    5.2,
    add,
    owned,
    { ...sign, y: y + 7.45 },
    frame.yaw,
  );
  for (const x of [-21, 11]) b(x, 6.8, 5.3, 0.16, 4.6, 0.2, res.stationDark);
  const buses = stationBusPlan(path);
  for (const bus of buses) {
    const co = Math.cos(bus.yaw),
      si = Math.sin(bus.yaw),
      by = height(bus.x, bus.z) + 0.055;
    const busBox = (x, h, z, w, t, d, m) =>
      block(
        bus.x + x * co + z * si,
        by + h,
        bus.z - x * si + z * co,
        w,
        t,
        d,
        bus.yaw,
        m,
      );
    const paint = bus.i === 1 ? res.stationBlue : res.stationRed;
    busBox(0, 1.05, 0, 2.5, 1.45, 10.4, paint);
    busBox(0, 2.25, 0, 2.42, 0.95, 10.1, res.stationGlass);
    busBox(0, 2.87, 0, 2.53, 0.3, 10.55, paint);
    busBox(0, 1.53, 0, 2.54, 0.24, 10.5, res.stationWhite);
    busBox(0, 0.56, 5.27, 2.4, 0.17, 0.14, res.stationDark);
    busBox(0, 2.95, 0, 1.7, 0.12, 7.4, res.stationRoof);
    for (const z of [-4, -2.7, -1.4, -0.1, 1.2, 2.5, 3.8])
      busBox(0, 2.23, z, 2.5, 1.05, 0.07, paint);
    busBox(0.8, 1.9, 4.35, 0.8, 1.95, 1.2, res.stationDark);
    for (const x of [-0.94, 0.94])
      busBox(x, 0.92, 5.3, 0.35, 0.25, 0.08, res.stationWhite);
    for (const x of [-1.24, 1.24])
      for (const z of [-3.3, 3.45]) {
        const g = new THREE.CylinderGeometry(0.49, 0.49, 0.24, 12);
        g.rotateZ(Math.PI / 2);
        g.rotateY(bus.yaw);
        g.translate(
          bus.x + x * co + z * si,
          by + 0.52,
          bus.z - x * si + z * co,
        );
        add(g, res.rubber);
        busBox(x * 1.02, 0.52, z, 0.08, 0.4, 0.4, res.trim);
      }
    const p = stationPoint(frame, -30 + bus.i * 12, 5.6);
    textBoard(
      [
        "फलाट / PLATFORM",
        String(bus.i + 1).padStart(2, "0"),
        ["SATARA", "MUMBAI", "KOLHAPUR", "SANGli", "SOLAPUR", "BARAmATI"][
          bus.i
        ].toUpperCase(),
      ],
      3.4,
      1.1,
      add,
      owned,
      { ...p, y: y + 3.6 },
      frame.yaw,
    );
  }
  // A second sheltered wing and the entrance booth give the yard depth.
  b(53, 2.05, -42, 22, 4.1, 7);
  b(53, 4.2, -42, 25, 0.3, 10, res.stationRoof);
  b(-26, 1.6, 27, 4.4, 3.2, 3.6, res.stationCream);
  b(-26, 3.25, 27, 5.2, 0.22, 4.3, res.stationRoof);
  for (const x of [-25, 49]) {
    b(x, 1.5, 37, 0.65, 3, 0.65, res.stationCream);
    b(x, 3.05, 37, 1.05, 0.16, 1.05, res.stationYellow);
  }
  // A high, road-facing gateway sign remains visible from the public approach.
  const entry = stationPoint(frame, -28, 34);
  textBoard(
    ["राज्य परिवहन", "SWARGATE", "BUS STATION  →"],
    8.5,
    2.7,
    add,
    owned,
    { ...entry, y: y + 5.7 },
    Math.PI,
  );
  b(-28, 3, 34, 0.2, 6, 0.2, res.stationDark);
  const people = quality === "Low" ? 12 : 26;
  for (let i = 0; i < people; i++) {
    const x = -33 + (i % 13) * 5.4,
      z = (i < 13 ? 0.7 : 7.3) + (i % 3) * 0.4;
    const p = stationPoint(frame, x, z),
      h = y + (z < 3.4 ? 0.4 : 0.055);
    const shirt =
      i % 3 === 0
        ? res.stationSari
        : i % 3 === 1
          ? res.stationShirt
          : res.stationWhite;
    block(p.x, h + 1.06, p.z, 0.43, 0.64, 0.28, frame.yaw, shirt);
    for (const side of [-1, 1])
      block(
        p.x + side * 0.11,
        h + 0.4,
        p.z,
        0.15,
        0.8,
        0.2,
        0,
        res.stationDark,
      );
    const g = new THREE.SphereGeometry(0.16, 8, 6);
    g.scale(1, 1.13, 1);
    g.translate(p.x, h + 1.56, p.z);
    add(g, res.stationSkin);
    if (i % 2 === 0)
      block(p.x + 0.38, h + 0.28, p.z, 0.35, 0.55, 0.3, 0, res.stationDark);
  }
  // Small tea/snack kiosk, litter bins, bay hatching and platform curb paint.
  b(40, 1.25, -4, 3.8, 2.5, 3.4, res.stationCream);
  b(40, 2.6, -3, 4.5, 0.16, 5, res.stationRed);
  for (let x = -37; x < 38; x += 2.2)
    b(
      x,
      0.34,
      3.0,
      1.1,
      0.3,
      0.15,
      Math.round((x + 37) / 2.2) % 2 ? res.stationYellow : res.stationDark,
    );
  for (const x of [-33, 0, 35]) b(x, 0.6, 0, 0.5, 1.2, 0.5, res.stationBlue);
  for (let i = 0; i < 8; i++) {
    const p = stationPoint(frame, -40 + i * 13, -73 - (i % 2) * 3);
    if (
      [...path.grid.query(p.x, p.z, 12)].some(
        (r) => nearest([p.x, p.z], r.p, r.q).d < r.width / 2 + 5,
      )
    )
      continue;
    if (
      data.buildings.some(
        (b) =>
          p.x > b.bounds[0] - 4 &&
          p.x < b.bounds[2] + 4 &&
          p.z > b.bounds[1] - 4 &&
          p.z < b.bounds[3] + 4,
      )
    )
      continue;
    for (const [geometry, material] of [
      [res.oakWood, res.bark],
      [res.oakLeaves, res.stationLeaf],
    ]) {
      const g = geometry.clone();
      g.scale(0.9, 0.9, 0.9);
      g.rotateY(i * 1.7);
      g.translate(p.x, height(p.x, p.z), p.z);
      add(g, material);
    }
  }
  return {
    id: SWARGATE.id,
    name: SWARGATE.name,
    buses: buses.length,
    passengers: people,
    sourceWays: SWARGATE.sourceWays,
    sign: "स्वारगेट बस स्थानक",
    entranceY: stationLevel(path, height),
    pad: { bounds: stationPad(path.manifest.origin), groundOffset: 0.055 },
  };
}
