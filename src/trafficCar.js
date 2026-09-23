import * as THREE from "three";

// Fictional commuter family: sedan, hatch, utility and small van. Kept simpler
// than the hero car: ten draw calls, shared wheel geometry, no shadow maps.
export class TrafficCar {
  constructor(scene, color, variant = 0) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const dimensions = [
      [1.78, 1.4, 4.4],
      [1.75, 1.48, 3.9],
      [1.9, 1.72, 4.45],
      [1.88, 1.95, 4.5],
    ][variant];
    const [width, height, length] = dimensions;
    this.paint = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.35,
      roughness: 0.4,
    });
    this.glass = new THREE.MeshStandardMaterial({
      color: 0x284047,
      metalness: 0.4,
      roughness: 0.3,
    });
    this.trim = new THREE.MeshStandardMaterial({
      color: 0x263238,
      roughness: 0.85,
    });
    this.tail = new THREE.MeshStandardMaterial({
      color: 0xc64736,
      emissive: 0xff392a,
    });
    this.head = new THREE.MeshStandardMaterial({
      color: 0xf2e9d0,
      emissive: 0xffeed2,
    });
    this.materials = [this.paint, this.glass, this.trim, this.tail, this.head];
    this.box = new THREE.BoxGeometry(1, 1, 1);
    const box = (w, h, l, x, y, z, m) => {
      const mesh = new THREE.Mesh(this.box, m);
      mesh.scale.set(w, h, l);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
    };
    box(width, 0.55, length, 0, 0.65, 0, this.paint);
    box(
      width * 0.84,
      height - 0.86,
      length * (variant === 3 ? 0.73 : variant === 0 ? 0.46 : 0.59),
      0,
      (height + 0.86) / 2,
      -0.25,
      this.glass,
    );
    box(
      width * 0.87,
      0.07,
      length * (variant === 3 ? 0.74 : variant === 0 ? 0.44 : 0.56),
      0,
      height,
      -0.25,
      this.paint,
    );
    box(width * 0.9, 0.15, 0.06, 0, 0.48, -length / 2 - 0.01, this.trim);
    for (const side of [-1, 1]) {
      box(
        0.42,
        0.13,
        0.06,
        side * width * 0.32,
        0.79,
        -length / 2 - 0.02,
        this.tail,
      );
      box(
        0.44,
        0.12,
        0.06,
        side * width * 0.32,
        0.8,
        length / 2 + 0.02,
        this.head,
      );
    }
    this.wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.21, 12);
    this.wheelGeometry.rotateZ(Math.PI / 2);
    this.wheels = new THREE.InstancedMesh(this.wheelGeometry, this.trim, 4);
    const matrix = new THREE.Matrix4();
    let i = 0;
    for (const z of [-length * 0.31, length * 0.3])
      for (const x of [-width / 2, width / 2])
        this.wheels.setMatrixAt(i++, matrix.makeTranslation(x, 0.34, z));
    this.group.add(this.wheels);
    this.bounds = {
      halfLength: length / 2 + 0.04,
      halfWidth: width / 2 + 0.11,
    };
  }
  place(v) {
    this.group.position.set(v.x, v.y, v.z);
    this.group.rotation.set(-v.pitch, v.heading, 0);
  }
  update(dt, speed, night, braking) {
    this.tail.emissiveIntensity = braking ? 3 : night * 1.8 + 0.25;
    this.head.emissiveIntensity = night * 3 + 0.25;
    this.paint.envMapIntensity = 1 - night * 0.8;
    this.glass.envMapIntensity = 1 - night * 0.8;
  }
  dispose() {
    this.group.removeFromParent();
    this.box.dispose();
    this.wheelGeometry.dispose();
    this.wheels.dispose();
    for (const m of this.materials) m.dispose();
  }
}
