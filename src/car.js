import * as THREE from "three";
import {
  coachwork,
  roundedBox,
  panel,
  tubing,
  reflectionTexture,
  CAR_ANCHORS,
  batchBodyMeshes,
} from "./carGeometry.js";
import { Cockpit } from "./cockpit.js";

// Original fictional Aster GT. Metre-scale coachwork, +Z forward.
export class Car {
  constructor(scene, color = 0x477c7c) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    scene.add(this.group);
    this.wheels = [];
    this.front = [];
    this.geometries = new Set();
    this.reflection = reflectionTexture();
    this.paint = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.72,
      roughness: 0.19,
      clearcoat: 1,
      clearcoatRoughness: 0.075,
      envMap: this.reflection,
    });
    this.glass = new THREE.MeshPhysicalMaterial({
      color: 0x28454e,
      metalness: 0.12,
      roughness: 0.08,
      clearcoat: 1,
      transparent: true,
      opacity: 0.64,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMap: this.reflection,
    });
    this.trim = new THREE.MeshStandardMaterial({
      color: 0x121b20,
      roughness: 0.68,
    });
    this.alloy = new THREE.MeshStandardMaterial({
      color: 0xc2cdd0,
      metalness: 0.88,
      roughness: 0.23,
      envMap: this.reflection,
    });
    this.leather = new THREE.MeshStandardMaterial({
      color: 0x3f4645,
      roughness: 0.92,
    });
    this.disc = new THREE.MeshStandardMaterial({
      color: 0x646f73,
      metalness: 0.8,
      roughness: 0.55,
    });
    this.caliper = new THREE.MeshStandardMaterial({
      color: 0xba8860,
      metalness: 0.45,
      roughness: 0.35,
    });
    this.tail = new THREE.MeshStandardMaterial({
      color: 0x9b2825,
      emissive: 0xff3c28,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    this.head = new THREE.MeshStandardMaterial({
      color: 0xf2eee2,
      emissive: 0xffefd7,
      emissiveIntensity: 0.4,
      roughness: 0.18,
    });
    this.materials = [
      this.paint,
      this.glass,
      this.trim,
      this.alloy,
      this.leather,
      this.disc,
      this.caliper,
      this.tail,
      this.head,
    ];
    const mesh = (
      g,
      m,
      x = 0,
      y = 0,
      z = 0,
      parent = this.body,
      shadow = false,
    ) => {
      this.geometries.add(g);
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.castShadow = shadow;
      o.receiveShadow = true;
      parent.add(o);
      return o;
    };
    const box = (w, h, d, m, x, y, z, parent, round = 0.035) =>
      mesh(roundedBox(w, h, d, round), m, x, y, z, parent);
    const tube = (points, r, m = this.trim) => mesh(tubing(points, r), m);
    mesh(coachwork(), this.paint, 0, 0, 0, this.body, true);
    box(1.6, 0.12, 2.3, this.trim, 0, 0.34, -0.1);
    // Softly crowned roof; separate glazing leaves an actual open cabin below it.
    const roof = new THREE.PlaneGeometry(1.28, 1.03, 18, 16);
    roof.rotateX(-Math.PI / 2);
    const rp = roof.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i),
        z = rp.getZ(i);
      rp.setXYZ(
        i,
        x,
        1.43 + 0.04 * (1 - (x / 0.64) ** 2) - 0.035 * (z / 0.515) ** 2,
        z - 0.29,
      );
    }
    roof.computeVertexNormals();
    mesh(roof, this.paint, 0, 0, 0, this.body, true);
    const liningMaterial = new THREE.MeshStandardMaterial({
      color: 0x252f31,
      roughness: 1,
      side: THREE.BackSide,
    });
    this.materials.push(liningMaterial);
    mesh(roof, liningMaterial, 0, -0.008, 0);
    tube(
      [
        [-0.6, 1.415, 0.225],
        [0, 1.455, 0.235],
        [0.6, 1.415, 0.225],
      ],
      0.032,
      this.trim,
    );
    const rear = [
      [-0.76, 0.98, -1.51],
      [-0.64, 1.415, -0.805],
      [0.64, 1.415, -0.805],
      [0.76, 0.98, -1.51],
    ];
    const front = [
      [-0.6, 1.415, 0.225],
      [-0.75, 0.965, 1.03],
      [0.75, 0.965, 1.03],
      [0.6, 1.415, 0.225],
    ];
    this.windshield = mesh(panel(front), this.glass);
    mesh(panel(rear), this.glass);
    for (const side of [-1, 1]) {
      mesh(
        panel([
          [side * 0.75, 0.965, 1.0],
          [side * 0.6, 1.415, 0.225],
          [side * 0.64, 1.415, -0.805],
          [side * 0.76, 0.98, -1.48],
        ]),
        this.glass,
      );
      tube(
        [
          [side * 0.64, 1.425, -0.8],
          [side * 0.64, 1.465, -0.29],
          [side * 0.605, 1.425, 0.225],
        ],
        0.024,
        this.paint,
      );
      tube(
        [
          [side * 0.76, 0.975, 1.045],
          [side * 0.69, 1.23, 0.59],
          [side * 0.605, 1.425, 0.225],
        ],
        0.029,
        this.paint,
      );
      tube(
        [
          [side * 0.64, 1.425, -0.805],
          [side * 0.7, 1.26, -1.08],
          [side * 0.79, 0.985, -1.51],
        ],
        0.049,
        this.paint,
      );
      tube(
        [
          [side * 0.765, 0.97, -1.48],
          [side * 0.79, 0.94, -0.2],
          [side * 0.758, 0.955, 1.01],
        ],
        0.015,
        this.alloy,
      );
      tube(
        [
          [side * 0.642, 1.417, -0.65],
          [side * 0.744, 0.969, -0.8],
        ],
        0.018,
        this.trim,
      );
      // Door shut line, flush handle and sculpted lower sill.
      tube(
        [
          [side * 0.884, 0.86, 0.58],
          [side * 0.899, 0.68, 0.6],
          [side * 0.875, 0.43, 0.46],
          [side * 0.872, 0.4, -0.91],
          [side * 0.917, 0.73, -1.02],
          [side * 0.902, 0.94, -1.02],
        ],
        0.005,
        this.trim,
      );
      box(0.02, 0.031, 0.2, this.alloy, side * 0.904, 0.88, -0.47);
      box(0.065, 0.083, 2.12, this.trim, side * 0.886, 0.365, -0.03);
      box(0.025, 0.013, 1.85, this.alloy, side * 0.923, 0.399, -0.05);
      box(0.18, 0.036, 0.09, this.trim, side * 0.861, 1.015, 0.66);
      box(
        0.24,
        0.105,
        0.25,
        this.paint,
        side * 1.0,
        1.045,
        0.67,
        undefined,
        0.047,
      );
      box(0.19, 0.061, 0.012, this.glass, side * 1.0, 1.048, 0.539);
      // Recessed light housings and the original stepped three-blade signature.
      box(0.57, 0.15, 0.022, this.trim, side * 0.435, 0.794, -2.292);
      for (let j = 0; j < 3; j++)
        box(
          0.45 - j * 0.055,
          0.018,
          0.017,
          this.tail,
          side * (0.435 + j * 0.02),
          0.842 - j * 0.045,
          -2.307,
          undefined,
          0.007,
        );
      box(0.5, 0.102, 0.021, this.trim, side * 0.4, 0.692, 2.294);
      for (let j = 0; j < 3; j++)
        box(
          0.4 - j * 0.045,
          0.014,
          0.012,
          this.head,
          side * 0.4,
          0.724 - j * 0.03,
          2.308,
          undefined,
          0.005,
        );
      tube(
        [
          [side * 0.13, 0.956, 1.03],
          [side * 0.18, 0.919, 1.51],
          [side * 0.2, 0.827, 2.1],
        ],
        0.004,
        this.trim,
      );
      box(0.075, 0.04, 0.015, this.tail, side * 0.78, 0.46, -2.23);
    }
    box(1.42, 0.19, 0.115, this.trim, 0, 0.47, -2.235, undefined, 0.06);
    box(1.4, 0.075, 0.12, this.trim, 0, 0.51, 2.24, undefined, 0.025);
    box(0.72, 0.065, 0.021, this.trim, 0, 0.567, 2.294, undefined, 0.025);
    for (const x of [-0.46, -0.23, 0, 0.23, 0.46])
      box(0.027, 0.092, 0.17, this.trim, x, 0.371, -2.17);
    box(1.4, 0.022, 0.13, this.paint, 0, 0.998, -2.06, undefined, 0.01);
    const badge = box(
      0.06,
      0.06,
      0.012,
      this.alloy,
      0,
      0.867,
      -2.325,
      undefined,
      0.012,
    );
    badge.rotation.z = Math.PI / 4;
    // Original rear identifier, generated locally rather than an imported decal.
    const decal = document.createElement("canvas");
    decal.width = 512;
    decal.height = 128;
    const dc = decal.getContext("2d");
    dc.fillStyle = "#15242b";
    dc.fillRect(0, 0, 512, 128);
    dc.fillStyle = "#c4d0c8";
    dc.textAlign = "center";
    dc.font = "32px Segoe UI";
    dc.fillText("A S T E R", 256, 55);
    dc.font = "20px Segoe UI";
    dc.fillText("G T", 256, 97);
    this.decalTexture = new THREE.CanvasTexture(decal);
    this.decalTexture.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.MeshStandardMaterial({
      map: this.decalTexture,
      roughness: 0.4,
    });
    this.materials.push(plate);
    const label = mesh(
      new THREE.PlaneGeometry(0.43, 0.108),
      plate,
      0,
      0.665,
      -2.323,
    );
    label.rotation.y = Math.PI;
    for (const side of [-1, 1]) {
      box(0.47, 0.12, 0.55, this.leather, side * 0.34, 0.5, -0.45);
      const seat = box(
        0.49,
        0.57,
        0.16,
        this.leather,
        side * 0.34,
        0.84,
        -0.89,
      );
      seat.rotation.x = -0.13;
      box(0.29, 0.18, 0.115, this.leather, side * 0.34, 1.195, -0.94);
    }
    const tireG = new THREE.TorusGeometry(0.292, 0.064, 12, 48);
    tireG.rotateY(Math.PI / 2);
    const rimG = new THREE.TorusGeometry(0.246, 0.014, 8, 40);
    rimG.rotateY(Math.PI / 2);
    const discG = new THREE.CylinderGeometry(0.22, 0.22, 0.025, 32);
    discG.rotateZ(Math.PI / 2);
    for (const z of [-1.4, 1.34])
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.94, 0.356, z);
        this.group.add(pivot);
        if (z > 0) this.front.push(pivot);
        const spin = new THREE.Group();
        pivot.add(spin);
        this.wheels.push(spin);
        mesh(tireG, this.trim, 0, 0, 0, spin, true).scale.x = 1.65;
        mesh(rimG, this.alloy, side * 0.094, 0, 0, spin);
        mesh(discG, this.disc, side * 0.074, 0, 0, spin);
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5;
          const spoke = box(
            0.035,
            0.033,
            0.205,
            this.alloy,
            side * 0.096,
            Math.sin(a) * 0.13,
            Math.cos(a) * 0.13,
            spin,
            0.01,
          );
          spoke.rotation.x = -a;
        }
        const cap = mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.05, 20),
          this.alloy,
          side * 0.1,
          0,
          0,
          spin,
        );
        cap.rotation.z = Math.PI / 2;
        box(
          0.05,
          0.11,
          0.09,
          this.caliper,
          side * 0.043,
          0,
          0.18,
          pivot,
          0.014,
        );
      }
    this.lights = [];
    for (const x of [-0.6, 0.6]) {
      const light = new THREE.SpotLight(0xffefd8, 0, 85, 0.44, 0.65, 1.35);
      light.position.set(x, 0.78, 2.1);
      light.target.position.set(x, 0.1, 38);
      this.group.add(light, light.target);
      this.lights.push(light);
    }
    batchBodyMeshes(this.body, this.geometries);
    this.cockpit = new Cockpit(this.body);
    this.bounds = { halfWidth: 1.125, halfLength: 2.34, height: 1.49 };
    this.cameraAnchors = CAR_ANCHORS;
  }
  setColor(hex) {
    this.paint.color.setHex(hex);
  }
  setCameraMode(mode) {
    this.cockpit.group.visible = mode === 3;
    this.windshield.visible = mode !== 3;
  }
  place(v, reduced = false) {
    this.group.position.set(v.x, v.y, v.z);
    this.group.rotation.set(0, v.heading, 0);
    this.body.rotation.x = -v.pitch + (reduced ? 0 : v.squat || 0);
    this.body.rotation.z =
      (v.roll || 0) +
      (reduced
        ? 0
        : -(v.steer || 0) * Math.min(Math.abs(v.speed) * 0.003, 0.07));
    this.wheels.forEach((wheel, i) => {
      wheel.parent.position.y =
        0.356 + (v.wheelHeights ? v.wheelHeights[i] - v.y : 0);
    });
    for (const w of this.front)
      w.rotation.y = v.wheelAngle ?? (v.steer || 0) * 0.42;
    this.cockpit.update(v.speed, v.steer || 0, !!v.auto);
  }
  update(dt, speed, night, braking) {
    this.paint.envMapIntensity = 1.25 - night * 0.96;
    this.glass.envMapIntensity = 0.85 - night * 0.65;
    this.alloy.envMapIntensity = 1 - night * 0.75;
    for (const w of this.wheels) w.rotation.x += (speed * dt) / 0.356;
    this.tail.emissiveIntensity = braking ? 3.5 : 0.38 + night * 1.2;
    this.head.emissiveIntensity = 0.3 + night * 2;
    for (const l of this.lights) l.intensity = night * 180;
  }
  dispose() {
    this.cockpit.dispose();
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.reflection.dispose();
    this.decalTexture.dispose();
  }
}
