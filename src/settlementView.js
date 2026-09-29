import * as THREE from "three";
import { renderFrontages } from "./city/puneFrontages.js";

export function buildSettlement(plan, res, materials, quality) {
  const group = new THREE.Group(),
    parts = new Map(),
    geometries = [];
  const block = (x, y, z, w, h, d, yaw, m) => {
    if (!parts.has(m)) parts.set(m, []);
    parts.get(m).push([x, y, z, w, h, d, yaw]);
  };
  const frontages = [];
  for (const p of plan) {
    const yaw = Math.atan2(-p.tz, p.tx),
      body = p.seed % 2 ? materials.cream : materials.plaster;
    const b = (u, y, v, w, h, d, m) =>
      block(
        p.x + p.tx * u + p.nx * v,
        p.y + y,
        p.z + p.tz * u + p.nz * v,
        w,
        h,
        d,
        yaw,
        m,
      );
    block(
      p.x,
      (p.base + p.y) / 2 - 0.08,
      p.z,
      9,
      p.y - p.base + 0.16,
      8,
      yaw,
      materials.stone,
    );
    b(0, p.height / 2, 0, 9, p.height, 8, body);
    b(0, p.height + 0.14, 0, 9.3, 0.28, 8.3, materials.stone);
    for (let floor = 1; floor < p.height / 3; floor++)
      for (const side of [-1, 1]) {
        for (const u of [-2.9, 0, 2.9])
          b(u, floor * 3 + 1.25, side * 4.04, 1.7, 1.7, 0.12, materials.glass);
        b(0, floor * 3, side * 4.12, 9.2, 0.18, 0.4, materials.cream);
      }
    for (let floor = 0; floor < p.height / 3; floor++)
      for (const side of [-1, 1]) {
        for (const v of [-2.5, 0, 2.5]) {
          b(side * 4.54, floor * 3 + 1.5, v, 0.12, 1.55, 1.5, materials.glass);
          b(
            side * 4.65,
            floor * 3 + 2.35,
            v,
            0.35,
            0.12,
            1.85,
            materials.cream,
          );
        }
        b(side * 4.57, floor * 3 + 0.3, 0, 0.2, 0.14, 8.1, materials.cream);
      }
    b(-2, p.height + 0.8, -1, 1.6, 1.3, 1.6, materials.frame);
    frontages.push({
      ...p,
      x: p.x + p.nx * 4,
      z: p.z + p.nz * 4,
      width: 8.8,
      apron: 4,
      family: "shops",
    });
  }
  renderFrontages(
    frontages,
    quality,
    block,
    (g, m) => {
      geometries.push(g);
      const mesh = new THREE.Mesh(g, m);
      group.add(mesh);
    },
    { forecourt: materials.stone },
    materials,
  );
  for (const [material, items] of parts)
    res.instances(group, res.box, material, items, true);
  return { group, geometries };
}
