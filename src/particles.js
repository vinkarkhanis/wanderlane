import * as THREE from "three";
import { random } from "./random.js";
export class Particles {
  constructor(scene) {
    const r = random(8273),
      data = [];
    for (let i = 0; i < 160; i++)
      data.push((r() - 0.5) * 100, r() * 18, (r() - 0.5) * 100);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data, 3),
    );
    this.base = new Float32Array(data);
    this.mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    scene.add(this.points);
  }
  update(v, biome, night, time, reduced) {
    this.points.visible =
      !reduced &&
      (biome === "snow" ||
        biome === "desert" ||
        (biome === "meadow" && night > 0.6));
    if (!this.points.visible) return;
    this.points.position.set(v.x, v.y, v.z);
    this.mat.color.setHex(
      biome === "snow" ? 0xeaf0f3 : biome === "desert" ? 0xd7b78b : 0xe5dd8a,
    );
    this.mat.size = biome === "meadow" ? 0.11 : 0.12;
    const a = this.geo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const k = i * 3;
      a.setXYZ(
        i,
        this.base[k] + Math.sin(time * 0.3 + i) * 1.5,
        ((this.base[k + 1] - (biome === "snow" ? time : 0) * 0.6) % 18) +
          (biome === "snow" ? 18 : 0),
        this.base[k + 2],
      );
    }
    a.needsUpdate = true;
  }
}
