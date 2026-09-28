import * as THREE from "three";
import {
  STREET_SCENES,
  ACTOR_BUDGET,
  safeStreetScene,
} from "./puneStreetDetails.js";
import {
  SHOPS,
  SHOP_CROWD,
  pedestrianPose,
  shopfronts,
} from "./puneShopfronts.js";
import { roadName } from "./cityDetails.js";
import { dressLandmark, LANDMARKS } from "./puneLandmarks.js";
import { renderEdge } from "./puneEdgeView.js";

// Static pieces join CityWorld's per-material merged chunk meshes. Only the
// bounded people instances and work lamps are updated. No timers or listeners.
export class CityActors {
  constructor(path, quality) {
    this.path = path;
    this.quality = quality;
    this.active = new Set();
    this.dummy = new THREE.Object3D();
    const mat = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...extra });
    this.res = {
      ochre: mat(0xba9760),
      teal: mat(0x356f69),
      cream: mat(0xd8caaa),
      dark: mat(0x35423f),
      leaf: mat(0x7a8d57),
      orange: mat(0xe0a458),
      skin: mat(0xae8063),
      cloth: mat(0xffffff),
      glow: mat(0xffd794, { emissive: 0xffb45b, emissiveIntensity: 0.5 }),
      workLamp: mat(0xffb32e, { emissive: 0xff9300, emissiveIntensity: 1 }),
    };
    this.box = new THREE.CapsuleGeometry(0.5, 0.4, 2, 6);
    this.head = new THREE.SphereGeometry(0.5, 8, 6);
  }
  addChunk(data, group, block, height, owned, add) {
    const records = [];
    for (const p of STREET_SCENES.filter((p) =>
      safeStreetScene(p, data, this.path),
    )) {
      const y = height(p.x, p.z),
        co = Math.cos(p.yaw),
        si = Math.sin(p.yaw),
        r = this.res;
      const b = (x, h, z, w, t, d, m) =>
        block(
          p.x + x * co + z * si,
          y + h,
          p.z - x * si + z * co,
          w,
          t,
          d,
          p.yaw,
          m,
        );
      if (p.kind !== "shops") b(0, -0.08, 0, 9, 0.16, 8, r.cream);
      dressLandmark(p, b, r);
      // A compact, original kit with safe, visibly distinct street edges.
      if (p.kind === "shops") {
        shopfronts(b, r);
        b(0, -0.06, -5.15, 3.4, 0.12, 1.8, r.ochre);
        renderEdge(
          {
            kind: "scooter",
            x: p.x - 5.15 * si,
            z: p.z - 5.15 * co,
            yaw: p.yaw + Math.PI / 2,
          },
          y,
          block,
          { solar: r.teal, rubber: r.dark, fixture: r.cream, trim: r.dark },
          add,
        );
      } else if (p.kind === "chai") {
        b(0, 0.65, 0, 3, 1.3, 1.7, r.ochre);
        b(0, 1.08, -0.92, 3.25, 0.15, 0.65, r.cream);
        b(0, 2.45, 0, 3.7, 0.18, 2.7, r.teal);
        for (const x of [-1.55, 1.55]) b(x, 1.7, 0, 0.09, 1.5, 0.09, r.dark);
        b(0, 2.15, -0.7, 2.7, 0.08, 0.12, r.glow);
        b(-0.9, 1.45, -0.45, 0.28, 0.42, 0.28, r.dark);
        b(0.1, 1.37, -0.55, 0.5, 0.15, 0.4, r.cream);
        for (const x of [-1, 0, 1]) b(x, 1.46, -0.9, 0.12, 0.2, 0.12, r.cream);
      } else if (p.kind === "stop") {
        b(0, 2.6, 0, 5, 0.2, 2.6, r.teal);
        for (const x of [-2.1, 2.1]) b(x, 1.3, 0.8, 0.13, 2.6, 0.13, r.dark);
        b(0, 0.55, 0.3, 3, 0.16, 0.6, r.ochre);
        b(0, 0.9, 0.65, 3, 0.65, 0.1, r.ochre);
        b(0, 1.5, 1, 4.3, 1.8, 0.08, r.cream);
      } else if (p.kind === "works") {
        for (const x of [-3, -1, 1, 3]) {
          b(x, 0.65, 0, 1.7, 0.8, 0.2, r.orange);
          for (const dx of [-0.65, 0.65])
            b(x + dx, 0.35, 0, 0.12, 0.7, 0.5, r.dark);
          b(x, 0.7, -0.12, 0.22, 0.75, 0.03, r.cream);
        }
        b(0, 0.18, 2, 4, 0.35, 2, r.ochre);
        b(-2, 1.6, 0.2, 0.12, 2.7, 0.12, r.dark);
        b(-2, 3, 0.2, 0.25, 0.25, 0.25, r.workLamp);
      } else {
        for (const x of [-3, -1.5, 0, 1.5, 3]) {
          b(x, 0.6, 1, 0.14, 1.2, 0.14, r.cream);
          b(x, 1.05, 1, 1.5, 0.09, 0.09, r.dark);
        }
        for (const x of [-3, 3]) {
          b(x, 0.3, -1, 0.9, 0.6, 0.9, r.cream);
          b(x, 0.95, -1, 1.3, 1.2, 1.3, r.leaf);
          b(x, 2, -1, 0.14, 2, 0.14, r.ochre);
          b(x, 2.4, -1, 1.8, 1.3, 1.7, r.leaf);
        }
      }
      // Parked scooter silhouettes, with tyres touching the local scene pad.
      if (this.quality !== "Low" && ["chai", "stop"].includes(p.kind)) {
        for (const x of [-3.7, -2.8]) {
          b(x, 0.5, 1.8, 0.38, 0.55, 1.35, r.teal);
          b(x, 0.88, 1.6, 0.48, 0.12, 0.6, r.dark);
          b(x, 1, 2.25, 0.55, 0.08, 0.1, r.dark);
          for (const z of [1.25, 2.25]) b(x, 0.22, z, 0.17, 0.44, 0.44, r.dark);
        }
      }
      const count =
        p.kind === "shops"
          ? SHOP_CROWD[this.quality]
          : p.kind === "garden"
            ? 1
            : ACTOR_BUDGET[this.quality];
      const people = new THREE.InstancedMesh(this.box, r.cloth, count * 6),
        heads = new THREE.InstancedMesh(this.head, r.skin, count);
      for (let i = 0; i < count; i++)
        for (let j = 0; j < 6; j++)
          people.setColorAt(
            i * 6 + j,
            new THREE.Color(
              j === 1 || j === 2
                ? 0x424b50
                : j === 5
                  ? 0x343632
                  : [0xc9c1aa, 0x9d7065, 0x627e92, 0x788368][i % 4],
            ),
          );
      people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      people.castShadow = heads.castShadow = true;
      group.add(people, heads);
      const record = { p, y, people, heads, count, phase: 0, near: false };
      records.push(record);
      this.active.add(record);
      const labels = p.kind === "shops" ? SHOPS : [[p.label, "", "#214c47"]];
      labels.forEach(([local, english, color], index) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1024, 128);
        ctx.strokeStyle = "#dfd1a9";
        ctx.lineWidth = 5;
        ctx.strokeRect(5, 5, 1014, 118);
        ctx.fillStyle = "#f3e3be";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "600 48px sans-serif";
        ctx.fillText(roadName(local), 512, english ? 44 : 64, 980);
        ctx.font = "500 30px sans-serif";
        if (english) ctx.fillText(english, 512, 99, 980);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          emissiveMap: texture,
          emissive: 0xffffff,
          emissiveIntensity: 0.4,
          side: THREE.DoubleSide,
        });
        const geometry = new THREE.PlaneGeometry(
            p.kind === "shops" ? 1.78 : 4,
            0.5,
          ),
          sign = new THREE.Mesh(geometry, material);
        const sx = p.kind === "shops" ? -4.75 + index * 1.9 : 0;
        const sz = p.kind === "shops" ? -0.29 : 1.2;
        sign.position.set(
          p.x + sx * co + sz * si,
          y + 3.02,
          p.z - sx * si + sz * co,
        );
        sign.rotation.y = p.yaw + (p.kind === "shops" ? Math.PI : 0);
        group.add(sign);
        owned.push(texture, material, geometry);
      });
      this.pose(record, 0);
    }
    return () => {
      for (const r of records) this.active.delete(r);
    };
  }
  pose(r, time) {
    const { p, y, count, people, heads } = r,
      co = Math.cos(p.yaw),
      si = Math.sin(p.yaw),
      d = this.dummy;
    let facing = 0,
      originX = 0,
      originZ = 0;
    const put = (mesh, i, x, h, z, w, t, l, tilt = 0) => {
      const dx = x - originX,
        dz = z - originZ;
      x = originX + dx * Math.cos(facing) + dz * Math.sin(facing);
      z = originZ - dx * Math.sin(facing) + dz * Math.cos(facing);
      d.position.set(p.x + x * co + z * si, y + h, p.z - x * si + z * co);
      d.scale.set(w, mesh === heads ? t : t / 1.4, l);
      d.rotation.set(0, p.yaw + facing, 0);
      d.rotateX(tilt);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    };
    for (let i = 0; i < count; i++) {
      const motion = pedestrianPose(p.kind, i, time);
      const { x, z } = motion;
      facing = motion.yaw;
      originX = x;
      originZ = z;
      const walk = motion.moving ? Math.sin(time * 5 + i) * 0.3 : 0;
      put(people, i * 6, x, 1.08, z, 0.42, 0.62, 0.27);
      put(people, i * 6 + 1, x - 0.13, 0.46, z, 0.15, 0.62, 0.17, walk);
      put(people, i * 6 + 2, x + 0.13, 0.46, z, 0.15, 0.62, 0.17, -walk);
      put(people, i * 6 + 3, x - 0.28, 1.13, z, 0.13, 0.5, 0.15, -walk);
      put(people, i * 6 + 4, x + 0.28, 1.13, z, 0.13, 0.5, 0.15, walk);
      put(people, i * 6 + 5, x, 0.075, z, 0.45, 0.15, 0.3);
      put(heads, i, x, 1.55, z, 0.28, 0.32, 0.28);
    }
    people.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    people.computeBoundingSphere();
    heads.computeBoundingSphere();
  }
  update(v, time, reduced, night, season, experience) {
    this.res.glow.emissiveIntensity = 0.7 + night * 2;
    this.res.workLamp.emissiveIntensity =
      reduced || this.quality === "Low"
        ? 1
        : 1 + Math.max(0, Math.sin(time * 2)) * 2;
    this.res.leaf.color.setHex(season === "Monsoon" ? 0x54875a : 0x7a8d57);
    for (const r of this.active) {
      const near = Math.hypot(v.x - r.p.x, v.z - r.p.z) < 100;
      if (near) experience?.encounter(r.p.id);
      const tick = Math.floor(time * 12);
      if (near && !reduced && this.quality !== "Low" && tick !== r.phase) {
        this.pose(r, time);
        r.phase = tick;
      }
    }
  }
  get snapshot() {
    let pedestrians = 0,
      stalls = 0,
      busStops = 0;
    for (const r of this.active) {
      pedestrians += r.count;
      stalls += Number(r.p.kind === "chai");
      busStops += Number(r.p.kind === "stop");
    }
    return {
      pedestrians,
      shops: [...this.active].some((r) => r.p.kind === "shops")
        ? SHOPS.length
        : 0,
      stalls,
      busStops,
      scenes: [...this.active].map((r) => r.p.id),
      landmarks: LANDMARKS.filter((l) =>
        [...this.active].some((r) => r.p.id === l.sceneId),
      ).map((l) => l.id),
    };
  }
  dispose() {
    this.active.clear();
    this.box.dispose();
    this.head.dispose();
    Object.values(this.res).forEach((m) => m.dispose());
  }
}
