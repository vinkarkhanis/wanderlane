import * as THREE from "three";
import { TrafficCar } from "../trafficCar.js";
import { VEHICLE_SPECS } from "./cityTrafficRules.js";
export { FLEET, VEHICLE_SPECS, followingGap } from "./cityTrafficRules.js";
export class CityVehicle extends TrafficCar {
  constructor(scene, type = "car", variant = 0) {
    super(
      scene,
      type === "bus" ? 0xba7254 : type === "rickshaw" ? 0x273c33 : 0x789b9a,
      1,
    );
    this.type = type;
    this.spec = VEHICLE_SPECS[type];
    this.modelGeometries = [];
    this.variant =
      type === "car"
        ? variant % 2
          ? "delivery"
          : "compact-hatchback"
        : type === "scooter" && variant % 2 === 0
          ? "motorcycle"
          : type;
    if (type === "car") {
      if (this.variant === "delivery") {
        const cargo = new THREE.Mesh(this.box, this.paint);
        cargo.scale.set(1.5, 0.65, 1.25);
        cargo.position.set(0, 1.5, -0.65);
        this.group.add(cargo);
      }
      this.batchBody();
      return;
    }
    this.group.clear();
    this.wheels.dispose();
    const { width: w, length: l } = this.spec;
    this.paint.color.setHex(
      type === "bus" ? 0xba7254 : type === "rickshaw" ? 0xe5bd48 : 0x73999c,
    );
    const box = (w, h, l, x, y, z, m = this.paint) => {
      const mesh = new THREE.Mesh(this.box, m);
      mesh.scale.set(w, h, l);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
    };
    const round = (w, h, l, x, y, z, m = this.paint) => {
      const g = new THREE.SphereGeometry(1, 12, 8),
        mesh = new THREE.Mesh(g, m);
      mesh.scale.set(w, h, l);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      this.modelGeometries.push(g);
    };
    const tube = (a, b, r, m = this.trim) => {
      const from = new THREE.Vector3(...a),
        to = new THREE.Vector3(...b),
        delta = to.clone().sub(from);
      const g = new THREE.CylinderGeometry(r, r, delta.length(), 8),
        mesh = new THREE.Mesh(g, m);
      mesh.position.copy(from.add(to).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      );
      this.group.add(mesh);
      this.modelGeometries.push(g);
    };
    if (type === "rickshaw") {
      box(w, 0.55, l * 0.76, 0, 0.7, -0.15, this.trim);
      box(w, 0.14, l * 0.86, 0, 1.85, -0.1);
      box(w * 0.85, 0.7, 0.12, 0, 1.3, 0.75, this.glass);
      box(w, 0.7, 0.14, 0, 1.28, -1.05, this.trim);
      for (const x of [-0.57, 0.57]) box(0.07, 1, 0.07, x, 1.3, -0.8);
      box(0.7, 0.55, 0.55, 0, 0.9, 0.92);
      box(0.7, 0.1, 0.5, 0, 0.9, -0.25, this.trim);
      round(0.69, 0.17, 1.08, 0, 1.92, -0.12, this.trim);
      round(0.48, 0.38, 0.38, 0, 0.78, 1.02);
      box(0.95, 0.12, 0.35, 0, 0.56, -1.1, this.trim);
      for (const x of [-0.58, 0.58]) {
        tube([x, 0.95, 0.55], [x, 1.83, 0.58], 0.035);
        tube([x, 0.7, -0.7], [x, 0.7, 0.6], 0.035);
        round(0.09, 0.07, 0.05, x * 1.08, 1.45, 0.76, this.trim);
      }
      // Driver silhouette seated behind the windscreen, no copied insignia.
      round(0.15, 0.18, 0.15, 0, 1.6, 0.25, this.trim);
      box(0.36, 0.4, 0.22, 0, 1.24, 0.15, this.trim);
    } else if (type === "bus") {
      box(w, 1.15, l, 0, 1, 0);
      box(w * 0.96, 0.85, l * 0.92, 0, 1.95, 0, this.glass);
      box(w, 0.15, l, 0, 2.46, 0);
      for (const z of [-2.5, -1.25, 0, 1.25, 2.5])
        box(w, 0.85, 0.08, 0, 1.95, z);
      box(w, 0.14, l, 0, 1.35, 0, this.trim);
      box(0.7, 0.75, 0.08, 0.5, 0.95, l / 2 + 0.03, this.glass);
    } else {
      box(0.38, 0.35, 1.35, 0, 0.58, 0);
      box(0.55, 0.12, 0.68, 0, 0.89, -0.2, this.trim);
      box(0.42, 0.7, 0.16, 0, 0.86, 0.55);
      box(0.7, 0.07, 0.08, 0, 1.24, 0.52, this.trim);
      // Helmeted rider: seated, feet close to the running board.
      box(0.42, 0.58, 0.28, 0, 1.35, -0.05, this.trim);
      box(0.32, 0.31, 0.32, 0, 1.81, 0.01, this.paint);
      for (const x of [-0.22, 0.22])
        box(0.13, 0.5, 0.18, x, 0.93, 0.15, this.trim);
      if (this.variant === "motorcycle") {
        box(0.46, 0.3, 0.6, 0, 0.97, 0.2, this.paint);
        box(0.1, 0.12, 1.1, 0.28, 0.4, -0.15, this.trim);
      }
      round(0.18, 0.18, 0.18, 0, 1.84, 0.01, this.paint);
      round(0.23, 0.19, 0.4, 0, 0.78, 0.25);
      for (const x of [-0.22, 0.22]) {
        tube([x, 1.52, -0.04], [x * 1.25, 1.22, 0.5], 0.055);
        tube([x, 0.96, -0.1], [x, 0.65, 0.3], 0.07);
        tube([x, 1.22, 0.52], [x * 1.65, 1.47, 0.55], 0.025);
        round(0.065, 0.055, 0.04, x * 1.65, 1.48, 0.55, this.trim);
      }
    }
    const wheelPositions =
      type === "rickshaw"
        ? [
            [-w / 2, 0.3, -0.82],
            [w / 2, 0.3, -0.82],
            [0, 0.3, 0.94],
          ]
        : type === "scooter"
          ? [
              [0, 0.28, -0.64],
              [0, 0.28, 0.67],
            ]
          : [
              [-w / 2, 0.34, -2.25],
              [w / 2, 0.34, -2.25],
              [-w / 2, 0.34, 2.25],
              [w / 2, 0.34, 2.25],
            ];
    this.wheels = new THREE.InstancedMesh(
      this.wheelGeometry,
      this.trim,
      wheelPositions.length,
    );
    const dummy = new THREE.Object3D();
    wheelPositions.forEach((p, i) => {
      dummy.position.set(...p);
      dummy.scale.set(1, type === "bus" ? 1 : 0.82, type === "bus" ? 1 : 0.82);
      dummy.updateMatrix();
      this.wheels.setMatrixAt(i, dummy.matrix);
    });
    this.group.add(this.wheels);
    box(w * 0.65, 0.13, 0.08, 0, 0.72, l / 2, this.head);
    box(w * 0.65, 0.12, 0.08, 0, 0.67, -l / 2, this.tail);
    this.bounds = { halfLength: l / 2 + 0.04, halfWidth: w / 2 + 0.11 };
    this.batchBody();
  }
  batchBody() {
    // Static body pieces become one mesh per material. Keep wheels instanced.
    const batches = new Map();
    for (const mesh of [...this.group.children]) {
      if (!mesh.isMesh || mesh.isInstancedMesh) continue;
      mesh.updateMatrix();
      const g = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      g.applyMatrix4(mesh.matrix);
      if (!batches.has(mesh.material)) batches.set(mesh.material, []);
      batches.get(mesh.material).push(g);
      mesh.removeFromParent();
    }
    for (const [material, parts] of batches) {
      const g = new THREE.BufferGeometry();
      for (const name of ["position", "normal"]) {
        const values = [];
        for (const p of parts)
          for (const v of p.attributes[name].array) values.push(v);
        g.setAttribute(name, new THREE.Float32BufferAttribute(values, 3));
      }
      g.computeBoundingSphere();
      parts.forEach((p) => p.dispose());
      this.modelGeometries.push(g);
      this.group.add(new THREE.Mesh(g, material));
    }
    const envelope = new THREE.Box3().setFromObject(this.group);
    this.bounds.halfLength = Math.max(
      this.bounds.halfLength,
      Math.abs(envelope.min.z) + 0.02,
      Math.abs(envelope.max.z) + 0.02,
    );
    this.bounds.halfWidth = Math.max(
      this.bounds.halfWidth,
      Math.abs(envelope.min.x) + 0.02,
      Math.abs(envelope.max.x) + 0.02,
    );
  }
  dispose() {
    super.dispose();
    this.modelGeometries.forEach((g) => g.dispose());
  }
}
