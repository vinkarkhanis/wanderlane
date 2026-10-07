import * as THREE from "three";
import { vegetationResources, addGroundDetail } from "./vegetation.js";
import { BIOMES } from "./biomes.js";
import { QUALITY, ROAD } from "./config.js";
import { RoadChunk, strip } from "./roadChunk.js";
import { makeTerrain, makeScenery } from "./scenery.js";
import { frontageMaterials } from "./city/puneFrontages.js";
import { settlementPlan, constrainSettlement } from "./settlementPlan.js";
import { buildSettlement } from "./settlementView.js";
import { chunkCityPlaces } from "./city/endlessCityPlaces.js";
import { buildCityPlaces } from "./city/endlessCityPlaceView.js";
export class WorldManager {
  constructor(scene, path, biome = "meadow", quality = "Medium") {
    this.scene = scene;
    this.path = path;
    this.biome = biome;
    this.quality = quality;
    this.chunks = new Map();
    path.flightFloor = (x, z) => {
      let floor = -Infinity;
      for (const chunk of this.chunks.values())
        for (const h of chunk.flightObstacles)
          if (Math.abs(x - h[0]) < h[3] + 30 && Math.abs(z - h[2]) < h[5] + 30)
            floor = Math.max(floor, h[1] + h[4] + 8);
      return floor;
    };
    path.flightLandingReady = (t) =>
      this.chunks.has(Math.floor(t.distance / ROAD.chunk));
    path.groundHeight = (x, z) => {
      const p = path.findNearestRoadPoint(x, z, {});
      return this.chunks
        .get(Math.floor(p.distance / ROAD.chunk))
        ?.terrain.userData.heightAt(x, z);
    };
    this.wind = { value: 0 };
    path.resolveContacts = (v, dt) => {
      for (const chunk of this.chunks.values())
        constrainSettlement(chunk.contactPlan, v, dt);
    };
    this.makeResources();
  }
  makeResources() {
    const b = BIOMES[this.biome],
      r = {},
      mat = (c, opts = {}) =>
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...opts });
    r.ground = mat(b.ground);
    r.terrain = mat(0xffffff, { vertexColors: true });
    r.asphalt = mat(0x42484b, { vertexColors: true, roughness: 0.96 });
    r.shoulder = mat(b.shoulder);
    r.pavement = mat(0xb5b3a6);
    r.curb = mat(0xd4d1c3);
    r.streetLamp = mat(0xffe4b4, {
      emissive: 0xffcf85,
      emissiveIntensity: 1.4,
    });
    r.cityCream = mat(0xe0d5b7);
    r.cityClay = mat(0xb85d3c);
    r.cityStone = mat(0xa6a49b);
    r.cityTemple = mat(0xdcb681);
    r.cityGold = mat(0xc5a151, { metalness: 0.6, roughness: 0.3 });
    r.cityGlass = mat(0x42787f, { metalness: 0.4, roughness: 0.2 });
    r.cityWater = mat(0x235e78, {
      metalness: 0.02,
      roughness: 0.28,
      envMapIntensity: 0.45,
      transparent: true,
      opacity: 0.94,
    });
    r.cityRipple = mat(0x77acb5, { transparent: true, opacity: 0.45 });
    r.cityBank = mat(0xa69772);
    r.cityFoliage = mat(0x496949);
    r.cityCylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
    r.cityCone = new THREE.ConeGeometry(1, 1, 4);
    r.citySphere = new THREE.IcosahedronGeometry(1, 1);
    r.cityDisc = new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
    r.line = mat(0xe5dec3, { emissive: 0xd3c8a7, emissiveIntensity: 0.24 });
    r.metal = mat(0xa4afb0, { metalness: 0.55, roughness: 0.5 });
    r.reflector = mat(0xffdba1, {
      emissive: 0xffc678,
      emissiveIntensity: 0.85,
    });
    const signCanvas = document.createElement("canvas");
    signCanvas.width = 128;
    signCanvas.height = 64;
    const signCtx = signCanvas.getContext("2d");
    signCtx.fillStyle = "#d6b75b";
    signCtx.fillRect(0, 0, 128, 64);
    signCtx.strokeStyle = "#293c3e";
    signCtx.lineWidth = 12;
    for (const x of [22, 66]) {
      signCtx.beginPath();
      signCtx.moveTo(x, 10);
      signCtx.lineTo(x + 22, 32);
      signCtx.lineTo(x, 54);
      signCtx.stroke();
    }
    r.signTexture = new THREE.CanvasTexture(signCanvas);
    r.signTexture.colorSpace = THREE.SRGBColorSpace;
    r.sign = mat(0xffffff, { map: r.signTexture });
    Object.assign(r, vegetationResources(this.biome, this.wind));
    r.cactus = mat(b.leaf);
    addGroundDetail(r.terrain);
    r.stone = mat(b.rock, { flatShading: true });
    r.distant = mat(b.rock);
    r.flower = mat(0xe8cfab);
    r.snow = mat(0xe8f0ee);
    r.barn = mat(0x835a45);
    r.timber = mat(b.trunk);
    r.box = new THREE.BoxGeometry(1, 1, 1);
    r.trunk = new THREE.CylinderGeometry(0.8, 1, 1, 7);
    r.crown = new THREE.IcosahedronGeometry(1, 1);
    r.pine = new THREE.ConeGeometry(1, 1, 9);
    r.rock = new THREE.DodecahedronGeometry(1, 1);
    r.mesa = new THREE.CylinderGeometry(0.72, 1, 1, 7, 3);
    r.tuft = new THREE.ConeGeometry(0.7, 1, 5);
    r.roof = new THREE.CylinderGeometry(1, 1, 1, 3);
    const dummy = new THREE.Object3D(),
      color = new THREE.Color();
    r.instances = (group, g, m, data, shadow = false) => {
      if (!data.length) return;
      const mesh = new THREE.InstancedMesh(g, m, data.length);
      data.forEach((v, i) => {
        dummy.position.set(v[0], v[1], v[2]);
        dummy.scale.set(v[3], v[4], v[5]);
        dummy.rotation.set(0, v[6], v[7] || 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color.setRGB(1, 1, 1).multiplyScalar(0.88 + (i % 7) * 0.035);
        mesh.setColorAt(i, color);
      });
      mesh.castShadow = shadow;
      mesh.userData.vegetationShadow = shadow;
      mesh.userData.groundcover = m === r.grass || m === r.flower;
      if (m === r.distant) mesh.userData.flightObstacles = data;
      if (m === r.leaf) mesh.customDepthMaterial = r.leafDepth;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    };
    this.res = r;
    this.settlementResources = frontageMaterials();
  }
  build(i) {
    const road = new RoadChunk(this.path, i, this.biome, this.res),
      terrain = makeTerrain(this.path, i, this.biome, this.res),
      town = settlementPlan(this.path, i, terrain.userData.heightAt),
      placePlan = this.path.urban ? chunkCityPlaces(this.path, i) : [],
      landmarks = buildCityPlaces(
        placePlan,
        this.path,
        this.res,
        terrain.userData.heightAt,
      ),
      scenery = makeScenery(
        this.path,
        i,
        this.biome,
        this.res,
        QUALITY[this.quality],
        terrain.userData.heightAt,
        [...town, ...placePlan],
      );
    const group = new THREE.Group();
    if (this.path.urban) {
      const poles = [],
        lamps = [],
        arms = [];
      const start = i * ROAD.chunk,
        end = start + ROAD.chunk;
      for (const side of [-1, 1]) {
        for (const [left, right, height, material] of [
          [4.8, 7.6, 0.14, this.res.pavement],
          [4.65, 4.8, 0.16, this.res.curb],
        ]) {
          const geometry = strip(
            this.path,
            start,
            end,
            left * side,
            right * side,
            height,
          );
          // Keep upward winding on both sides of the street.
          if (side < 0) {
            const index = geometry.index.array;
            for (let k = 0; k < index.length; k += 3)
              [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
            geometry.computeVertexNormals();
          }
          road.geometries.push(geometry);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.receiveShadow = true;
          road.group.add(mesh);
        }
        for (let s = start + 20; s < end; s += 40) {
          const p = this.path.sampleAtDistance(s),
            off = 7.9 * side;
          poles.push([
            p.x + p.nx * off,
            p.y + 3.4,
            p.z + p.nz * off,
            0.13,
            6.8,
            0.13,
            p.heading,
          ]);
          arms.push([
            p.x + p.nx * (off - side),
            p.y + 6.8,
            p.z + p.nz * (off - side),
            2.1,
            0.12,
            0.14,
            p.heading,
          ]);
          lamps.push([
            p.x + p.nx * (off - 2 * side),
            p.y + 6.73,
            p.z + p.nz * (off - 2 * side),
            0.6,
            0.1,
            0.3,
            p.heading,
          ]);
        }
      }
      this.res.instances(
        group,
        this.res.box,
        this.res.metal,
        [...poles, ...arms],
        true,
      );
      this.res.instances(group, this.res.box, this.res.streetLamp, lamps);
    }
    const settlement = buildSettlement(
      town,
      this.res,
      this.settlementResources.materials,
      this.quality,
    );
    scenery.add(settlement.group, landmarks.group);
    group.add(road.group, terrain, scenery);
    this.scene.add(group);
    const flightObstacles = [];
    scenery.traverse((o) => {
      if (o.userData.flightObstacles)
        flightObstacles.push(...o.userData.flightObstacles);
    });
    for (const p of landmarks.colliders)
      flightObstacles.push([
        p.x,
        p.y + p.height / 2,
        p.z,
        p.width / 2,
        p.height / 2,
        p.depth / 2,
      ]);
    this.chunks.set(i, {
      group,
      road,
      terrain,
      scenery,
      settlementPlan: town,
      settlement,
      landmarks,
      contactPlan: [...town, ...landmarks.colliders],
      flightObstacles,
    });
  }
  update(
    distance,
    time = 0,
    reduced = false,
    immediate = false,
    flight = false,
  ) {
    this.wind.value = reduced ? 0 : time;
    const center = Math.floor(distance / ROAD.chunk),
      needed = [];
    const behind = flight ? 4 : ROAD.behind;
    for (let i = center - behind; i <= center + ROAD.ahead; i++)
      if (!this.chunks.has(i)) needed.push(i);
    needed.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    for (const i of needed.slice(0, immediate ? 99 : 1)) this.build(i);
    for (const [i, c] of this.chunks) {
      if (i < center - behind || i > center + ROAD.ahead) this.remove(i);
      else
        c.scenery.traverse((o) => {
          if (o.isInstancedMesh) {
            o.castShadow =
              Math.abs(i - center) < 2 && o.userData.vegetationShadow;
            if (o.userData.groundcover) o.visible = Math.abs(i - center) <= 1;
          }
        });
    }
  }
  remove(i) {
    const c = this.chunks.get(i);
    c.road.dispose();
    c.terrain.geometry.dispose();
    for (const g of c.settlement.geometries) g.dispose();
    for (const resource of c.landmarks.owned) resource.dispose();
    c.scenery.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    c.group.removeFromParent();
    this.chunks.delete(i);
  }
  dispose() {
    for (const i of [...this.chunks.keys()]) this.remove(i);
    for (const v of Object.values(this.res)) if (v?.dispose) v.dispose();
    for (const m of Object.values(this.settlementResources.materials))
      m.dispose();
    for (const t of this.settlementResources.textures) t.dispose();
  }
  get settlementCount() {
    return [...this.chunks.values()].reduce(
      (n, c) => n + c.settlementPlan.length,
      0,
    );
  }
  get places() {
    return [...this.chunks.values()].flatMap((c) =>
      c.landmarks.places.map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        s: p.s,
      })),
    );
  }
}
