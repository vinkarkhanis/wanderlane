import * as THREE from "three";

// Shared story props follow the existing streamed, validated parking parcels.
export class FlowerDeliveryView {
  constructor(scene) {
    this.geometries = [];
    this.materials = [];
    this.textures = [];
    const material = (color) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
      this.materials.push(m);
      return m;
    };
    this.wood = material(0x805b42);
    this.leaf = material(0x407f57);
    this.pink = material(0xff6fa0);
    this.gold = material(0xffcc57);
    this.cream = material(0xf2ddbf);
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.bloom = new THREE.SphereGeometry(0.09, 6, 4);
    this.geometries.push(this.box, this.bloom);
    this.pickup = this.porch("BANER FLOWERS", false);
    this.destination = this.porch("THE COURTYARD", true);
    this.cargo = this.flowers();
    this.cargo.scale.setScalar(0.65);
    scene.add(this.pickup, this.destination);
  }
  block(group, x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(this.box, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    group.add(mesh);
  }
  flowers() {
    const group = new THREE.Group();
    this.block(group, 0, 0.1, 0, 0.65, 0.2, 0.4, this.wood);
    for (let i = 0; i < 12; i++) {
      const x = ((i % 4) - 1.5) * 0.14,
        z = (Math.floor(i / 4) - 1) * 0.13;
      this.block(group, x, 0.25, z, 0.018, 0.3, 0.018, this.leaf);
      const head = new THREE.Mesh(this.bloom, i % 2 ? this.pink : this.gold);
      head.position.set(x, 0.4 + (i % 3) * 0.035, z);
      group.add(head);
    }
    return group;
  }
  porch(title, courtyard) {
    const group = new THREE.Group();
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const c = canvas.getContext("2d");
    c.fillStyle = "#244b48";
    c.fillRect(0, 0, 1024, 128);
    c.fillStyle = "#ffdfab";
    c.font = "bold 60px Georgia";
    c.textAlign = "center";
    c.fillText(title, 512, 70);
    c.font = "24px sans-serif";
    c.fillText("A fictional neighbourhood stop", 512, 108);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(3.5, 0.46);
    this.textures.push(texture);
    this.materials.push(material);
    this.geometries.push(geometry);
    const sign = new THREE.Mesh(geometry, material);
    sign.rotation.y = Math.PI;
    sign.position.set(0, 2.39, 2.98);
    group.add(sign);
    if (courtyard) {
      // Porch frame stays behind the usable bay and outside the car's approach.
      this.block(group, 0, 1.2, 4.84, 3.5, 2.4, 0.1, this.cream);
      for (const x of [-1.5, 1.5])
        this.block(group, x, 1.2, 4.45, 0.18, 2.4, 0.5, this.wood);
      this.block(group, 0, 1.45, 4.76, 0.85, 1.5, 0.09, this.wood);
    }
    const bouquet = this.flowers();
    bouquet.position.set(0.8, 1.32, 4.1);
    group.add(bouquet);
    group.userData.bouquet = bouquet;
    return group;
  }
  update(s, world, car, cameraMode) {
    const visible =
      s?.tripId === "flower-delivery" &&
      ["active", "completed"].includes(s.status);
    this.pickup.visible = this.destination.visible = !!visible;
    this.cargo.visible = visible && s.cargo === "onboard" && cameraMode !== 3;
    if (this.cargo.parent !== car.group) car.group.add(this.cargo);
    this.cargo.position.set(
      0,
      car.spec?.kind === "bike" ? 0.85 : 1.05,
      car.spec?.kind === "bike" ? -0.65 : -1.65,
    );
    if (!visible) return;
    for (const [group, id] of [
      [this.pickup, "baner-pause"],
      [this.destination, "pashan-chai"],
    ]) {
      const stop = [...(world.chaiStops?.stops.values() ?? [])]
        .flat()
        .find((stop) => stop.place.id === id);
      group.visible = !!stop && stop.group.visible;
      if (stop) {
        group.position.copy(stop.group.position);
        group.rotation.copy(stop.group.rotation);
      }
    }
    this.pickup.userData.bouquet.visible = s.cargo === "awaiting pickup";
    this.destination.userData.bouquet.visible = s.cargo === "delivered";
  }
  dispose() {
    for (const group of [this.pickup, this.destination, this.cargo])
      group.removeFromParent();
    for (const resource of [
      ...this.geometries,
      ...this.materials,
      ...this.textures,
    ])
      resource.dispose();
  }
}
