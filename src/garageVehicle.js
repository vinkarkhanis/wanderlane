import * as THREE from "three";
import {
  roundedBox,
  tubing,
  reflectionTexture,
  batchBodyMeshes,
} from "./carGeometry.js";
import { Cockpit } from "./cockpit.js";
import { Car } from "./car.js";
import { buildCoachwork } from "./garageCoachwork.js";

export function createVehicleModel(scene, spec, color) {
  return spec.id === "gt"
    ? new Car(scene, color)
    : new GarageVehicle(scene, spec, color);
}

class GarageVehicle {
  constructor(scene, spec, color) {
    this.spec = spec;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    scene.add(this.group);
    this.geometries = new Set();
    this.materials = [];
    this.textures = new Set();
    this.wheels = [];
    this.front = [];
    const material = (color, metalness = 0, roughness = 0.6) => {
      const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
      this.materials.push(m);
      return m;
    };
    this.reflection = reflectionTexture();
    this.paint = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.72,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMap: this.reflection,
    });
    this.materials.push(this.paint);
    const trim = material(0x17232a),
      rubber = material(0x111519),
      alloy = material(0xaebfc7, 0.8, 0.3);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x28454e,
      metalness: 0.1,
      roughness: 0.08,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMap: this.reflection,
      clearcoat: 1,
    });
    this.materials.push(glass);
    this.glass = glass;
    this.alloy = alloy;
    alloy.envMap = this.reflection;
    this.head = material(0xfff1d6);
    this.head.emissive.setHex(0xffefd7);
    this.tail = material(0xaa2020);
    this.tail.emissive.setHex(0xff3020);
    const mesh = (g, m, x, y, z, parent = this.body) => {
      this.geometries.add(g);
      const obj = new THREE.Mesh(g, m);
      obj.position.set(x, y, z);
      obj.castShadow = true;
      obj.receiveShadow = true;
      parent.add(obj);
      return obj;
    };
    const box = (w, h, d, m, x, y, z, r = 0.06, parent) =>
      mesh(roundedBox(w, h, d, r), m, x, y, z, parent);
    const tube = (points, radius, mat = alloy, parent = this.body) =>
      mesh(tubing(points, radius), mat, 0, 0, 0, parent);
    const { width: w, length: l, height: h, radius: r, kind } = spec;
    const bike = kind === "bike";
    for (let axle = 0; axle < 2; axle++) {
      for (const side of bike ? [0] : [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(
          side * spec.physics.halfTrack,
          r,
          spec.physics.axles[axle],
        );
        this.body.add(pivot);
        const spin = new THREE.Group();
        pivot.add(spin);
        const tire = new THREE.TorusGeometry(r * 0.81, r * 0.19, 16, 48);
        tire.rotateY(Math.PI / 2);
        const tireMesh = mesh(tire, rubber, 0, 0, 0, spin);
        tireMesh.scale.x = bike ? 1.18 : 1.8;
        for (const face of [-1, 1]) {
          const lip = new THREE.TorusGeometry(r * 0.64, 0.014, 8, 40);
          lip.rotateY(Math.PI / 2);
          mesh(lip, alloy, face * (bike ? 0.062 : 0.103), 0, 0, spin);
          const disc = new THREE.CylinderGeometry(
            r * 0.53,
            r * 0.53,
            0.012,
            32,
          );
          disc.rotateZ(Math.PI / 2);
          mesh(disc, alloy, face * 0.042, 0, 0, spin);
          for (let spoke = 0; spoke < (bike ? 8 : 6); spoke++) {
            const a = (spoke * Math.PI * 2) / (bike ? 8 : 6);
            const bar = box(
              0.028,
              r * 0.5,
              0.04,
              alloy,
              face * (bike ? 0.07 : 0.105),
              Math.cos(a) * r * 0.37,
              Math.sin(a) * r * 0.37,
              0.005,
              spin,
            );
            bar.rotation.x = a;
          }
          const hub = new THREE.CylinderGeometry(r * 0.14, r * 0.14, 0.03, 16);
          hub.rotateZ(Math.PI / 2);
          mesh(hub, alloy, face * (bike ? 0.072 : 0.11), 0, 0, spin);
          box(
            0.035,
            0.12,
            0.075,
            trim,
            face * 0.025,
            0,
            r * 0.42,
            0.015,
            pivot,
          );
        }
        // Individually angled tread blocks; static wheel meshes batch below.
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          const tread = mesh(
            new THREE.BoxGeometry(bike ? 0.065 : 0.14, 0.013, 0.019),
            trim,
            0,
            Math.cos(a) * (r - 0.003),
            Math.sin(a) * (r - 0.003),
            spin,
          );
          tread.rotation.x = a;
        }
        batchBodyMeshes(spin, this.geometries, this.group);
        this.wheels.push({
          spin,
          pivot,
          contact: bike ? axle * 2 : axle * 2 + (side === 1 ? 1 : 0),
        });
        if (axle === 1) this.front.push(pivot);
      }
    }
    if (bike) {
      const crank = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 32);
      crank.rotateZ(Math.PI / 2);
      mesh(crank, alloy, 0, 0.58, -0.12);
      for (let i = 0; i < 8; i++)
        box(0.3, 0.018, 0.23, alloy, 0, 0.66 + i * 0.025, 0.025, 0.012);
      box(0.2, 0.22, 0.05, trim, 0, 0.74, 0.35, 0.02);
      const tank = mesh(
        new THREE.SphereGeometry(0.32, 20, 12),
        this.paint,
        0,
        0.99,
        0.17,
      );
      tank.scale.set(0.75, 0.65, 1.2);
      const cap = new THREE.CylinderGeometry(0.045, 0.045, 0.012, 24);
      mesh(cap, alloy, 0, 1.194, 0.13);
      box(0.32, 0.13, 0.73, trim, 0, 1.01, -0.36);
      box(0.28, 0.13, 0.4, this.paint, 0, 0.89, -0.87);
      tube(
        [
          [0, 0.38, -0.74],
          [0, 0.72, -0.28],
          [0, 0.92, 0.4],
          [0, 0.38, 0.74],
        ],
        0.045,
        trim,
      );
      for (const side of [-1, 1]) {
        tube(
          [
            [side * 0.1, 0.35, 0.74],
            [side * 0.1, 1.18, 0.56],
          ],
          0.04,
        );
        tube(
          [
            [side * 0.08, 1.18, 0.56],
            [side * 0.4, 1.22, 0.42],
          ],
          0.03,
        );
        box(0.2, 0.05, 0.07, trim, side * 0.37, 1.22, 0.42);
        tube(
          [
            [side * 0.34, 1.22, 0.42],
            [side * 0.38, 1.47, 0.44],
          ],
          0.015,
        );
        box(0.17, 0.1, 0.055, alloy, side * 0.38, 1.49, 0.44);
        // Swingarm, rear coil spring and triangular supporting subframe.
        tube(
          [
            [side * 0.115, 0.58, -0.08],
            [side * 0.115, 0.34, -0.74],
          ],
          0.028,
          trim,
        );
        tube(
          [
            [side * 0.12, 0.54, -0.58],
            [side * 0.12, 0.93, -0.42],
          ],
          0.026,
          alloy,
        );
        for (let i = 0; i < 9; i++) {
          const ring = new THREE.TorusGeometry(0.04, 0.009, 6, 16);
          ring.rotateX(Math.PI / 2);
          mesh(ring, alloy, side * 0.12, 0.58 + i * 0.034, -0.565 + i * 0.014);
        }
        tube(
          [
            [side * 0.1, 0.72, -0.1],
            [side * 0.13, 0.89, -0.77],
            [side * 0.11, 0.9, -0.12],
          ],
          0.022,
          trim,
        );
      }
      tube(
        [
          [0.12, 0.68, 0.2],
          [0.19, 0.38, 0.12],
          [0.22, 0.38, -0.3],
        ],
        0.03,
        alloy,
      );
      const exhaust = new THREE.CylinderGeometry(0.07, 0.055, 0.53, 24);
      exhaust.rotateX(Math.PI / 2);
      mesh(exhaust, alloy, 0.22, 0.47, -0.58);
      const exhaustHole = new THREE.CylinderGeometry(0.044, 0.044, 0.008, 20);
      exhaustHole.rotateX(Math.PI / 2);
      mesh(exhaustHole, trim, 0.22, 0.47, -0.85);
      tube(
        [
          [-0.13, 0.38, -0.73],
          [-0.13, 0.55, -0.1],
          [-0.13, 0.59, -0.14],
          [-0.13, 0.32, -0.73],
        ],
        0.009,
        alloy,
      );
      const lamp = new THREE.CylinderGeometry(0.105, 0.105, 0.1, 32);
      lamp.rotateX(Math.PI / 2);
      mesh(lamp, trim, 0, 1.12, 0.67);
      const lens = new THREE.CylinderGeometry(0.089, 0.089, 0.012, 32);
      lens.rotateX(Math.PI / 2);
      mesh(lens, this.head, 0, 1.12, 0.726);
      const lampRing = new THREE.TorusGeometry(0.094, 0.01, 8, 32);
      mesh(lampRing, alloy, 0, 1.12, 0.735);
      for (const z of spec.physics.axles) {
        const positions = [],
          indices = [];
        for (let i = 0; i <= 20; i++) {
          const a = 0.12 + (i / 20) * (Math.PI - 0.24);
          for (const x of [-0.095, 0.095])
            positions.push(
              x,
              r + Math.sin(a) * (r + 0.035),
              z + Math.cos(a) * (r + 0.035),
            );
          if (i < 20) {
            const j = i * 2;
            indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
          }
        }
        const fender = new THREE.BufferGeometry();
        fender.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        fender.setIndex(indices);
        fender.computeVertexNormals();
        mesh(fender, this.paint, 0, 0, 0);
      }
      box(0.18, 0.08, 0.07, this.tail, 0, 0.95, -1.03);
      // Helmeted rider: an intentionally stylized silhouette with hands on bars.
      const beforeRider = new Set(this.body.children);
      const jacket = material(0x394953),
        pants = material(0x253038);
      const torso = mesh(
        new THREE.SphereGeometry(1, 24, 18),
        jacket,
        0,
        1.4,
        -0.25,
      );
      torso.scale.set(0.225, 0.29, 0.155);
      torso.rotation.x = 0.2;
      const hips = mesh(
        new THREE.SphereGeometry(1, 20, 14),
        pants,
        0,
        1.115,
        -0.43,
      );
      hips.scale.set(0.2, 0.13, 0.2);
      tube(
        [
          [0, 1.2, -0.397],
          [0, 1.42, -0.398],
          [0, 1.62, -0.3],
        ],
        0.005,
        alloy,
      );
      const neck = mesh(
        new THREE.SphereGeometry(0.075, 16, 12),
        trim,
        0,
        1.66,
        -0.15,
      );
      neck.scale.y = 0.9;
      mesh(new THREE.SphereGeometry(0.19, 20, 14), this.paint, 0, 1.84, -0.12);
      const visor = mesh(
        new THREE.SphereGeometry(
          0.198,
          32,
          12,
          0.28,
          Math.PI - 0.56,
          1.2,
          0.65,
        ),
        material(0x121c2a, 0.45, 0.16),
        0,
        1.84,
        -0.12,
      );
      const chin = box(0.23, 0.056, 0.09, trim, 0, 1.71, 0.006, 0.03);
      for (const side of [-1, 1]) {
        tube(
          [
            [side * 0.21, 1.56, -0.2],
            [side * 0.29, 1.31, 0.15],
            [side * 0.37, 1.22, 0.42],
          ],
          0.075,
          jacket,
        );
        tube(
          [
            [side * 0.14, 1.14, -0.45],
            [side * 0.27, 0.83, -0.08],
            [side * 0.23, 0.54, -0.35],
          ],
          0.09,
          pants,
        );
        box(0.15, 0.1, 0.28, trim, side * 0.23, 0.49, -0.29);
        mesh(
          new THREE.SphereGeometry(0.07, 16, 12),
          trim,
          side * 0.37,
          1.22,
          0.42,
        );
        const shoulder = mesh(
          new THREE.SphereGeometry(0.105, 16, 12),
          jacket,
          side * 0.195,
          1.54,
          -0.21,
        );
        shoulder.scale.y = 1.2;
        const knee = mesh(
          new THREE.SphereGeometry(0.09, 16, 12),
          trim,
          side * 0.27,
          0.83,
          -0.08,
        );
        knee.scale.set(0.7, 1.1, 0.8);
      }
      this.riderParts = this.body.children.filter((o) => !beforeRider.has(o));
      const rider = new THREE.Group();
      this.body.add(rider);
      for (const part of this.riderParts) rider.add(part);
      this.riderParts = [rider];
      batchBodyMeshes(rider, this.geometries);
      // Rider view retains the visible handlebar and instrument pod.
      const instruments = new THREE.Group();
      this.body.add(instruments);
      box(0.22, 0.07, 0.14, trim, 0, 1.22, 0.48, 0.02, instruments);
      const display = document.createElement("canvas");
      display.width = 256;
      display.height = 128;
      const displayTexture = new THREE.CanvasTexture(display);
      displayTexture.colorSpace = THREE.SRGBColorSpace;
      this.textures.add(displayTexture);
      const displayMaterial = new THREE.MeshBasicMaterial({
        map: displayTexture,
      });
      this.materials.push(displayMaterial);
      const screen = mesh(
        new THREE.PlaneGeometry(0.18, 0.09),
        displayMaterial,
        0,
        1.261,
        0.48,
        instruments,
      );
      screen.rotation.x = -Math.PI / 2;
      const drawSpeed = (speed) => {
        const ctx = display.getContext("2d");
        ctx.fillStyle = "#091c22";
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = "#8bf1dd";
        ctx.font = "bold 60px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(Math.round(Math.abs(speed) * 3.6)), 128, 72);
        ctx.font = "18px monospace";
        ctx.fillText("KM/H  ·  KESTREL", 128, 105);
        displayTexture.needsUpdate = true;
      };
      drawSpeed(0);
      this.cockpit = {
        group: instruments,
        wheel: this.front[0],
        lastSpeed: 0,
        update(speed) {
          if (
            Math.round(Math.abs(speed) * 3.6) !==
            Math.round(Math.abs(this.lastSpeed) * 3.6)
          )
            drawSpeed(speed);
          this.lastSpeed = speed;
        },
        dispose() {},
      };
      this.cockpitAnchor = [0, 1.6, -0.65];
    } else {
      const cabin = buildCoachwork(spec, {
        mesh,
        box,
        tube,
        paint: this.paint,
        trim,
        alloy,
        glass,
        head: this.head,
        tail: this.tail,
        material,
      });
      this.cockpit = new Cockpit(this.body, spec.name);
      this.cockpit.group.position.set(
        0,
        cabin.roof - 1.45,
        cabin.cabinZ + 0.12,
      );
      this.cockpitAnchor = cabin.cockpitAnchor;
      this.windows = cabin.windows;
    }
    this.bumperAnchor = [0, bike ? 1.25 : h * 0.65, l / 2 + 0.14];
    batchBodyMeshes(this.body, this.geometries);
    this.cameraHeight = Math.max(0, h - 1.48);
    this.lights = [];
    for (const x of bike ? [0] : [-w * 0.32, w * 0.32]) {
      const light = new THREE.SpotLight(0xffefd8, 0, 85, 0.44, 0.65, 1.35);
      light.position.set(x, bike ? 1.1 : r + 0.4, l / 2);
      light.target.position.set(x, 0.1, 38);
      this.group.add(light, light.target);
      this.lights.push(light);
    }
  }
  setColor(hex) {
    this.paint.color.setHex(hex);
  }
  setCameraMode(mode) {
    for (const part of this.riderParts || []) part.visible = mode !== 3;
    this.cockpit.group.visible = mode === 3;
    for (const window of this.windows || []) window.visible = mode !== 3;
  }
  place(v, reduced = false) {
    this.group.position.set(v.x, v.y, v.z);
    this.group.rotation.set(0, v.heading, 0);
    this.body.rotation.x = -v.pitch + (reduced ? 0 : v.squat || 0);
    const lean =
      this.spec.kind === "bike"
        ? Math.max(
            -0.35,
            Math.min(0.35, -(v.steer || 0) * Math.abs(v.speed) * 0.025),
          )
        : -(v.steer || 0) * Math.min(Math.abs(v.speed) * 0.003, 0.06);
    this.body.rotation.z = (v.roll || 0) + (reduced ? 0 : lean);
    for (const { pivot, contact } of this.wheels)
      pivot.position.y =
        this.spec.radius + (v.wheelHeights ? v.wheelHeights[contact] - v.y : 0);
    for (const pivot of this.front) pivot.rotation.y = v.wheelAngle || 0;
    this.cockpit.update(v.speed, v.steer || 0, !!v.auto);
  }
  update(dt, speed, night, braking) {
    this.paint.envMapIntensity = 1.25 - night * 0.96;
    this.glass.envMapIntensity = 0.85 - night * 0.65;
    this.alloy.envMapIntensity = 1 - night * 0.75;
    for (const { spin } of this.wheels)
      spin.rotation.x += (speed * dt) / this.spec.radius;
    this.tail.emissiveIntensity = braking ? 3.5 : 0.38 + night * 1.2;
    this.head.emissiveIntensity = 0.3 + night * 2;
    for (const light of this.lights) light.intensity = night * 180;
  }
  dispose() {
    this.cockpit.dispose();
    this.group.removeFromParent();
    this.reflection.dispose();
    for (const texture of this.textures) texture.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
