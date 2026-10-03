import * as THREE from "three";
import { inside, nearest, meshHeight } from "./spatial.js";
import { random, hashSeed } from "../random.js";
import { vegetationResources, addGroundDetail } from "../vegetation.js";
import { detailCandidates, tileDetails } from "./cityDetails.js";
import { CitySignalView } from "./citySignalView.js";
import { CityActors } from "./cityActors.js";
import { STREET_SCENES } from "./puneStreetDetails.js";
import { buildingStyle, markingRanges } from "./puneStyle.js";
import { buildingMaterials, dressBuilding } from "./puneBuildings.js";
import { edgeCandidates, tileEdges, junctionNodes } from "./puneEdges.js";
import { renderEdge } from "./puneEdgeView.js";
import { cityStreetBays, renderBenchmark } from "./puneBenchmark.js";
import { benchmarkMaterials } from "./puneSurfaceMaterials.js";
import { frontagePlan } from "./puneFrontagePlan.js";
import { frontageMaterials, renderFrontages } from "./puneFrontages.js";
import {
  renderJourneyPlaces,
  JOURNEY_PLACES,
  bayContains,
  clearParkingApproach,
} from "./puneJourney.js";
export const SEASONS = ["Summer", "Monsoon", "Winter"];
const colors = {
  Summer: [0x9b9566, 0xa5ae74, 0x414548],
  Monsoon: [0x697e49, 0x8aaf67, 0x303b3d],
  Winter: [0x969a79, 0xa6b182, 0x42494b],
};
function merge(parts) {
  const hasColors = parts.some((g) => g.attributes.color),
    colors = [];
  const pos = [],
    norm = [],
    uv = [];
  for (const source of parts) {
    const g = source.index ? source.toNonIndexed() : source;
    for (const v of g.attributes.position.array) pos.push(v);
    for (const v of g.attributes.normal.array) norm.push(v);
    if (hasColors) {
      if (g.attributes.color)
        for (const v of g.attributes.color.array) colors.push(v);
      else
        for (let i = 0; i < g.attributes.position.count * 3; i++)
          colors.push(1);
    }
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
  if (hasColors)
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
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
    path.flightFloor = (x, z) => this.flightFloor(x, z);
    path.flightLandingReady = (t) =>
      this.chunks.has(Math.floor(t.x / 256) + "," + Math.floor(t.z / 256));
    this.pending = new Map();
    this.queue = [];
    this.wanted = new Set();
    this.disposed = false;
    this.error = null;
    this.wind = { value: 0 };
    this.controller = new AbortController();
    this.lastCell = "";
    this.detailPlan = detailCandidates(path);
    this.edgePlan = edgeCandidates(path, this.detailPlan);
    this.junctionNodes = junctionNodes(path);
    this.signalView = new CitySignalView(path);
    this.actors = new CityActors(path, quality);
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
      rubber: mat(0x242c29),
      autoPaint: mat(0xc59c32),
      fixture: mat(0xe8dec1, { emissive: 0xffd49a, emissiveIntensity: 0.15 }),
      box: new THREE.BoxGeometry(1, 1, 1),
    };
    addGroundDetail(this.res.terrain);
    addGroundDetail(this.res.asphalt);
    addGroundDetail(this.res.shoulder);
    Object.assign(this.res, vegetationResources("meadow", this.wind));
    const surfaces = benchmarkMaterials();
    Object.assign(this.res, surfaces.materials);
    this.surfaceTextures = surfaces.textures;
    for (const key of ["cream", "ochre"]) {
      this.actors.res[key].map = this.res.concrete.map;
      this.actors.res[key].bumpMap = this.res.concrete.bumpMap;
      this.actors.res[key].bumpScale = 0.012;
    }
    this.res.benchmarkFacade = mat(0xffffff, { vertexColors: true });
    this.benchmarkReady = new Promise((resolve) => {
      const texture = new THREE.TextureLoader().load(
        new URL("../../assets/art/pune-residential-facade.png", import.meta.url)
          .href,
        () => resolve(),
        undefined,
        () => resolve(),
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      this.res.benchmarkFacade.map = texture;
      this.surfaceTextures.push(texture);
    });
    const styles = buildingMaterials();
    this.facades = styles.materials;
    this.facadeTextures = styles.textures;
    const frontages = frontageMaterials();
    this.frontageMaterials = frontages.materials;
    this.frontageTextures = frontages.textures;
    this.res.solar = mat(0x36575b, { roughness: 0.55 });
    this.res.patch = mat(0x353c3d);
    this.res.puddle = mat(0x526365, {
      roughness: 0.12,
      metalness: 0.45,
      transparent: true,
      opacity: 0,
    });
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
    this.res.puddle.opacity = season === "Monsoon" ? 0.65 : 0;
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
    await this.benchmarkReady;
    this.update(v, 0, true);
    await Promise.all(this.pending.values());
    while (this.queue.length) {
      const data = this.queue.shift();
      if (this.wanted.has(data.id) && !this.chunks.has(data.id))
        this.activate(data);
    }
    if (this.error) throw Error(this.error);
  }
  update(v, time = 0, reduced = false, night = 0, sunset = false) {
    this.signalView.update(this.signals?.time ?? time);
    this.actors.update(
      v,
      this.experience?.status === "active" ? this.experience.elapsed : time,
      reduced,
      Math.max(night, sunset ? 0.35 : 0),
      this.season,
      this.experience,
    );
    this.wind.value = reduced ? 0 : time;
    for (const [i, m] of this.facades.entries())
      m.emissiveIntensity = night * (i === 5 ? 0 : 0.25 + i * 0.06);
    this.res.fixture.emissiveIntensity =
      0.15 + Math.max(night, sunset ? 0.25 : 0) * 3;
    const cx = Math.floor(v.x / 256),
      cz = Math.floor(v.z / 256),
      key =
        cx +
        "," +
        cz +
        ":" +
        (v.flight && v.flight !== "ground" ? "air" : "road");
    if (key !== this.lastCell) {
      this.lastCell = key;
      this.wanted.clear();
      const radius =
        v.flight && v.flight !== "ground"
          ? this.quality === "Low"
            ? 2
            : 3
          : this.quality === "Low"
            ? 1
            : 2;
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
        if (o.userData.building) o.castShadow = close && this.quality !== "Low";
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
    let y =
      (c ? this.terrainHeight(c.data, x, z) : this.path.heightAt(x, z)) - 0.22;
    for (const s of c?.groundSurfaces || []) {
      if (
        x < s.bounds[0] ||
        z < s.bounds[1] ||
        x > s.bounds[2] ||
        z > s.bounds[3]
      )
        continue;
      y = Math.max(y, meshHeight(x, z, s.positions, s.indices));
    }
    return y;
  }
  activate(data) {
    const group = new THREE.Group(),
      geometries = [],
      owned = [],
      groundSurfaces = [],
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
    const journeyPlaces = renderJourneyPlaces(
      data,
      this.path,
      (x, z) => this.terrainHeight(data, x, z) - 0.22,
      block,
      {
        ...this.res,
        ...this.actors.res,
        mark: this.res.line,
        trim: this.res.trim,
      },
    );
    for (const p of journeyPlaces) {
      const g = new THREE.PlaneGeometry(3.45, 0.65),
        uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, (4 + uv.getY(i)) / 6);
      const x = p.x + Math.sin(p.yaw) * 3.0,
        z = p.z + Math.cos(p.yaw) * 3.0;
      g.rotateY(p.yaw + Math.PI);
      g.translate(x, this.terrainHeight(data, x, z) - 0.22 + 2.38, z);
      add(g, this.frontageMaterials.sign);
    }
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
      // Cosmetic repairs, owned once at the segment midpoint. They never alter
      // contact height, lane geometry or source-backed road alignment.
      const mx = (r.p[0] + r.q[0]) / 2,
        mz = (r.p[1] + r.q[1]) / 2;
      if (
        !r.elevated &&
        len > 45 &&
        r.id % 5 === 0 &&
        Math.floor(mx / 256) === data.x / 256 &&
        Math.floor(mz / 256) === data.z / 256
      ) {
        block(
          mx,
          (r.y0 + r.y1) / 2 + 0.097,
          mz,
          Math.min(1.6, r.width / 3),
          0.018,
          2.5,
          Math.atan2(dx, dz),
          this.res.patch,
        );
      }
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
      {
        for (const [a, b] of markingRanges(r, this.junctionNodes)) {
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
    const streetParts = new Map();
    const streetBlock = (x, y, z, w, h, d, yaw, material) => {
      if (!streetParts.has(material)) streetParts.set(material, []);
      streetParts.get(material).push([x, y, z, w, h, d, yaw]);
    };
    const bays = cityStreetBays(
      data,
      this.path,
      this.junctionNodes,
      this.quality,
    );
    renderBenchmark(
      bays,
      data,
      this.path,
      streetBlock,
      this.res,
      (x, z) => this.terrainHeight(data, x, z) - 0.22,
    );
    const styles = {},
      edges = tileEdges(data, this.edgePlan, this.quality);
    const frontages = frontagePlan(data, this.path);
    renderFrontages(
      frontages,
      this.quality,
      streetBlock,
      add,
      this.res,
      this.frontageMaterials,
    );
    let rooftopFittings = 0;
    for (const b of data.buildings) {
      const style = buildingStyle(b);
      styles[style.family] = (styles[style.family] || 0) + 1;
      rooftopFittings += dressBuilding(
        b,
        this.quality,
        block,
        this.res,
        this.path,
        data,
      );
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
      const benchmark = style.family === "plaster" && style.seed % 2 === 0;
      {
        const tint = new THREE.Color(
          [0xf5ead9, 0xe0e5df, 0xe6ded3, 0xd6dbda][style.seed % 4],
        );
        const colors = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) tint.toArray(colors, i * 3);
        g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      add(
        g,
        benchmark &&
          style.family === "plaster" &&
          this.res.benchmarkFacade.map.image
          ? this.res.benchmarkFacade
          : this.facades[style.index],
      );
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
        g.computeBoundingBox();
        groundSurfaces.push({
          positions: p.array,
          indices: g.index.array,
          bounds: [
            g.boundingBox.min.x,
            g.boundingBox.min.z,
            g.boundingBox.max.x,
            g.boundingBox.max.z,
          ],
        });
        add(g, this.res.park);
      }
    }
    for (const p of edges) {
      renderEdge(
        p,
        this.terrainHeight(data, p.x, p.z) - 0.22,
        block,
        this.res,
        add,
      );
      if (p.kind === "drain")
        block(
          p.x + 0.8,
          this.terrainHeight(data, p.x + 0.8, p.z) + 0.015,
          p.z,
          0.5,
          0.025,
          2,
          p.yaw,
          this.res.puddle,
        );
    }
    const rng = random(hashSeed(data.id)),
      trees = [[], [], []],
      grass = [];
    const details = tileDetails(data, this.detailPlan, this.quality);
    const signs = details.filter((p) => p.kind === "sign").slice(0, 8);
    let signMaterial;
    if (signs.length) {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = signs.length * 128;
      const ctx = canvas.getContext("2d");
      signs.forEach((p, i) => {
        ctx.fillStyle = "#214d49";
        ctx.fillRect(0, i * 128, 1024, 128);
        ctx.strokeStyle = "#e8e8cf";
        ctx.lineWidth = 4;
        ctx.strokeRect(8, i * 128 + 8, 1008, 112);
        ctx.fillStyle = "#f3f1da";
        let size = 58;
        do {
          ctx.font = `600 ${size--}px sans-serif`;
        } while (ctx.measureText(p.name).width > 960 && size > 20);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.name, 512, i * 128 + 64);
      });
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      signMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        emissiveMap: texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
      });
      owned.push(texture, signMaterial);
    }
    for (const p of details) {
      const h = this.terrainHeight(data, p.x, p.z) - 0.22;
      if (p.kind === "tree") {
        trees[1].push([p.x, h, p.z, 0.7, 0.85, 0.7, p.yaw]);
      } else if (p.kind === "lamp") {
        block(p.x, h + 3.2, p.z, 0.14, 6.4, 0.14, 0, this.res.trim);
        block(p.x, h + 6.35, p.z, 1.5, 0.12, 0.18, p.yaw, this.res.trim);
        block(p.x, h + 6.24, p.z, 1.15, 0.12, 0.4, p.yaw, this.res.fixture);
      } else if (p.kind === "box") {
        block(p.x, h + 0.55, p.z, 0.75, 1.1, 0.45, p.yaw, this.res.trim);
        block(p.x, h + 1.12, p.z, 0.84, 0.08, 0.53, p.yaw, this.res.roof);
      } else if (signs.includes(p)) {
        block(p.x, h + 1.5, p.z, 0.09, 3, 0.09, 0, this.res.trim);
        const i = signs.indexOf(p);
        for (const flip of [0, Math.PI]) {
          const g = new THREE.PlaneGeometry(3.6, 0.48);
          const uv = g.attributes.uv;
          for (let j = 0; j < uv.count; j++)
            uv.setY(j, (signs.length - i - 1 + uv.getY(j)) / signs.length);
          g.translate(0, 0, 0.015);
          g.rotateY(p.yaw + flip);
          g.translate(p.x, h + 2.9, p.z);
          add(g, signMaterial);
        }
      }
    }
    const safe = (x, z) => {
      if (bays.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) return false;
      if (STREET_SCENES.some((p) => Math.hypot(p.x - x, p.z - z) < 10))
        return false;
      if (Object.values(JOURNEY_PLACES).some((p) => bayContains(p, x, z, 3)))
        return false;
      if (!clearParkingApproach(this.path, x, z, 4)) return false;
      if (edges.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 4))
        return false;
      if (details.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 4))
        return false;
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
      return mesh;
    };
    for (const [m, list] of streetParts) {
      const mesh = instance(this.res.box, m, list);
      mesh.userData.building = true;
    }
    for (let i = 0; i < 3; i++) {
      const k = ["oak", "field", "birch"][i];
      instance(this.res[k + "Wood"], this.res.bark, trees[i], true);
      instance(this.res[k + "Leaves"], this.res.leaf, trees[i], true);
    }
    instance(this.res.grassBlades, this.res.grass, grass);
    const releaseActors = this.actors.addChunk(
      data,
      group,
      block,
      (x, z) => this.terrainHeight(data, x, z) - 0.22,
      owned,
      add,
    );
    for (const [m, gs] of parts) {
      const g = merge(gs);
      geometries.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true;
      mesh.userData.building =
        this.facades.includes(m) ||
        Object.values(this.frontageMaterials).includes(m) ||
        m === this.res.benchmarkFacade ||
        m === this.res.concrete ||
        [
          this.actors.res.cream,
          this.actors.res.ochre,
          this.actors.res.teal,
        ].includes(m);
      group.add(mesh);
    }
    this.scene.add(group);
    const releaseSignals = this.signalView.addChunk(
      data,
      group,
      (x, z) => this.terrainHeight(data, x, z) - 0.22,
    );
    this.chunks.set(data.id, {
      releaseSignals,
      releaseActors,
      group,
      geometries,
      owned,
      groundSurfaces,
      styles,
      rooftopFittings,
      frontages,
      journeyPlaces,
      pavementBays: bays.length,
      edges,
      details,
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
  flightFloor(x, z) {
    let floor = this.heightAt(x, z) + 45;
    const c = this.chunks.get(Math.floor(x / 256) + "," + Math.floor(z / 256));
    for (const b of c?.data.buildings || [])
      if (
        x > b.bounds[0] - 30 &&
        x < b.bounds[2] + 30 &&
        z > b.bounds[1] - 30 &&
        z < b.bounds[3] + 30
      )
        floor = Math.max(floor, b.y + b.height + 12);
    return floor;
  }
  remove(id) {
    const c = this.chunks.get(id);
    c.group.removeFromParent();
    c.releaseSignals();
    c.releaseActors();
    for (const g of c.geometries) g.dispose();
    for (const resource of c.owned) resource.dispose();
    c.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    this.chunks.delete(id);
  }
  dispose() {
    this.disposed = true;
    this.controller.abort();
    this.signalView.dispose();
    this.actors.dispose();
    for (const id of [...this.chunks.keys()]) this.remove(id);
    for (const v of Object.values(this.res)) v?.dispose?.();
    for (const m of this.facades) m.dispose();
    for (const t of this.facadeTextures) t.dispose();
    for (const m of Object.values(this.frontageMaterials)) m.dispose();
    for (const t of this.frontageTextures) t.dispose();
    for (const t of this.surfaceTextures) t.dispose();
    this.queue.length = 0;
  }
  get stats() {
    const buildingStyles = {};
    let streetProps = 0,
      parkedVehicles = 0,
      rooftopFittings = 0,
      frontages = 0,
      pavementBays = 0;
    let buildings = 0,
      vegetation = 0,
      details = 0,
      signs = 0;
    for (const c of this.chunks.values()) {
      for (const [k, n] of Object.entries(c.styles))
        buildingStyles[k] = (buildingStyles[k] || 0) + n;
      streetProps += c.edges.length;
      parkedVehicles += c.edges.reduce(
        (n, p) =>
          n +
          (p.kind === "scooter"
            ? 2
            : ["car", "rickshaw"].includes(p.kind)
              ? 1
              : 0),
        0,
      );
      rooftopFittings += c.rooftopFittings;
      frontages += c.frontages.length;
      pavementBays += c.pavementBays;
      buildings += c.data.buildings.length;
      vegetation += c.trees;
      details += c.details.length;
      signs += Math.min(8, c.details.filter((p) => p.kind === "sign").length);
    }
    return {
      buildings,
      buildingStyles,
      streetProps,
      parkedVehicles,
      rooftopFittings,
      frontages,
      pavementBays,
      elevation: this.manifest.elevation.label,
      vegetation,
      details,
      signs,
      journeyPlaces: [...this.chunks.values()].flatMap((c) =>
        c.journeyPlaces.map((p) => p.id),
      ),
      pending: this.pending.size,
      queued: this.queue.length,
      error: this.error,
      signals: this.signals?.snapshot ?? {
        active: this.signalView.plan.length,
      },
      actors: this.actors.snapshot,
      signalHeads: this.signalView.heads.size,
    };
  }
}
