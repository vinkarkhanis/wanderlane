import * as THREE from "three";
import { ROAD } from "./config.js";
// Mesh strips have shared edge vertices and upward-facing winding.
export function strip(path, start, end, left, right, height = 0, step = 4) {
  const pos = [],
    idx = [];
  const n = Math.ceil((end - start) / step);
  for (let i = 0; i <= n; i++) {
    const p = path.sampleAtDistance(start + ((end - start) * i) / n);
    for (const off of [left, right])
      pos.push(p.x + p.nx * off, p.y + height, p.z + p.nz * off);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export class RoadChunk {
  constructor(path, index, biome, res) {
    this.group = new THREE.Group();
    this.geometries = [];
    const start = index * ROAD.chunk,
      end = start + ROAD.chunk;
    const add = (g, m) => {
      this.geometries.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    add(strip(path, start, end, -5.1, 5.1, -0.025), res.shoulder);
    const asphalt = strip(path, start, end, -4, 4);
    const colors = [];
    for (let i = 0; i < asphalt.attributes.position.count; i++) {
      const v = 0.98 + 0.014 * Math.sin((start + i * 2) * 1.73);
      colors.push(v, v, v);
    }
    asphalt.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    add(asphalt, res.asphalt);
    for (const off of [-3.72, 3.72])
      add(strip(path, start, end, off - 0.065, off + 0.065, 0.015), res.line);
    // One merged dashed strip, rather than a draw call per dash.
    const positions = [],
      indices = [];
    for (let s = start; s < end; s += 12) {
      const g = strip(path, s, Math.min(s + 5, end), -0.055, 0.055, 0.017);
      const base = positions.length / 3;
      positions.push(...g.attributes.position.array);
      for (const i of g.index.array) indices.push(i + base);
      g.dispose();
    }
    const dash = new THREE.BufferGeometry();
    dash.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    dash.setIndex(indices);
    dash.computeVertexNormals();
    add(dash, res.line);
    const posts = [],
      rails = [],
      reflectors = [],
      signs = [];
    for (let s = start; s < end; s += 4) {
      const p = path.sampleAtDistance(s),
        q = path.sampleAtDistance(s + 4);
      if (path.hasRail(s + 2, biome))
        for (const side of [-1, 1]) {
          const x = p.x + p.nx * ROAD.railOffset * side,
            z = p.z + p.nz * ROAD.railOffset * side,
            x2 = q.x + q.nx * ROAD.railOffset * side,
            z2 = q.z + q.nz * ROAD.railOffset * side;
          rails.push([
            (x + x2) / 2,
            (p.y + q.y) / 2 + 0.76,
            (z + z2) / 2,
            0.14,
            0.29,
            Math.hypot(x2 - x, z2 - z) + 0.12,
            Math.atan2(x2 - x, z2 - z),
          ]);
          if (!path.hasRail(s - 2, biome))
            rails.push([x, p.y + 0.76, z, 0.24, 0.33, 0.4, p.heading]);
          if (!path.hasRail(s + 6, biome))
            rails.push([x2, q.y + 0.76, z2, 0.24, 0.33, 0.4, q.heading]);
          posts.push([x, p.y + 0.43, z, 0.12, 0.85, 0.12, p.heading]);
          if (s % 12 === 0)
            reflectors.push([x, p.y + 0.81, z, 0.18, 0.08, 0.1, p.heading]);
        }
      else if (s % 20 === 0)
        for (const side of [-1, 1]) {
          const o = 5.25;
          posts.push([
            p.x + p.nx * o * side,
            p.y + 0.45,
            p.z + p.nz * o * side,
            0.12,
            biome === "snow" ? 1.7 : 0.9,
            0.12,
            p.heading,
          ]);
          reflectors.push([
            p.x + p.nx * o * side,
            p.y + (biome === "snow" ? 1.15 : 0.72),
            p.z + p.nz * o * side,
            0.15,
            0.15,
            0.14,
            p.heading,
          ]);
        }
      if (s % 80 === 0 && path.hasRail(s, biome)) {
        const side = p.curvature > 0 ? -1 : 1;
        signs.push([
          p.x + p.nx * 6 * side,
          p.y + 1.45,
          p.z + p.nz * 6 * side,
          0.7,
          0.5,
          0.08,
          p.heading,
        ]);
      }
    }
    res.instances(this.group, res.box, res.metal, posts);
    res.instances(this.group, res.box, res.metal, rails);
    res.instances(this.group, res.box, res.reflector, reflectors);
    res.instances(this.group, res.box, res.sign, signs);
  }
  dispose() {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    this.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
  }
}
