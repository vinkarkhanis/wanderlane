import * as THREE from "three";
import { terrainHeight } from "./heightfield.js";
import { random } from "./random.js";
import { ROAD } from "./config.js";
export function makeTerrain(path, index, biome, res) {
  const start = index * ROAD.chunk,
    z0 = path.zAt(start),
    z1 = path.zAt(start + ROAD.chunk),
    pos = [],
    col = [],
    idx = [],
    p = {};
  const nx = 64,
    nz = 20,
    color = new THREE.Color();
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = -600 + (i * 1200) / nx,
        z = z0 + ((z1 - z0) * j) / nz;
      path.findNearestRoadPoint(x, z, p);
      const y = terrainHeight(path, p.distance, p.offset, biome) - 0.22;
      pos.push(x, y, z);
      color.copy(res.ground.color);
      const v =
        Math.sin(x * 0.034 + z * 0.021) * 0.025 +
        Math.sin(x * 0.011 - z * 0.031) * 0.035;
      color.offsetHSL(0, 0, v);
      col.push(color.r, color.g, color.b);
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, res.terrain);
  mesh.receiveShadow = true;
  // Sample the actual terrain triangles, so grass and trunks never hover over a slope.
  mesh.userData.heightAt = (x, z) => {
    const gx = Math.max(0, Math.min(nx - 0.0001, ((x + 600) * nx) / 1200));
    const gz = Math.max(0, Math.min(nz - 0.0001, ((z - z0) * nz) / (z1 - z0)));
    const ix = Math.floor(gx),
      iz = Math.floor(gz),
      fx = gx - ix,
      fz = gz - iz,
      a = iz * (nx + 1) + ix;
    const y00 = pos[a * 3 + 1],
      y10 = pos[(a + 1) * 3 + 1],
      y01 = pos[(a + nx + 1) * 3 + 1],
      y11 = pos[(a + nx + 2) * 3 + 1];
    return fx + fz <= 1
      ? y00 * (1 - fx - fz) + y10 * fx + y01 * fz
      : y11 * (fx + fz - 1) + y01 * (1 - fx) + y10 * (1 - fz);
  };
  return mesh;
}
export function makeScenery(path, index, biome, res, quality, groundHeight) {
  const group = new THREE.Group(),
    r = random(path.hash ^ Math.imul(index, 2654435761)),
    start = index * ROAD.chunk;
  const trunks = [],
    crowns = [],
    rocks = [],
    grass = [],
    flowers = [],
    trees = [[], [], []],
    shrubs = [];
  const sample = {},
    density = biome === "desert" ? 0.42 : biome === "canyon" ? 0.55 : 1;
  const ground = (x, z, s, off) =>
    groundHeight
      ? groundHeight(x, z)
      : terrainHeight(path, s, off, biome) - 0.22;
  // Groves share centres, with occasional solitary trees between them.
  const groves = Array.from({ length: 6 }, () => ({
    s: start + 18 + r() * 124,
    off: (r() < 0.5 ? -1 : 1) * (20 + r() * 85),
  }));
  for (let i = 0; i < quality.trees * density; i++) {
    const grove = groves[i % groves.length],
      s = Math.max(
        start + 1,
        Math.min(start + 159, grove.s + (r() - 0.5) * 48),
      );
    const off = grove.off + (r() - 0.5) * 34,
      p = path.getLanePosition(s, off);
    path.findNearestRoadPoint(p.x, p.z, sample);
    if (Math.abs(sample.offset) < 12) continue;
    const h = ground(p.x, p.z, s, off),
      scale = (0.72 + r() * 0.55) * (biome === "canyon" ? 0.57 : 1),
      yaw = r() * 6.28;
    if (biome === "desert") {
      trunks.push([
        p.x,
        h + 2 * scale,
        p.z,
        0.48 * scale,
        4 * scale,
        0.48 * scale,
        yaw,
      ]);
      for (const side of [-1, 1])
        crowns.push([
          p.x + side * 0.65 * scale,
          h + (2.3 + side * 0.4) * scale,
          p.z,
          0.26 * scale,
          1.7 * scale,
          0.26 * scale,
          yaw,
        ]);
    } else
      trees[i % 3].push([
        p.x,
        h - 0.025,
        p.z,
        scale * (0.9 + r() * 0.2),
        scale,
        scale,
        yaw,
        (r() - 0.5) * 0.065,
      ]);
    if (i % 4 === 0)
      rocks.push([
        p.x + 3,
        h + 0.25,
        p.z + 1,
        0.6 + r(),
        0.4 + r() * 0.6,
        0.6 + r(),
        yaw,
      ]);
    if (biome === "meadow" || biome === "canyon")
      shrubs.push([
        p.x + 2,
        h - 0.03,
        p.z - 1,
        0.17 + r() * 0.13,
        0.16 + r() * 0.08,
        0.2 + r() * 0.12,
        yaw,
      ]);
  }
  if (biome === "desert") {
    res.instances(group, res.trunk, res.cactus, trunks);
    res.instances(group, res.trunk, res.cactus, crowns);
  } else
    ["oak", "birch", "field"].forEach((key, i) => {
      res.instances(group, res[key + "Wood"], res.bark, trees[i], true);
      res.instances(group, res[key + "Leaves"], res.leaf, trees[i], true);
    });
  res.instances(group, res.fieldLeaves, res.leaf, shrubs);
  const grassDensity =
    biome === "snow"
      ? 0.055
      : biome === "desert"
        ? 0.19
        : biome === "canyon"
          ? 0.38
          : 1;
  for (let i = 0; i < quality.grass * grassDensity; i++) {
    const s = start + r() * ROAD.chunk,
      side = r() < 0.5 ? -1 : 1,
      off = side * (6.15 + Math.pow(r(), 1.8) * 44),
      p = path.getLanePosition(s, off);
    path.findNearestRoadPoint(p.x, p.z, sample);
    if (Math.abs(sample.offset) < 6.15) continue;
    const patch =
      Math.sin(s * 0.13 + off * 0.32) * Math.sin(s * 0.037 - off * 0.41);
    if (r() > 0.74 + patch * 0.24) continue;
    const h = ground(p.x, p.z, s, off),
      height = (0.48 + r() * 0.7) * (Math.abs(off) < 8 ? 0.6 : 1);
    grass.push([
      p.x,
      h - 0.025,
      p.z,
      0.75 + r() * 0.8,
      height,
      0.75 + r() * 0.8,
      r() * 6.28,
    ]);
    if (biome === "meadow" && patch > 0.25 && i % 13 === 0)
      flowers.push([p.x, h + 0.23 * height, p.z, 0.035, 0.045, 0.035, 0]);
  }
  res.instances(group, res.grassBlades, res.grass, grass);
  res.instances(group, res.crown, res.flower, flowers);
  res.instances(group, res.rock, res.stone, rocks);
  // Distant formations are low-detail, instanced, and hidden by atmospheric fog at recycling boundaries.
  const hills = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const s = start + i * 40,
        p = path.getLanePosition(s, side * (240 + r() * 180));
      hills.push([
        p.x,
        terrainHeight(path, s, side * 240, biome),
        p.z,
        65 + r() * 65,
        (biome === "snow" ? 90 : biome === "canyon" ? 65 : 35) + r() * 30,
        70 + r() * 45,
        r(),
      ]);
    }
  res.instances(
    group,
    biome === "canyon" || biome === "desert" ? res.mesa : res.rock,
    res.distant,
    hills,
  );
  if (biome === "meadow" && index % 7 === 0) {
    const p = path.getLanePosition(start + 80, -50),
      y = terrainHeight(path, start + 80, -50, biome);
    res.instances(group, res.box, res.barn, [
      [p.x, y + 2.8, p.z, 8, 5.6, 12, p.heading],
    ]);
    res.instances(group, res.roof, res.timber, [
      [p.x, y + 6.2, p.z, 6, 3, 8, p.heading],
    ]);
  }
  return group;
}
