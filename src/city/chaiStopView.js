import * as THREE from "three";

// Shared resources for the two validated parcels; no shadows or allocations
// during animation. Chunk removal also removes its lights and sprites.
export class ChaiStopView {
  constructor(quality) {
    this.quality = quality;
    this.stops = new Map();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,244,222,0.5)");
    gradient.addColorStop(0.4, "rgba(255,244,222,0.2)");
    gradient.addColorStop(1, "rgba(255,244,222,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    this.texture = new THREE.CanvasTexture(canvas);
    this.steam = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
    this.bulb = new THREE.MeshBasicMaterial({ color: 0xffd08b });
    this.sphere = new THREE.SphereGeometry(0.09, 8, 6);
  }
  addChunk(id, places, parent, height) {
    const groups = places.map((place) => {
      const group = new THREE.Group();
      group.position.set(place.x, height(place.x, place.z), place.z);
      group.rotation.y = place.yaw;
      const lamp = new THREE.Mesh(this.sphere, this.bulb);
      lamp.position.set(0, 2.0, 3.8);
      group.add(lamp);
      let light;
      if (this.quality !== "Low") {
        light = new THREE.PointLight(0xffc27b, 4, 12, 2);
        light.position.copy(lamp.position);
        group.add(light);
      }
      const puffs = [];
      for (let i = 0; i < (this.quality === "Low" ? 3 : 6); i++) {
        const puff = new THREE.Sprite(this.steam);
        group.add(puff);
        puffs.push(puff);
      }
      parent.add(group);
      return { group, place, light, puffs };
    });
    this.stops.set(id, groups);
  }
  update(v, time, reduced, night) {
    for (const stops of this.stops.values())
      for (const stop of stops) {
        stop.group.visible =
          Math.hypot(v.x - stop.place.x, v.z - stop.place.z) < 100;
        if (!stop.group.visible) continue;
        if (stop.light) stop.light.intensity = 6 + night * 8;
        stop.puffs.forEach((puff, i) => {
          const phase =
            ((reduced ? 0.35 : time * 0.24) + i / stop.puffs.length) % 1;
          puff.position.set(
            -0.8 + Math.sin(phase * 5 + i) * 0.09,
            1.92 + phase * 0.5,
            4.25,
          );
          puff.scale.setScalar(0.24 + Math.sin(phase * Math.PI) * 0.34);
        });
      }
  }
  remove(id) {
    this.stops.delete(id);
  }
  dispose() {
    this.stops.clear();
    this.texture.dispose();
    this.steam.dispose();
    this.bulb.dispose();
    this.sphere.dispose();
  }
}
