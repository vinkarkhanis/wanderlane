import * as THREE from "three";
import { vegetationResources, addGroundDetail } from "./vegetation.js";
import { BIOMES } from "./biomes.js";
import { QUALITY, ROAD } from "./config.js";
import { RoadChunk } from "./roadChunk.js";
import { makeTerrain, makeScenery } from "./scenery.js";
export class WorldManager {
  constructor(scene, path, biome = "meadow", quality = "Medium") {
    this.scene = scene;
    this.path = path;
    this.biome = biome;
    this.quality = quality;
    this.chunks = new Map();
    this.wind = { value: 0 };
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
      if (m === r.leaf) mesh.customDepthMaterial = r.leafDepth;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    };
    this.res = r;
  }
  build(i) {
    const road = new RoadChunk(this.path, i, this.biome, this.res),
      terrain = makeTerrain(this.path, i, this.biome, this.res),
      scenery = makeScenery(
        this.path,
        i,
        this.biome,
        this.res,
        QUALITY[this.quality],
        terrain.userData.heightAt,
      );
    const group = new THREE.Group();
    group.add(road.group, terrain, scenery);
    this.scene.add(group);
    this.chunks.set(i, { group, road, terrain, scenery });
  }
  update(distance, time = 0, reduced = false, immediate = false) {
    this.wind.value = reduced ? 0 : time;
    const center = Math.floor(distance / ROAD.chunk),
      needed = [];
    for (let i = center - ROAD.behind; i <= center + ROAD.ahead; i++)
      if (!this.chunks.has(i)) needed.push(i);
    needed.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    for (const i of needed.slice(0, immediate ? 99 : 1)) this.build(i);
    for (const [i, c] of this.chunks) {
      if (i < center - ROAD.behind || i > center + ROAD.ahead) this.remove(i);
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
    c.scenery.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    c.group.removeFromParent();
    this.chunks.delete(i);
  }
  dispose() {
    for (const i of [...this.chunks.keys()]) this.remove(i);
    for (const v of Object.values(this.res)) if (v?.dispose) v.dispose();
  }
}
