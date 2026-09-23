import * as THREE from "three";
import { inside, nearest } from "./spatial.js";
import { random, hashSeed } from "../random.js";
import { vegetationResources, addGroundDetail } from "../vegetation.js";
export const SEASONS = ["Summer", "Monsoon", "Winter"];
const colors = {
  Summer: [0x9b9566, 0xa5ae74, 0x414548],
  Monsoon: [0x697e49, 0x8aaf67, 0x303b3d],
  Winter: [0x969a79, 0xa6b182, 0x42494b],
};
function merge(parts) {
  const pos = [],
    norm = [],
    uv = [];
  for (const source of parts) {
    const g = source.index ? source.toNonIndexed() : source;
    for (const v of g.attributes.position.array) pos.push(v);
    for (const v of g.attributes.normal.array) norm.push(v);
    for (const v of g.attributes.uv?.array ||
      new Float32Array(g.attributes.position.count * 2))
      uv.push(v);
    if (g !== source) g.dispose();
    source.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}
function shape(p) {
  const s = new THREE.Shape(p.outer.map((v) => new THREE.Vector2(v[0], -v[1])));
  for (const hole of p.holes)
    s.holes.push(
      new THREE.Path(hole.map((v) => new THREE.Vector2(v[0], -v[1]))),
    );
  return s;
}
function surface(p, y) {
  const g = new THREE.ShapeGeometry(shape(p));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}
function roadRibbon(r, width, yoff = 0) {
  const dx = r.q[0] - r.p[0],
    dz = r.q[1] - r.p[1],
    l = Math.hypot(dx, dz),
    nx = ((-dz / l) * width) / 2,
    nz = ((dx / l) * width) / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        r.p[0] + nx,
        r.y0 + yoff,
        r.p[1] + nz,
        r.p[0] - nx,
        r.y0 + yoff,
        r.p[1] - nz,
        r.q[0] + nx,
        r.y1 + yoff,
        r.q[1] + nz,
        r.q[0] - nx,
        r.y1 + yoff,
        r.q[1] - nz,
      ],
      3,
    ),
  );
  g.setIndex([0, 2, 1, 1, 2, 3]);
  g.computeVertexNormals();
  return g;
}
export class CityWorld {
  constructor(
    scene,
    path,
    manifest,
    base,
    season = "Summer",
    quality = "Medium",
  ) {
    this.scene = scene;
    this.path = path;
    this.manifest = manifest;
    this.base = base;
    this.season = season;
    this.quality = quality;
    this.chunks = new Map();
    this.pending = new Map();
    this.queue = [];
    this.wanted = new Set();
    this.disposed = false;
    this.error = null;
    this.wind = { value: 0 };
    this.controller = new AbortController();
    this.lastCell = "";
    this.resources();
  }
  resources() {
    const mat = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
    this.res = {
      terrain: mat(0xffffff),
      asphalt: mat(0x414548, {
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
      shoulder: mat(0xa9a18b),
      line: mat(0xd9d1b1, { emissive: 0xddd4ae, emissiveIntensity: 0.2 }),
      water: mat(0x5b888a, { roughness: 0.3, metalness: 0.25 }),
      park: mat(0x6f8751),
      roof: mat(0x8b8b7a),
      trim: mat(0x7a817b),
      box: new THREE.BoxGeometry(1, 1, 1),
    };
    addGroundDetail(this.res.terrain);
    Object.assign(this.res, vegetationResources("meadow", this.wind));
    // A single original facade atlas repeats in metres across all building walls.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d");
    c.fillStyle = "#c5c0ad";
    c.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        const x = col * 64 + 17,
          y = row * 64 + 13;
        c.fillStyle = "#a09b8d";
        c.fillRect(x - 3, y - 3, 36, 41);
        c.fillStyle = "#4d656b";
        c.fillRect(x, y, 29, 32);
        c.fillStyle = "#8a9b99";
        c.fillRect(x + 2, y + 2, 12, 13);
        c.fillStyle = "#d8d2bc";
        c.fillRect(x - 3, y + 33, 36, 3);
      }
    this.res.facadeTexture = new THREE.CanvasTexture(canvas);
    this.res.facadeTexture.colorSpace = THREE.SRGBColorSpace;
    this.res.facadeTexture.wrapS = this.res.facadeTexture.wrapT =
      THREE.RepeatWrapping;
    const nightCanvas = document.createElement("canvas");
    nightCanvas.width = nightCanvas.height = 256;
    const n = nightCanvas.getContext("2d");
    n.fillStyle = "#000";
    n.fillRect(0, 0, 256, 256);
    for (const [x, y] of [
      [17, 13],
      [145, 77],
      [81, 205],
    ]) {
      n.fillStyle = "#baa46b";
      n.fillRect(x, y, 29, 32);
    }
    this.res.windowTexture = new THREE.CanvasTexture(nightCanvas);
    this.res.windowTexture.colorSpace = THREE.SRGBColorSpace;
    this.res.windowTexture.wrapS = this.res.windowTexture.wrapT =
      THREE.RepeatWrapping;
    this.facades = [0xd3c9b3, 0xb7bbb3, 0xc3ad93, 0xa9b7b8].map((color) =>
      mat(color, {
        map: this.res.facadeTexture,
        emissiveMap: this.res.windowTexture,
        emissive: 0xffd49a,
        emissiveIntensity: 0,
      }),
    );
    this.setSeason(this.season);
  }
  setSeason(season) {
    this.season = season;
    const p = colors[season];
    this.res.terrain.color.setHex(p[0]);
    this.res.park.color.setHex(season === "Monsoon" ? 0x528343 : 0x808457);
    this.res.leaf.color.setHex(p[1]);
    this.res.grass.color.setHex(p[0]);
    this.res.asphalt.color.setHex(p[2]);
    this.res.asphalt.roughness = season === "Monsoon" ? 0.34 : 0.94;
  }
  async fetchChunk(entry) {
    if (
      this.pending.has(entry.id) ||
      this.chunks.has(entry.id) ||
      this.queue.some((c) => c.id === entry.id)
    )
      return;
    const task = (async () => {
      try {
        const response = await fetch(new URL(entry.file, this.base), {
          signal: this.controller.signal,
        });
        if (!response.ok) throw Error("HTTP " + response.status);
        const data = await response.json();
        if (
          data.id !== entry.id ||
          data.terrain?.length !== (data.terrainResolution + 1) ** 2 ||
          !Array.isArray(data.buildings)
        )
          throw Error("Invalid chunk structure");
        if (!this.disposed && this.wanted.has(entry.id)) this.queue.push(data);
      } catch (e) {
        if (e.name !== "AbortError")
          this.error =
            "Could not load Pune chunk " +
            entry.id +
            ": " +
            e.message +
            ". Return to Endless Drive or reload.";
      } finally {
        this.pending.delete(entry.id);
      }
    })();
    this.pending.set(entry.id, task);
    return task;
  }
  async ready(v) {
    this.update(v, 0, true);
    await Promise.all(this.pending.values());
    while (this.queue.length) this.activate(this.queue.shift());
    if (this.error) throw Error(this.error);
  }
  update(v, time = 0, reduced = false, night = 0) {
    this.wind.value = reduced ? 0 : time;
    for (const m of this.facades) m.emissiveIntensity = night * 0.5;
    const cx = Math.floor(v.x / 256),
      cz = Math.floor(v.z / 256),
      key = cx + "," + cz;
    if (key !== this.lastCell) {
      this.lastCell = key;
      this.wanted.clear();
      const radius = this.quality === "Low" ? 1 : 2;
      const entries = this.manifest.chunks
        .filter(
          (e) =>
            Math.abs(e.x / 256 - cx) <= radius &&
            Math.abs(e.z / 256 - cz) <= radius,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x / 256 - cx, a.z / 256 - cz) -
            Math.hypot(b.x / 256 - cx, b.z / 256 - cz),
        );
      for (const e of entries) this.wanted.add(e.id);
      for (const [id] of this.chunks) if (!this.wanted.has(id)) this.remove(id);
      for (const e of entries) this.fetchChunk(e);
    }
    if (this.queue.length) {
      const c = this.queue.shift();
      if (this.wanted.has(c.id) && !this.chunks.has(c.id)) this.activate(c);
    }
    for (const c of this.chunks.values()) {
      const close =
        Math.hypot(c.data.x + 128 - v.x, c.data.z + 128 - v.z) < 330;
      c.group.traverse((o) => {
        if (o.userData.tree) o.castShadow = close && this.quality !== "Low";
      });
    }
  }
  terrainHeight(c, x, z) {
    const n = c.terrainResolution,
      gx = Math.max(0, Math.min(n - 0.000001, ((x - c.x) / c.size) * n)),
      gz = Math.max(0, Math.min(n - 0.000001, ((z - c.z) / c.size) * n)),
      i = Math.floor(gx),
      j = Math.floor(gz),
      a = gx - i,
      b = gz - j,
      k = j * (n + 1) + i,
      h = c.terrain;
    return a + b <= 1
      ? h[k] * (1 - a - b) + h[k + 1] * a + h[k + n + 1] * b
      : h[k + n + 2] * (a + b - 1) +
          h[k + n + 1] * (1 - a) +
          h[k + 1] * (1 - b);
  }
  heightAt(x, z) {
    const c = this.chunks.get(Math.floor(x / 256) + "," + Math.floor(z / 256));
    return c ? this.terrainHeight(c.data, x, z) : this.path.heightAt(x, z);
  }
  activate(data) {
    const group = new THREE.Group(),
      geometries = [],
      parts = new Map(),
      add = (g, m) => {
        if (!parts.has(m)) parts.set(m, []);
        parts.get(m).push(g);
      };
    const n = data.terrainResolution,
      pos = [],
      idx = [];
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++)
        pos.push(
          data.x + (i * data.size) / n,
          data.terrain[j * (n + 1) + i] - 0.22,
          data.z + (j * data.size) / n,
        );
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i;
        idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
      }
    const ground = new THREE.BufferGeometry();
    ground.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    ground.setIndex(idx);
    ground.computeVertexNormals();
    add(ground, this.res.terrain);
    const block = (x, y, z, w, h, d, yaw, m) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.rotateY(yaw);
      g.translate(x, y, z);
      add(g, m);
    };
    const junctions = new Set();
    for (const id of data.roads) {
      const r = this.path.roads[id];
      add(roadRibbon(r, r.width + 1.4, 0.025), this.res.shoulder);
      add(roadRibbon(r, r.width, 0.075), this.res.asphalt);
      const dx = r.q[0] - r.p[0],
        dz = r.q[1] - r.p[1],
        len = Math.hypot(dx, dz),
        nx = -dz / len,
        nz = dx / len;
      if (r.elevated) {
        const bridge = r.tags.bridge && r.tags.bridge !== "no";
        if (bridge) {
          block(
            (r.p[0] + r.q[0]) / 2,
            (r.y0 + r.y1) / 2 - 0.24,
            (r.p[1] + r.q[1]) / 2,
            r.width + 1.4,
            0.5,
            len,
            Math.atan2(dx, dz),
            this.res.shoulder,
          );
          for (const side of [-1, 1]) {
            const off = side * (r.width / 2 + 0.4),
              rail = {
                ...r,
                p: [r.p[0] + nx * off, r.p[1] + nz * off],
                q: [r.q[0] + nx * off, r.q[1] + nz * off],
              };
            add(roadRibbon(rail, 0.15, 0.85), this.res.trim);
            for (let t = 0; t < 1; t += 4 / len)
              block(
                rail.p[0] + dx * t,
                r.y0 + (r.y1 - r.y0) * t + 0.42,
                rail.p[1] + dz * t,
                0.12,
                0.85,
                0.12,
                0,
                this.res.trim,
              );
          }
        } else {
          for (const side of [-1, 1]) {
            const inner = r.width / 2 + 0.7,
              outer =
                inner +
                Math.max(
                  r.y0 - this.terrainHeight(data, ...r.p),
                  r.y1 - this.terrainHeight(data, ...r.q),
                  1,
                ) *
                  1.5;
            const a = [
                r.p[0] + nx * inner * side,
                r.y0 + 0.022,
                r.p[1] + nz * inner * side,
              ],
              b = [
                r.q[0] + nx * inner * side,
                r.y1 + 0.022,
                r.q[1] + nz * inner * side,
              ],
              c = [r.p[0] + nx * outer * side, 0, r.p[1] + nz * outer * side],
              d = [r.q[0] + nx * outer * side, 0, r.q[1] + nz * outer * side];
            c[1] = this.terrainHeight(data, c[0], c[2]) - 0.2;
            d[1] = this.terrainHeight(data, d[0], d[2]) - 0.2;
            const g = new THREE.BufferGeometry();
            g.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(
                [
                  ...a,
                  ...b,
                  ...c,
                  ...b,
                  ...d,
                  ...c,
                  ...c,
                  ...b,
                  ...a,
                  ...c,
                  ...d,
                  ...b,
                ],
                3,
              ),
            );
            g.computeVertexNormals();
            add(g, this.res.terrain);
          }
        }
      }
      for (const [node, p, y] of [
        [r.a, r.p, r.y0],
        [r.b, r.q, r.y1],
      ])
        if (!junctions.has(node)) {
          junctions.add(node);
          const g = new THREE.CircleGeometry(r.width / 2, 12);
          g.rotateX(-Math.PI / 2);
          g.translate(p[0], y + 0.074, p[1]);
          add(g, this.res.asphalt);
        }
      if (r.width >= 6 && !r.oneway) {
        const steps = Math.floor(r.length / 10);
        for (let i = 0; i < steps; i++) {
          const a = (i * 10 + 2) / r.length,
            b = Math.min(1, (i * 10 + 6) / r.length);
          add(
            roadRibbon(
              {
                ...r,
                p: [
                  r.p[0] + (r.q[0] - r.p[0]) * a,
                  r.p[1] + (r.q[1] - r.p[1]) * a,
                ],
                q: [
                  r.p[0] + (r.q[0] - r.p[0]) * b,
                  r.p[1] + (r.q[1] - r.p[1]) * b,
                ],
                y0: r.y0 + (r.y1 - r.y0) * a,
                y1: r.y0 + (r.y1 - r.y0) * b,
              },
              0.11,
              0.093,
            ),
            this.res.line,
          );
        }
      }
    }
    for (const b of data.buildings) {
      const g = new THREE.ExtrudeGeometry(shape(b), {
        depth: b.height,
        bevelEnabled: false,
        steps: 1,
      });
      g.rotateX(-Math.PI / 2);
      g.translate(0, b.y, 0);
      const p = g.attributes.position,
        uv = g.attributes.uv,
        no = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const wall = Math.abs(no.getY(i)) < 0.5;
        uv.setXY(
          i,
          (Math.abs(no.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) / 12,
          wall ? p.getY(i) / 12 : p.getZ(i) / 12,
        );
      }
      add(g, this.facades[b.variant]);
      add(surface(b, b.y + b.height + 0.025), this.res.roof);
    }
    for (const l of data.land) {
      if (l.kind === "water") {
        const y =
          l.waterY ??
          Math.min(...l.outer.map((p) => this.terrainHeight(data, ...p)));
        add(surface(l, y + 0.06), this.res.water);
      } else if (l.kind === "park") {
        const g = surface(l, 0),
          p = g.attributes.position;
        for (let i = 0; i < p.count; i++)
          p.setY(i, this.terrainHeight(data, p.getX(i), p.getZ(i)) + 0.005);
        g.computeVertexNormals();
        add(g, this.res.park);
      }
    }
    const rng = random(hashSeed(data.id)),
      trees = [[], [], []],
      grass = [];
    const safe = (x, z) => {
      const near = this.path.findNearestRoadPoint(x, z, {});
      if (Math.abs(near.offset) < near.width / 2 + 5) return false;
      return (
        !data.buildings.some(
          (b) =>
            x >= b.bounds[0] - 4 &&
            x <= b.bounds[2] + 4 &&
            z >= b.bounds[1] - 4 &&
            z <= b.bounds[3] + 4,
        ) &&
        !data.land.some((l) => l.kind === "water" && inside([x, z], l.outer))
      );
    };
    for (let i = 0; i < (this.quality === "Low" ? 35 : 80); i++) {
      const x = data.x + rng() * 256,
        z = data.z + rng() * 256;
      const park = data.land.some(
        (l) => l.kind === "park" && inside([x, z], l.outer),
      );
      if ((!park && rng() > 0.3) || !safe(x, z)) continue;
      const h = this.terrainHeight(data, x, z),
        s = 0.7 + rng() * 0.7;
      trees[i % 3].push([
        x,
        h,
        z,
        s * (i % 3 === 0 ? 1.4 : 1),
        s * (i % 3 === 1 ? 1.1 : 0.8),
        s * (i % 3 === 0 ? 1.4 : 1),
        rng() * 6.28,
      ]);
    }
    for (let i = 0; i < (this.quality === "Low" ? 70 : 200); i++) {
      const x = data.x + rng() * 256,
        z = data.z + rng() * 256;
      if (!safe(x, z)) continue;
      grass.push([
        x,
        this.terrainHeight(data, x, z),
        z,
        1,
        0.6,
        1,
        rng() * 6.28,
      ]);
    }
    const instance = (g, m, list, tree = false) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(g, m, list.length),
        dummy = new THREE.Object3D();
      list.forEach((a, i) => {
        dummy.position.set(...a.slice(0, 3));
        dummy.scale.set(...a.slice(3, 6));
        dummy.rotation.set(0, a[6], 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.userData.tree = tree;
      mesh.receiveShadow = true;
      if (m === this.res.leaf) mesh.customDepthMaterial = this.res.leafDepth;
      mesh.computeBoundingSphere();
      group.add(mesh);
    };
    for (let i = 0; i < 3; i++) {
      const k = ["oak", "field", "birch"][i];
      instance(this.res[k + "Wood"], this.res.bark, trees[i], true);
      instance(this.res[k + "Leaves"], this.res.leaf, trees[i], true);
    }
    instance(this.res.grassBlades, this.res.grass, grass);
    for (const [m, gs] of parts) {
      const g = merge(gs);
      geometries.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.scene.add(group);
    this.chunks.set(data.id, {
      group,
      geometries,
      data,
      trees: trees.reduce((n, t) => n + t.length, 0),
    });
  }
  constrain(v, dt) {
    const c = this.chunks.get(
      Math.floor(v.x / 256) + "," + Math.floor(v.z / 256),
    );
    if (!c) return;
    for (const b of c.data.buildings) {
      if (
        v.x < b.bounds[0] - 1.2 ||
        v.x > b.bounds[2] + 1.2 ||
        v.z < b.bounds[1] - 1.2 ||
        v.z > b.bounds[3] + 1.2 ||
        v.y > b.y + b.height
      )
        continue;
      const point = [v.x, v.z],
        within =
          inside(point, b.outer) && !b.holes.some((h) => inside(point, h));
      let hit = { d: Infinity };
      for (const ring of [b.outer, ...b.holes])
        for (let i = 0; i < ring.length; i++) {
          const n = nearest(point, ring[i], ring[(i + 1) % ring.length]);
          if (n.d < hit.d) hit = n;
        }
      if (within || hit.d < 1.1) {
        const dx = v.x - hit.x,
          dz = v.z - hit.z,
          l = Math.hypot(dx, dz) || 1,
          sign = within ? -1 : 1;
        v.x = hit.x + (dx / l) * 1.12 * sign;
        v.z = hit.z + (dz / l) * 1.12 * sign;
        v.speed *= Math.exp(-8 * dt);
      }
    }
  }
  remove(id) {
    const c = this.chunks.get(id);
    c.group.removeFromParent();
    for (const g of c.geometries) g.dispose();
    c.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    this.chunks.delete(id);
  }
  dispose() {
    this.disposed = true;
    this.controller.abort();
    for (const id of [...this.chunks.keys()]) this.remove(id);
    for (const v of Object.values(this.res)) v?.dispose?.();
    for (const m of this.facades) m.dispose();
    this.queue.length = 0;
  }
  get stats() {
    let buildings = 0,
      vegetation = 0;
    for (const c of this.chunks.values()) {
      buildings += c.data.buildings.length;
      vegetation += c.trees;
    }
    return {
      buildings,
      vegetation,
      pending: this.pending.size,
      queued: this.queue.length,
      error: this.error,
    };
  }
}
