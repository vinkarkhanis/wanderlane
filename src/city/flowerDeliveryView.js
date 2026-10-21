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
    this.skin = material(0xbc8f70);
    this.cloth = material(0x527c80);
    this.lamp = new THREE.MeshStandardMaterial({
      color: 0xffd19a,
      emissive: 0xffa34f,
      emissiveIntensity: 1.7,
      roughness: 0.45,
    });
    this.materials.push(this.lamp);
    this.glow = new THREE.MeshBasicMaterial({
      color: 0xffc078,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    this.materials.push(this.glow);
    this.poolGeometry = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
    this.geometries.push(this.poolGeometry);
    this.lightPools = [];
    this.deliveryDoor = new THREE.Vector3();
    this.soundPosition = new THREE.Vector3();
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.bloom = new THREE.SphereGeometry(0.09, 6, 4);
    this.geometries.push(this.box, this.bloom);
    this.pickup = new THREE.Group();
    this.pickupShop = this.porch("BANER FLOWERS", false);
    this.pickupShop.rotation.y = Math.PI / 2;
    this.pickupShop.position.x = -0.3;
    this.pickup.add(this.pickupShop);
    this.pickup.userData.bouquet = this.pickupShop.userData.bouquet;
    this.destination = this.porch("THE COURTYARD", true);
    this.recipient = this.person();
    this.destination.add(this.recipient);
    this.deliveryStarted = null;
    this.deliveryProgress = 0;
    this.finishedByPlayer = false;
    this.cargo = this.wrappedBouquet();
    this.collector = this.person();
    this.pickup.add(this.collector);
    this.parcel = this.wrappedBouquet();
    this.pickup.add(this.parcel);
    this.door = new THREE.Vector3();
    scene.add(this.pickup, this.destination);
  }
  person() {
    const group = new THREE.Group();
    this.block(group, 0, 1.02, 0, 0.44, 0.65, 0.27, this.cloth);
    for (const x of [-0.12, 0.12]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.75, 0);
      this.block(leg, 0, -0.35, 0, 0.15, 0.7, 0.18, this.wood);
      this.block(leg, 0, -0.68, -0.06, 0.18, 0.14, 0.32, this.wood);
      group.add(leg);
      group.userData[x < 0 ? "leftLeg" : "rightLeg"] = leg;
    }
    const head = new THREE.Mesh(this.bloom, this.skin);
    head.scale.set(1.65, 2, 1.6);
    head.position.y = 1.55;
    group.add(head);
    this.block(group, 0, 1.72, 0.025, 0.3, 0.1, 0.28, this.wood);
    for (const x of [-0.06, 0.06])
      this.block(group, x, 1.58, -0.145, 0.025, 0.025, 0.02, this.wood);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.28, 1.27, 0);
      this.block(arm, 0, -0.18, 0, 0.13, 0.4, 0.15, this.cloth);
      this.block(arm, 0, -0.42, 0, 0.12, 0.12, 0.14, this.skin);
      group.add(arm);
      group.userData[side < 0 ? "leftArm" : "rightArm"] = arm;
    }
    return group;
  }
  posePickup(s, car, reduced) {
    const elapsed = s.pickup?.elapsed;
    const actor = this.collector;
    actor.visible = this.pickup.visible;
    this.parcel.visible =
      elapsed !== undefined && elapsed >= 0.8 && elapsed < 7.5;
    this.parcel.scale.setScalar(car.passengerSeat ? 1 : 0.7);
    const legs = actor.userData;
    legs.leftLeg.rotation.x = legs.rightLeg.rotation.x = 0;
    legs.leftArm.rotation.x = legs.rightArm.rotation.x = 0;
    if (elapsed === undefined) {
      actor.position.set(2.8, 0, -1.4);
      actor.rotation.y = -Math.PI / 2;
      return;
    }
    car.body.updateWorldMatrix(true, false);
    this.pickup.updateWorldMatrix(true, false);
    const halfWidth = car.bounds?.halfWidth ?? car.spec?.width / 2 ?? 1.1;
    const seat = car.passengerSeat ?? [0, 1.09, -0.72];
    this.door.set(halfWidth + 0.45, 0, seat[2]);
    car.body.localToWorld(this.door);
    this.pickup.worldToLocal(this.door);
    this.door.y = 0;
    const walk =
      elapsed < 2
        ? 0
        : elapsed < 5
          ? (elapsed - 2) / 3
          : elapsed < 7.5
            ? 1
            : 1 - (elapsed - 7.5) / 1.5;
    const t = reduced ? (walk > 0.5 ? 1 : 0) : walk * walk * (3 - 2 * walk);
    actor.position.set(
      3 + (this.door.x - 3) * t,
      0,
      -0.8 + (this.door.z + 0.8) * t,
    );
    actor.rotation.y =
      elapsed < 2 || elapsed >= 7.5 ? -Math.PI / 2 : Math.PI / 2;
    const walking = (elapsed >= 2 && elapsed < 5) || elapsed >= 7.5;
    const swing = walking && !reduced ? Math.sin(elapsed * 7) * 0.35 : 0;
    legs.leftLeg.rotation.x = swing;
    legs.rightLeg.rotation.x = -swing;
    legs.leftArm.rotation.x = walking ? 0.65 : 1.15;
    legs.rightArm.rotation.x = walking ? 0.65 : 1.15;
    if (elapsed < 5) {
      if (this.parcel.parent !== this.pickup) this.pickup.add(this.parcel);
      const lift = Math.min(1, Math.max(0, (elapsed - 0.8) / 1.2));
      this.parcel.position.set(
        elapsed < 2 ? 3.6 - lift * 0.25 : actor.position.x - 0.35,
        elapsed < 2 ? 1.32 - lift * 0.3 : 1.02,
        -0.8 + (actor.position.z + 0.8) * t,
      );
      this.parcel.rotation.set(0, 0, -0.1);
    } else if (elapsed < 7.5) {
      if (this.parcel.parent !== car.body) car.body.add(this.parcel);
      const progress = (elapsed - 5) / 2.5;
      const windowY = seat[1] + 0.65;
      if (!car.passengerSeat) {
        this.parcel.position.set(
          (halfWidth + 0.1) * (1 - progress),
          1.05 + 0.04 * progress,
          seat[2],
        );
        this.parcel.rotation.set(-0.9 * progress, 0, 0);
      } else if (progress < 0.35) {
        const u = progress / 0.35;
        this.parcel.position.set(
          halfWidth + 0.1 - u * 0.25,
          1.05 + (windowY - 1.05) * u,
          seat[2],
        );
        this.parcel.rotation.set(0, 0, (u * Math.PI) / 2);
      } else if (progress < 0.65) {
        const u = (progress - 0.35) / 0.3;
        this.parcel.position.set(
          (halfWidth - 0.15) * (1 - u) + seat[0] * u,
          windowY,
          seat[2],
        );
        this.parcel.rotation.set(0, 0, Math.PI / 2);
      } else {
        const u = (progress - 0.65) / 0.35;
        this.parcel.position.set(
          seat[0],
          windowY * (1 - u) + seat[1] * u,
          seat[2],
        );
        this.parcel.rotation.set(
          (car.passengerSeatTilt ?? -0.28) * u,
          0,
          (Math.PI / 2) * (1 - u) - 0.18 * u,
        );
      }
    }
    if (car.passengerWindow && elapsed >= 4.6 && elapsed < 8)
      car.passengerWindow.visible = false;
  }
  poseDelivery(progress, reduced = false) {
    const walk =
      progress < 0.3
        ? progress / 0.3
        : progress < 0.58
          ? 1
          : progress < 0.85
            ? 1 - (progress - 0.58) / 0.27
            : 0;
    const ease = walk * walk * (3 - 2 * walk);
    const door = this.deliveryDoor;
    // Walk around the front of the parked car, never through its bonnet or the
    // shared chai counter behind the porch. The return uses the same clear path.
    if (ease < 0.45)
      this.recipient.position.set(
        -0.7 + ((door.x + 0.7) * ease) / 0.45,
        0,
        3.1,
      );
    else
      this.recipient.position.set(
        door.x,
        0,
        3.1 + ((door.z - 3.1) * (ease - 0.45)) / 0.55,
      );
    const walking =
      progress > 0 && (progress < 0.3 || (progress > 0.58 && progress < 0.85));
    const swing =
      walking && !reduced ? Math.sin(progress * Math.PI * 16) * 0.3 : 0;
    this.recipient.userData.leftLeg.rotation.x = swing;
    this.recipient.userData.rightLeg.rotation.x = -swing;
    this.recipient.rotation.y = walking
      ? (ease < 0.45 ? -Math.PI / 2 : 0) + (progress > 0.58 ? Math.PI : 0)
      : 0;
    const reach =
      progress >= 0.3 && progress < 0.58
        ? Math.sin(((progress - 0.3) / 0.28) * Math.PI)
        : progress >= 0.58
          ? 0.7
          : 0;
    this.recipient.userData.leftArm.rotation.x = reach;
    this.recipient.userData.rightArm.rotation.x = reach;
    this.recipient.userData.rightArm.rotation.z =
      progress > 0.85 && !reduced
        ? Math.sin((progress - 0.85) * Math.PI * 10) * 0.4
        : 0;
    const bouquet = this.destination.userData.bouquet;
    bouquet.position.copy(this.recipient.position);
    bouquet.position.y = 1.02;
    bouquet.position.z -= 0.32;
    bouquet.scale.setScalar(0.85);
    this.deliveryProgress = progress;
  }
  finishHandover() {
    this.finishedByPlayer = true;
    this.poseDelivery(1, true);
    this.cargo.visible = false;
    this.cargoLocation = null;
    this.destination.userData.bouquet.visible = true;
  }
  get snapshot() {
    return {
      progress: this.deliveryProgress,
      beat:
        this.deliveryProgress < 0.3
          ? "approaching car"
          : this.deliveryProgress < 0.58
            ? "receiving bouquet"
            : this.deliveryProgress < 0.85
              ? "returning to porch"
              : "thank you",
      cargoLocation: this.cargoLocation ?? null,
      pickupStage: this.pickupStage ?? null,
      stage:
        this.deliveryStarted === null
          ? "waiting"
          : this.deliveryProgress < 1
            ? "receiving flowers"
            : "flowers received",
    };
  }
  block(group, x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(this.box, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    group.add(mesh);
  }
  batchStatic(group) {
    // The additional porch detail costs one draw per material, rather than per tile.
    const batches = new Map();
    for (const child of [...group.children]) {
      if (child.geometry !== this.box) continue;
      child.updateMatrix();
      if (!batches.has(child.material)) batches.set(child.material, []);
      batches.get(child.material).push(child.matrix.clone());
      group.remove(child);
    }
    for (const [material, matrices] of batches) {
      const mesh = new THREE.InstancedMesh(this.box, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      group.add(mesh);
    }
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
  wrappedBouquet() {
    const group = new THREE.Group();
    const paper = new THREE.MeshStandardMaterial({
      color: 0xd8bd91,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const cone = new THREE.CylinderGeometry(0.18, 0.035, 0.3, 16, 1, true);
    this.materials.push(paper);
    this.geometries.push(cone);
    const wrap = new THREE.Mesh(cone, paper);
    wrap.position.y = 0.18;
    group.add(wrap);
    this.block(group, 0, 0.12, 0, 0.09, 0.035, 0.09, this.cloth);
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4,
        radius = i ? 0.11 : 0;
      const x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius;
      this.block(group, x * 0.5, 0.28, z * 0.5, 0.012, 0.42, 0.012, this.leaf);
      const bloom = new THREE.Mesh(this.bloom, i % 3 ? this.pink : this.gold);
      bloom.scale.setScalar(0.7);
      bloom.position.set(x, 0.45 + (i % 3) * 0.035, z);
      group.add(bloom);
    }
    return group;
  }
  porch(title, courtyard) {
    const group = new THREE.Group();
    // Decorative pieces remain on the existing parcel, behind the parking bay.
    const awning = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      this.block(
        awning,
        -1.6 + i * 0.4,
        2.57,
        4.05,
        0.4,
        0.09,
        1.3,
        i % 2 ? this.cream : this.cloth,
      );
      this.block(
        awning,
        -1.6 + i * 0.4,
        2.43,
        3.43,
        0.4,
        0.22,
        0.07,
        i % 2 ? this.cream : this.cloth,
      );
    }
    if (!courtyard) {
      this.batchStatic(awning);
      group.add(awning);
    }
    for (const x of [-1.25, 1.25]) {
      this.block(group, x, 2.12, 4.55, 0.22, 0.3, 0.18, this.lamp);
      this.block(group, x, 2.32, 4.55, 0.3, 0.07, 0.24, this.wood);
      const pool = new THREE.Mesh(this.poolGeometry, this.glow);
      pool.position.set(x, 0.025, 4.05);
      pool.scale.set(1.2, 1, 0.8);
      group.add(pool);
      this.lightPools.push(pool);
    }
    for (let i = 0; i < 7; i++)
      this.block(
        group,
        -1.5 + i * 0.5,
        0.025,
        4.08,
        0.46,
        0.035,
        1.35,
        i % 2 ? this.cream : this.wood,
      );
    for (const x of [-1.6, 1.6]) {
      this.block(group, x, 0.25, 4.32, 0.32, 0.48, 0.32, this.wood);
      for (let i = 0; i < 3; i++)
        this.block(
          group,
          x + (i - 1) * 0.08,
          0.65 + (i % 2) * 0.13,
          4.32,
          0.13,
          0.48,
          0.18,
          this.leaf,
        );
    }
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
    if (!courtyard) {
      const backSign = new THREE.Mesh(geometry, material);
      backSign.position.set(0, 2.97, 4.605);
      this.block(group, 0, 2.97, 4.55, 3.65, 0.56, 0.08, this.wood);
      group.add(backSign);
      for (const x of [-0.8, 0]) {
        const stock = this.flowers();
        stock.scale.setScalar(0.5);
        stock.position.set(x, 1.31, 4.1);
        group.add(stock);
      }
    }
    if (courtyard) {
      // Porch frame stays behind the usable bay and outside the car's approach.
      this.block(group, 0, 1.2, 4.84, 3.5, 2.4, 0.1, this.cream);
      for (const x of [-1.5, 1.5])
        this.block(group, x, 1.2, 4.45, 0.18, 2.4, 0.5, this.wood);
      this.block(group, 0, 1.45, 4.76, 0.85, 1.5, 0.09, this.wood);
      // Warm tiled porch, planters and a shelf stay behind the usable bay.
      this.block(group, 0, 2.65, 4.12, 3.8, 0.18, 1.65, this.wood);
      this.block(group, 0, 2.51, 4.1, 2.6, 0.08, 0.1, this.gold);
      for (const x of [-1.4, 1.4]) {
        this.block(group, x, 0.23, 3.6, 0.4, 0.46, 0.44, this.wood);
        this.block(group, x, 0.65, 3.6, 0.48, 0.44, 0.48, this.leaf);
      }
      this.block(group, 0.8, 1.28, 4.1, 0.95, 0.08, 0.65, this.wood);
    }
    this.batchStatic(group);
    const bouquet = courtyard ? this.wrappedBouquet() : this.flowers();
    bouquet.position.set(0.8, 1.32, 4.1);
    group.add(bouquet);
    group.userData.bouquet = bouquet;
    return group;
  }
  update(s, world, car, cameraMode, time = 0, reduced = false) {
    const visible =
      s?.tripId === "flower-delivery" &&
      ["active", "completed"].includes(s.status);
    this.pickup.visible = this.destination.visible = !!visible;
    this.cargo.visible =
      !!visible && (s.cargo === "onboard" || (s.pickup?.elapsed ?? 0) >= 7.5);
    // Follow body pitch/roll instead of hovering over the boot. On the bike
    // the smaller bundle rests on the rear pillion, behind the rider.
    if (this.cargo.parent !== car.body) car.body.add(this.cargo);
    const seat = car.passengerSeat;
    this.cargo.position.fromArray(seat ?? [0, 1.09, -0.72]);
    this.cargo.rotation.set(
      seat ? (car.passengerSeatTilt ?? -0.28) : -0.9,
      0,
      seat ? -0.18 : 0,
    );
    this.cargo.scale.setScalar(seat ? 1 : 0.7);
    this.cargoLocation = this.cargo.visible
      ? seat
        ? "passenger seat"
        : "rear pillion"
      : null;
    if (!visible || s.cargo !== "delivered") {
      this.deliveryStarted = null;
      this.finishedByPlayer = false;
      this.poseDelivery(0, true);
    }
    if (!visible) {
      this.parcel.visible = this.collector.visible = false;
      this.pickupStage = null;
      return;
    }
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
    this.pickup.userData.bouquet.visible =
      s.cargo === "awaiting pickup" && (s.pickup?.elapsed ?? 0) < 0.8;
    this.pickupStage = s.pickup?.stage ?? null;
    this.posePickup(s, car, reduced);
    car.body.updateWorldMatrix(true, false);
    this.destination.updateWorldMatrix(true, false);
    this.deliveryDoor.set(
      (car.bounds?.halfWidth ?? 1) + 0.6,
      0,
      car.passengerSeat?.[2] ?? 0,
    );
    car.body.localToWorld(this.deliveryDoor);
    this.destination.worldToLocal(this.deliveryDoor);
    this.deliveryDoor.y = 0;
    // A player who has already departed sees the recipient safely on the porch.
    if (Math.hypot(this.deliveryDoor.x + 0.7, this.deliveryDoor.z - 3.1) > 7)
      this.deliveryDoor.set(-0.7, 0, 3.1);
    if (s.cargo !== "delivered") {
      this.recipient.rotation.y = 0;
      const distance = Math.hypot(
        car.group.position.x - this.destination.position.x,
        car.group.position.z - this.destination.position.z,
      );
      this.recipient.userData.rightArm.rotation.z =
        distance < 25 && !reduced ? -0.35 - Math.sin(time * 2.5) * 0.15 : 0;
    }
    this.destination.userData.bouquet.visible = s.cargo === "delivered";
    if (s.cargo === "delivered") {
      this.deliveryStarted ??= time;
      this.poseDelivery(
        reduced || this.finishedByPlayer
          ? 1
          : Math.min(1, (time - this.deliveryStarted) / 8),
        reduced,
      );
      this.destination.userData.bouquet.visible = this.deliveryProgress >= 0.42;
      this.cargo.visible = this.deliveryProgress < 0.42;
      this.cargoLocation = this.cargo.visible
        ? seat
          ? "passenger seat"
          : "rear pillion"
        : null;
    }
  }
  nearestSound(camera) {
    let nearest = null;
    for (const group of [this.pickup, this.destination]) {
      if (!group.visible) continue;
      this.soundPosition.set(0, 1.3, 4.1).applyMatrix4(group.matrixWorld);
      const distance = camera.distanceTo(this.soundPosition);
      if (distance < 28 && (!nearest || distance < nearest.distance))
        nearest = {
          x: this.soundPosition.x,
          z: this.soundPosition.z,
          distance,
        };
    }
    return nearest;
  }
  dispose() {
    for (const group of [
      this.pickup,
      this.destination,
      this.cargo,
      this.parcel,
    ])
      group.removeFromParent();
    for (const resource of [
      ...this.geometries,
      ...this.materials,
      ...this.textures,
    ])
      resource.dispose();
  }
}
