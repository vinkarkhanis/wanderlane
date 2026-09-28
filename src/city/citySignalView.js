import * as THREE from "three";
import { signalPlan, signalPhase } from "./citySignals.js";
import { nearest, inside } from "./spatial.js";

export class CitySignalView {
  constructor(path) {
    this.path = path;
    this.plan = signalPlan(path);
    this.heads = new Set();
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.lens = new THREE.SphereGeometry(0.16, 8, 6);
    this.dark = new THREE.MeshStandardMaterial({
      color: 0x182b2c,
      roughness: 0.8,
    });
    this.off = new THREE.MeshStandardMaterial({ color: 0x293331 });
    this.line = new THREE.MeshStandardMaterial({
      color: 0xe1ddbb,
      roughness: 0.9,
    });
    this.lamps = [0xff3020, 0xffb52a, 0x40ff95].map(
      (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    );
  }
  addChunk(data, group, height) {
    const heads = [];
    for (const light of this.plan) {
      let p;
      for (const back of [0, 4, 8, 12]) {
        const c = this.path.sampleAtDistance(light.s - back, {});
        for (const side of [-1, 1]) {
          const x = c.x + c.nx * (c.width / 2 + 1.6) * side,
            z = c.z + c.nz * (c.width / 2 + 1.6) * side;
          if (
            x < data.x + 1 ||
            x > data.x + data.size - 1 ||
            z < data.z + 1 ||
            z > data.z + data.size - 1
          )
            continue;
          if (
            data.buildings.some(
              (b) =>
                x > b.bounds[0] - 0.6 &&
                x < b.bounds[2] + 0.6 &&
                z > b.bounds[1] - 0.6 &&
                z < b.bounds[3] + 0.6,
            )
          )
            continue;
          if (
            data.land.some((l) => l.kind === "water" && inside([x, z], l.outer))
          )
            continue;
          if (
            [...this.path.grid.query(x, z, 12)].some(
              (r) => nearest([x, z], r.p, r.q).d < r.width / 2 + 0.5,
            )
          )
            continue;
          p = { ...c, x, z };
          break;
        }
        if (p) break;
      }
      if (!p) continue;
      const stop = this.path.getLanePosition(light.s, -1.6, {}),
        line = new THREE.Mesh(this.box, this.line);
      line.scale.set(Math.min(2.8, stop.width / 2), 0.018, 0.23);
      line.position.set(stop.x, stop.y + 0.015, stop.z);
      line.rotation.set(-stop.pitch, stop.heading, 0);
      group.add(line);
      const root = new THREE.Group();
      root.position.set(p.x, height(p.x, p.z), p.z);
      root.rotation.y = p.heading;
      const box = (w, h, d, y) => {
        const m = new THREE.Mesh(this.box, this.dark);
        m.scale.set(w, h, d);
        m.position.y = y;
        root.add(m);
      };
      box(0.12, 3.8, 0.12, 1.9);
      box(0.52, 1.32, 0.32, 3.8);
      const bulbs = this.lamps.map((m, i) => {
        const b = new THREE.Mesh(this.lens, m);
        b.position.set(0, 4.2 - i * 0.4, -0.2);
        root.add(b);
        return b;
      });
      group.add(root);
      const head = { id: light.id, root, bulbs };
      heads.push(head);
      this.heads.add(head);
    }
    return () => {
      for (const h of heads) this.heads.delete(h);
    };
  }
  update(time) {
    for (const h of this.heads) {
      const active = ["red", "amber", "green"].indexOf(signalPhase(h.id, time));
      h.bulbs.forEach(
        (b, i) => (b.material = i === active ? this.lamps[i] : this.off),
      );
    }
  }
  dispose() {
    this.heads.clear();
    this.box.dispose();
    this.lens.dispose();
    this.dark.dispose();
    this.off.dispose();
    this.line.dispose();
    this.lamps.forEach((m) => m.dispose());
  }
}
