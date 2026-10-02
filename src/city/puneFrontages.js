import * as THREE from "three";
import { frontagePoint } from "./puneFrontagePlan.js";

export function frontageMaterials() {
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.87 });
  const materials = {
    plaster: mat(0xd3c4a6),
    stone: mat(0x706d66),
    frame: mat(0x3e514e),
    glass: mat(0x314b53),
    terracotta: mat(0xa65b43),
    teal: mat(0x38776e),
    cream: mat(0xe4d5ac),
    shutter: mat(0x7b8b87),
    leaf: mat(0x597c55),
    interior: new THREE.MeshStandardMaterial({
      color: 0xb9a47b,
      emissive: 0xd5ad65,
      emissiveIntensity: 0.22,
      roughness: 0.9,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: 0xffe6ac,
      emissive: 0xffd48a,
      emissiveIntensity: 0.8,
    }),
  };
  const labels = [
    ["सह्याद्री किराणा", "SAHYADRI GROCERS"],
    ["सकाळ चहा", "CHAI & SNACKS"],
    ["फुलांची बाग", "FLOWERS"],
    ["सायकल दुरुस्ती", "CYCLE REPAIRS"],
    ["सह्याद्री सोसायटी", "SAHYADRI SOCIETY"],
    ["आनंद निवास", "ANAND NIWAS"],
  ];
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const c = canvas.getContext("2d");
  labels.forEach(([mr, en], i) => {
    const y = i * 128;
    c.fillStyle = [
      "#8a4334",
      "#315f59",
      "#715e3c",
      "#3b555e",
      "#786343",
      "#465e56",
    ][i];
    c.fillRect(0, y, 1024, 128);
    c.strokeStyle = "#d8be83";
    c.lineWidth = 5;
    c.strokeRect(9, y + 7, 1006, 114);
    c.fillStyle = "#f8e8bd";
    c.textAlign = "center";
    c.font = 'bold 64px "Nirmala UI", sans-serif';
    c.fillText(mr, 512, y + 67, 950);
    c.font = "bold 26px Arial";
    c.fillText(en, 512, y + 106, 950);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  materials.sign = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  return { materials, textures: [texture] };
}

export function renderFrontages(plan, quality, block, add, shared, res) {
  for (const p of plan) {
    const yaw = Math.atan2(-p.tz, p.tx);
    const b = (u, y, v, w, h, d, m) => {
      const q = frontagePoint(p, u, v);
      block(q[0], p.y + y, q[1], w, h, d, yaw, m);
    };
    const body = p.seed % 2 ? res.plaster : res.cream;
    const accent = p.seed % 2 ? res.teal : res.terracotta;
    // A continuous ground floor and inset-looking dark openings break the
    // repeated window atlas at pedestrian height. Canopies stay above cars.
    b(0, 1.55, 0.1, p.width, 3.1, 0.18, body);
    b(0, 0.2, 0.14, p.width, 0.4, 0.24, res.stone);
    b(0, 3.3, 0.2, p.width + 0.2, 0.22, 0.4, body);
    if (p.apron)
      b(0, 0.035, p.apron / 2, p.width, 0.07, p.apron, shared.forecourt);
    const count = Math.max(1, Math.floor(p.width / (p.retail ? 3.5 : 5)));
    const bay = p.width / count;
    for (let i = 0; i < count; i++) {
      const u = -p.width / 2 + bay * (i + 0.5);
      if (p.retail) {
        b(u, 1.35, 0.22, bay - 0.4, 2.3, 0.12, res.interior);
        // Open retail display: a raised shutter, stocked shelves and a low
        // side counter instead of a full-height dark pane or closed shutter.
        b(u, 2.64, 0.35, bay - 0.4, 0.2, 0.2, res.shutter);
        b(u, 2.43, 0.52, bay * 0.65, 0.07, 0.12, res.lamp);
        for (const shelfY of [0.8, 1.5]) {
          b(u + bay * 0.16, shelfY, 0.42, bay * 0.44, 0.07, 0.24, res.frame);
          for (let j = 0; j < 3; j++)
            b(
              u + bay * (0.02 + j * 0.13),
              shelfY + 0.17,
              0.43,
              bay * 0.08,
              0.26,
              0.16,
              j % 2 ? res.terracotta : res.cream,
            );
        }
        b(u + bay * 0.18, 0.43, 0.74, bay * 0.42, 0.86, 0.48, accent);
        b(u + bay * 0.18, 0.9, 0.74, bay * 0.45, 0.08, 0.54, res.cream);
        b(u - bay * 0.28, 1.2, 0.3, bay * 0.23, 2, 0.035, res.glass);
        b(u - bay * 0.43, 1.4, 0.3, 0.12, 2.65, 0.18, res.frame);
        b(u, 3.1, 0.68, bay - 0.08, 0.16, 1.28, accent);
        b(u, 2.96, 1.24, bay - 0.08, 0.28, 0.08, accent);
        // Mount the fascia at the awning lip, within the cleared 1.3m apron.
        // A sign against the wall disappears behind the canopy from a car.
        b(u, 3.61, 1.17, bay - 0.12, 0.98, 0.18, res.frame);
        sign(
          p,
          u,
          3.61,
          1.275,
          bay - 0.24,
          0.86,
          (p.seed + i) % 4,
          add,
          res.sign,
        );
      } else {
        b(u, 1.22, 0.24, 1.45, 2.35, 0.14, res.frame);
        b(u, 1.22, 0.33, 1.2, 2.1, 0.06, res.glass);
        b(u, 2.65, 0.55, 2.4, 0.15, 1.1, accent);
        if (i === 0)
          sign(
            p,
            u,
            3.65,
            0.2,
            Math.min(4, bay),
            0.64,
            4 + (p.seed % 2),
            add,
            res.sign,
          );
        // Distinct residential bays: timber shutters, narrow planted ledges,
        // and a low slatted gate. All additions stay in the cleared frontage.
        if (quality !== "Low") {
          for (const side of [-1, 1]) {
            b(u + side * 0.87, 1.55, 0.38, 0.24, 1.35, 0.08, accent);
            for (let h = 1; h <= 2; h += 0.25)
              b(u + side * 0.87, h, 0.44, 0.23, 0.04, 0.03, res.frame);
          }
          if (bay > 3.8) {
            b(u + bay * 0.33, 0.34, 0.66, 0.55, 0.65, 0.55, res.terracotta);
            b(u + bay * 0.33, 0.84, 0.66, 0.65, 0.55, 0.65, res.leaf);
          }
        }
        if (p.apron > 1.2 && i > 0)
          for (let dx = -bay / 2 + 0.25; dx < bay / 2 - 0.25; dx += 0.3)
            b(
              u + dx,
              0.55,
              Math.min(p.apron - 0.2, 2),
              0.07,
              1.1,
              0.08,
              res.frame,
            );
      }
    }
    // Restrained cornices and vertical piers provide relief visible from a car.
    const floors = Math.min(
      quality === "Low" ? 3 : 7,
      Math.floor(p.height / 3.1),
    );
    for (let floor = 1; floor <= floors; floor++) {
      if (floor * 3.1 + 0.2 >= p.height) break;
      b(0, floor * 3.1, 0.12, p.width, 0.16, 0.24, body);
      if (!p.retail && floor > 1 && quality !== "Low") {
        for (let u = -p.width / 2 + 2; u < p.width / 2 - 1; u += 4.5) {
          b(u, floor * 3.1 + 0.2, 0.66, 2.6, 0.14, 1.2, body);
          b(u, floor * 3.1 + 0.65, 1.2, 2.6, 0.8, 0.06, accent);
          if ((p.seed + floor) % 3 === 0) {
            b(
              u + 0.8,
              floor * 3.1 + 0.82,
              0.9,
              0.45,
              0.3,
              0.35,
              res.terracotta,
            );
            b(u + 0.8, floor * 3.1 + 1.07, 0.9, 0.5, 0.25, 0.4, res.leaf);
          }
        }
      }
    }
    for (const u of [-p.width / 2 + 0.12, p.width / 2 - 0.12])
      b(
        u,
        Math.min(p.height, 21) / 2,
        0.14,
        0.24,
        Math.min(p.height, 21),
        0.28,
        body,
      );
  }
}
function sign(p, u, y, v, width, height, index, add, material) {
  const q = frontagePoint(p, u, v),
    g = new THREE.PlaneGeometry(width, height);
  g.rotateY(Math.atan2(p.nx, p.nz));
  g.translate(q[0], p.y + y, q[1]);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (5 - index + uv.getY(i)) / 6);
  add(g, material);
}
