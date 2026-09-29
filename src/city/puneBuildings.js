import * as THREE from "three";
import { random } from "../random.js";
import { inside, nearest } from "./spatial.js";
import { ARCHETYPES, buildingStyle } from "./puneStyle.js";

// Seven original painted atlases, shared by every chunk; no external textures.
export function buildingMaterials() {
  const palette = [
    "#d2bca0",
    "#d6d6ca",
    "#c6a17d",
    "#dbc49c",
    "#9cafb1",
    "#98988b",
    "#c8c7af",
  ];
  const textures = [];
  const materials = ARCHETYPES.map((family, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const glow = canvas.cloneNode();
    const c = canvas.getContext("2d"),
      n = glow.getContext("2d");
    const rng = random(index + 18652);
    c.fillStyle = palette[index];
    c.fillRect(0, 0, 256, 256);
    n.fillStyle = "#000";
    n.fillRect(0, 0, 256, 256);
    // Fine plaster weathering; restrained, fixed palette within each family.
    for (let i = 0; i < 300; i++) {
      c.fillStyle = `rgba(65,58,44,${rng() * 0.09})`;
      c.fillRect(rng() * 256, rng() * 256, 1 + rng() * 12, 1 + rng() * 18);
    }
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        const x = col * 64,
          y = row * 64,
          wide = ["modern", "office"].includes(family),
          construction = family === "construction";
        const glass = c.createLinearGradient(0, y + 13, 0, y + 45);
        glass.addColorStop(0, "#26383e");
        glass.addColorStop(0.45, "#526369");
        glass.addColorStop(1, "#344147");
        c.fillStyle = construction ? "#4a504d" : glass;
        c.fillRect(x + 12, y + 13, wide ? 43 : 30, 32);
        if (rng() > 0.4) {
          c.fillStyle = ["#8f958d", "#b3ac99", "#777e79"][
            Math.floor(rng() * 3)
          ];
          c.fillRect(x + 14, y + 15, wide ? 18 : 10, 27);
        }
        c.fillStyle = "rgba(13,22,25,.35)";
        c.fillRect(x + 12, y + 13, wide ? 43 : 30, 3);
        if (construction) {
          c.fillStyle = "#b9b8a6";
          c.fillRect(x, y + 52, 64, 9);
          c.fillRect(x + 3, y, 6, 64);
        } else {
          c.fillStyle = wide ? "#b7b8ae" : "#b2a695";
          c.fillRect(x + 8, y + 9, wide ? 50 : 40, 4);
          c.fillRect(x + 8, y + 47, wide ? 50 : 40, 3);
          const stain = c.createLinearGradient(0, y + 50, 0, y + 64);
          stain.addColorStop(0, "rgba(35,32,26,.22)");
          stain.addColorStop(1, "rgba(35,32,26,0)");
          c.fillStyle = stain;
          c.fillRect(x + 9, y + 50, wide ? 48 : 38, 14);
          c.fillStyle = "#535e58";
          for (let g = 0; g < 4; g++) c.fillRect(x + 12 + g * 9, y + 33, 2, 14);
          if (rng() > 0.68) {
            n.fillStyle = ["#dcc17c", "#a58b53", "#eed9a4"][col % 3];
            n.fillRect(x + 12, y + 13, wide ? 43 : 30, 32);
          }
          if (family === "society" || family === "plaster") {
            c.fillStyle = "#a9a18c";
            c.fillRect(x + 7, y + 52, 44, 8);
          }
        }
      }
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: index === 4 ? 0.6 : 0.92,
      map: tex(canvas),
      emissiveMap: tex(glow),
      emissive: 0xffd49a,
      emissiveIntensity: 0,
    });
    function tex(canvas) {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      textures.push(t);
      return t;
    }
  });
  return { materials, textures };
}

// Roof fittings stay inside the source polygon, including courtyards. Repeated
// blocks are merged with the existing chunk batches rather than separate meshes.
export function dressBuilding(b, quality, block, res, path, data) {
  const style = buildingStyle(b),
    rng = random(style.seed),
    top = b.y + b.height;
  const safe = (x, z, r) =>
    inside([x, z], b.outer) &&
    !b.holes.some((h) => inside([x, z], h)) &&
    [b.outer, ...b.holes].every((ring) =>
      ring.every(
        (p, i) => nearest([x, z], p, ring[(i + 1) % ring.length]).d > r,
      ),
    );
  let fittings = 0;
  for (let i = 0; i < (quality === "Low" ? 1 : 3); i++) {
    const x = b.bounds[0] + (b.bounds[2] - b.bounds[0]) * rng(),
      z = b.bounds[1] + (b.bounds[3] - b.bounds[1]) * rng();
    if (!safe(x, z, 2)) continue;
    if (i === 0) {
      block(x, top + 0.65, z, 1.2, 1.3, 1.2, 0, res.trim);
      block(x, top + 1.34, z, 1.35, 0.1, 1.35, 0, res.trim);
    } else {
      block(x, top + 0.3, z, 2.2, 0.12, 1.3, 0.2, res.solar);
      block(x, top + 0.7, z + 0.7, 2, 0.6, 0.5, 0, res.roof);
    }
    fittings++;
  }
  // Parapets are inset, avoiding encroachment on adjacent streets or footprints.
  const edges = quality === "Low" ? 4 : 12;
  for (let i = 0; i < Math.min(edges, b.outer.length); i++) {
    const a = b.outer[i],
      q = b.outer[(i + 1) % b.outer.length],
      len = Math.hypot(q[0] - a[0], q[1] - a[1]);
    if (len < 2) continue;
    const x = (a[0] + q[0]) / 2,
      z = (a[1] + q[1]) / 2;
    for (const side of [-1, 1]) {
      const xx = x + ((q[1] - a[1]) / len) * 0.3 * side,
        zz = z - ((q[0] - a[0]) / len) * 0.3 * side;
      if (!safe(xx, zz, 0.12)) continue;
      block(
        xx,
        top + 0.3,
        zz,
        0.18,
        0.6,
        len - 0.6,
        Math.atan2(q[0] - a[0], q[1] - a[1]),
        res.roof,
      );
      break;
    }
  }
  let bays = 0;
  const limit = quality === "Low" ? 4 : quality === "High" ? 28 : 16;
  for (let i = 0; i < b.outer.length && bays < limit; i++) {
    const a = b.outer[i],
      q = b.outer[(i + 1) % b.outer.length],
      dx = q[0] - a[0],
      dz = q[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 6) continue;
    let nx = dz / len,
      nz = -dx / len;
    if (
      inside(
        [(a[0] + q[0]) / 2 + nx * 0.2, (a[1] + q[1]) / 2 + nz * 0.2],
        b.outer,
      )
    ) {
      nx = -nx;
      nz = -nz;
    }
    for (let d = 3; d < len - 2 && bays < limit; d += 5) {
      const x = a[0] + (dx * d) / len + nx * 0.42,
        z = a[1] + (dz * d) / len + nz * 0.42;
      if (
        [...path.grid.query(x, z, 16)].some(
          (r) => nearest([x, z], r.p, r.q).d < r.width / 2 + 2,
        )
      )
        continue;
      if (
        data.buildings.some(
          (o) =>
            o.id !== b.id &&
            x > o.bounds[0] - 1.5 &&
            x < o.bounds[2] + 1.5 &&
            z > o.bounds[1] - 1.5 &&
            z < o.bounds[3] + 1.5,
        )
      )
        continue;
      for (let h = 3; h < b.height - 1 && bays < limit; h += 3.1) {
        const yaw = Math.atan2(dx, dz);
        block(x, b.y + h, z, 0.95, 0.14, 2.8, yaw, res.roof);
        if (["plaster", "society", "modern"].includes(style.family)) {
          block(
            x + nx * 0.42,
            b.y + h + 0.52,
            z + nz * 0.42,
            0.07,
            0.85,
            2.7,
            yaw,
            res.trim,
          );
          if (bays % 5 === 0)
            block(
              x + nx * 0.43,
              b.y + h + 0.55,
              z + nz * 0.43,
              0.08,
              0.55,
              1.2,
              yaw,
              res.solar,
            );
        }
        if (bays % 7 === 0)
          block(x, b.y + h + 1.7, z, 0.5, 0.6, 0.8, yaw, res.roof);
        bays++;
      }
    }
  }
  return fittings;
}
