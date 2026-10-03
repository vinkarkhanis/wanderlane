import * as THREE from "three";

export class FlightView {
  constructor(scene, car) {
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 2.7, 48),
      new THREE.MeshBasicMaterial({
        color: 0x8de6d8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
    const geo = new THREE.ConeGeometry(0.16, 0.7, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x93e9e4,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.jets = new THREE.Group();
    for (const x of [-0.8, 0.8])
      for (const z of [-1.4, 1.34]) {
        const jet = new THREE.Mesh(geo, mat);
        jet.rotation.z = Math.PI;
        jet.position.set(x, -0.15, z);
        this.jets.add(jet);
      }
    car.group.add(this.jets);
    this.jets.visible = false;
  }
  update(v, time, reduced) {
    this.jets.visible = v.flight !== "ground";
    this.jets.scale.y = reduced ? 1 : 1 + Math.sin(time * 12) * 0.08;
    this.ring.visible = v.flight === "landing";
    if (this.ring.visible) {
      const t = v.flightTarget;
      this.ring.position.set(t.x, t.y + 0.1, t.z);
    }
  }
}
