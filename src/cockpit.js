import * as THREE from "three";
import {
  roundedBox,
  tubing,
  batchBodyMeshes,
  CAR_ANCHORS,
} from "./carGeometry.js";

// Original right-hand-drive cabin; all textures are generated locally.
export class Cockpit {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.group.visible = false;
    this.materials = [];
    this.geometries = new Set();
    this.textures = [];
    const material = (color, roughness = 0.8, metalness = 0) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      this.materials.push(m);
      return m;
    };
    const leather = material(0x263032),
      warm = material(0x706153),
      trim = material(0x9aa7a5, 0.32, 0.65),
      dark = material(0x10191c),
      stitch = material(0x9c9180);
    const grain = document.createElement("canvas");
    grain.width = grain.height = 128;
    const gc = grain.getContext("2d"),
      pixels = gc.createImageData(128, 128);
    let seed = 871;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const n = 105 + (seed >>> 27);
      pixels.data.set([n, n, n, 255], i);
    }
    gc.putImageData(pixels, 0, 0);
    const grainTexture = new THREE.CanvasTexture(grain);
    grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
    grainTexture.repeat.set(9, 9);
    this.textures.push(grainTexture);
    leather.bumpMap = warm.bumpMap = grainTexture;
    leather.bumpScale = warm.bumpScale = 0.0006;
    const add = (g, m, x = 0, y = 0, z = 0, parent = this.group) => {
      this.geometries.add(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const box = (w, h, d, m, x, y, z, parent) =>
      add(roundedBox(w, h, d, 0.035), m, x, y, z, parent);
    const line = (points, m, r = 0.002, parent = this.group) =>
      add(tubing(points, r), m, 0, 0, 0, parent);
    const glow = new THREE.MeshBasicMaterial({
      color: 0x698e89,
      toneMapped: false,
    });
    this.materials.push(glow);
    // Layered padded brow, inset fascia and continuous satin-metal reveal.
    box(1.51, 0.2, 0.5, leather, 0, 0.91, 0.6);
    box(1.48, 0.075, 0.48, leather, 0, 1.015, 0.6);
    box(1.44, 0.095, 0.045, warm, 0, 0.927, 0.327);
    line(
      [
        [-0.72, 0.978, 0.314],
        [-0.38, 0.984, 0.308],
        [0, 0.98, 0.302],
        [0.38, 0.984, 0.308],
        [0.72, 0.978, 0.314],
      ].map((p) => p.map(Number)),
      trim,
      0.003,
    );
    line(
      [
        [-0.71, 0.974, 0.309],
        [0, 0.975, 0.298],
        [0.71, 0.974, 0.309],
      ],
      glow,
      0.0015,
    );
    for (let i = 0; i < 88; i++) {
      const x = -0.7 + i * 0.016;
      line(
        [
          [x, 1.049, 0.414],
          [x + 0.007, 1.049, 0.414],
        ],
        stitch,
        0.0007,
      );
    }
    box(0.25, 0.24, 0.88, leather, 0.04, 0.65, 0.015);
    box(0.2, 0.025, 0.61, warm, 0.04, 0.782, 0.04);
    for (const side of [-1, 1]) {
      box(0.065, 0.32, 1.28, leather, side * 0.79, 0.85, -0.01);
      box(0.038, 0.105, 0.88, warm, side * 0.753, 0.87, -0.08);
      line(
        [
          [side * 0.751, 0.97, -0.5],
          [side * 0.748, 0.975, -0.04],
          [side * 0.749, 0.973, 0.4],
        ],
        trim,
        0.004,
      );
      box(0.026, 0.025, 0.15, trim, side * 0.73, 0.925, 0.1);
      box(0.09, 0.055, 0.47, leather, side * 0.72, 0.77, -0.09);
    }
    for (const x of [-0.665, 0.08, 0.61]) {
      const width = x === 0.08 ? 0.24 : 0.12;
      box(width, 0.043, 0.035, dark, x, 0.934, 0.293);
      for (let i = 0; i < 3; i++)
        box(width - 0.015, 0.003, 0.007, trim, x, 0.921 + i * 0.011, 0.272);
      box(0.012, 0.027, 0.008, leather, x, 0.934, 0.266);
    }
    const driver = CAR_ANCHORS.cockpit[0];
    // Integrated instrument hood: a low curved leather surround, not a tablet.
    box(0.455, 0.154, 0.17, leather, driver, 1.115, 0.485);
    box(0.431, 0.127, 0.012, dark, driver, 1.12, 0.394);
    line(
      [
        [driver - 0.216, 1.071, 0.391],
        [driver - 0.211, 1.179, 0.399],
        [driver, 1.192, 0.405],
        [driver + 0.211, 1.179, 0.399],
        [driver + 0.216, 1.071, 0.391],
      ],
      stitch,
      0.0011,
    );
    const makeScreen = (w, h, x, y, z, width, height) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.push(texture);
      const m = new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
      });
      this.materials.push(m);
      const mesh = add(new THREE.PlaneGeometry(w, h), m, x, y, z);
      mesh.rotation.y = Math.PI;
      return { canvas, texture, ctx: canvas.getContext("2d") };
    };
    const screen = makeScreen(0.408, 0.112, driver, 1.12, 0.386, 1024, 280);
    Object.assign(this, screen);
    // Centre display is a quiet trip identity, without a fictional live map.
    box(0.285, 0.142, 0.035, dark, 0.14, 1.071, 0.36);
    const centre = makeScreen(0.267, 0.124, 0.14, 1.072, 0.339, 640, 300),
      c = centre.ctx;
    c.fillStyle = "#111e22";
    c.fillRect(0, 0, 640, 300);
    c.fillStyle = "#95b6ad";
    c.font = "18px Segoe UI";
    c.fillText("A S T E R   /   G T", 32, 42);
    c.fillStyle = "#eee5d4";
    c.font = "300 37px Segoe UI";
    c.fillText("WANDERLANE", 32, 113);
    c.fillStyle = "#adbaaf";
    c.font = "italic 24px Georgia";
    c.fillText("Take the long way.", 32, 155);
    c.strokeStyle = "#547e78";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(32, 218);
    c.bezierCurveTo(185, 180, 360, 260, 605, 196);
    c.stroke();
    c.fillStyle = "#9aada6";
    c.font = "16px Segoe UI";
    c.fillText("SCENIC DRIVE", 32, 269);
    centre.texture.needsUpdate = true;
    for (const x of [0.045, 0.225]) {
      const knob = add(
        new THREE.CylinderGeometry(0.013, 0.013, 0.014, 24),
        trim,
        x,
        0.868,
        0.294,
      );
      knob.rotation.x = Math.PI / 2;
      const face = add(
        new THREE.CylinderGeometry(0.01, 0.01, 0.016, 24),
        dark,
        x,
        0.868,
        0.291,
      );
      face.rotation.x = Math.PI / 2;
      box(0.0015, 0.005, 0.002, glow, x, 0.873, 0.282);
    }
    // Compact leather wheel with flattened bottom, inset controls and tapered spokes.
    this.wheel = new THREE.Group();
    this.wheel.position.set(driver, 0.922, 0.265);
    this.wheel.rotation.x = -0.12;
    this.group.add(this.wheel);
    const ring = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      ring.push([Math.cos(a) * 0.18, Math.max(-0.149, Math.sin(a) * 0.18), 0]);
    }
    line(ring, leather, 0.019, this.wheel);
    line(
      ring.map((p) => [p[0] * 0.94, p[1] * 0.94, -0.014]),
      stitch,
      0.001,
      this.wheel,
    );
    const spoke = (side) => {
      const shape = new THREE.Shape();
      shape.moveTo(0.025 * side, 0.026);
      shape.lineTo(0.157 * side, 0.036);
      shape.lineTo(0.153 * side, -0.011);
      shape.lineTo(0.035 * side, -0.039);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.018,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.004,
        bevelThickness: 0.003,
      });
      add(geo, trim, 0, 0, -0.01, this.wheel);
      box(0.065, 0.033, 0.014, dark, 0.112 * side, 0.012, -0.022, this.wheel);
      for (let j = 0; j < 2; j++)
        box(
          0.013,
          0.003,
          0.002,
          stitch,
          (0.097 + j * 0.027) * side,
          0.013,
          -0.03,
          this.wheel,
        );
      const grip = box(
        0.032,
        0.069,
        0.033,
        leather,
        0.166 * side,
        0.053,
        -0.004,
        this.wheel,
      );
      grip.rotation.z = -side * 0.2;
    };
    spoke(-1);
    spoke(1);
    box(0.04, 0.098, 0.021, trim, 0, -0.104, 0, this.wheel);
    box(0.022, 0.076, 0.025, dark, 0, -0.104, -0.012, this.wheel);
    box(0.105, 0.079, 0.046, leather, 0, -0.007, -0.024, this.wheel);
    const badge = box(0.015, 0.015, 0.003, trim, 0, -0.003, -0.049, this.wheel);
    badge.rotation.z = Math.PI / 4;
    for (const side of [-1, 1]) {
      box(0.023, 0.074, 0.01, trim, side * 0.122, 0.019, 0.039, this.wheel);
      box(0.065, 0.014, 0.014, dark, driver + side * 0.145, 0.917, 0.36);
    }
    batchBodyMeshes(this.group, this.geometries);
    batchBodyMeshes(this.wheel, this.geometries);
    this.lastSpeed = -1;
    this.lastAuto = null;
    this.lastReverse = null;
    this.update(0, 0, false);
  }
  update(speed, steer, auto) {
    this.wheel.rotation.z = -steer * 2.35;
    const kmh = Math.round(Math.abs(speed) * 3.6),
      reverse = speed < -0.2;
    if (
      kmh === this.lastSpeed &&
      auto === this.lastAuto &&
      reverse === this.lastReverse
    )
      return;
    this.lastSpeed = kmh;
    this.lastAuto = auto;
    this.lastReverse = reverse;
    const c = this.ctx;
    c.fillStyle = "#101d21";
    c.fillRect(0, 0, 1024, 280);
    const dial = (x, value, max, label) => {
      const start = 0.8 * Math.PI,
        end = 2.2 * Math.PI;
      c.lineWidth = 5;
      c.strokeStyle = "#2b4144";
      c.beginPath();
      c.arc(x, 149, 94, start, end);
      c.stroke();
      c.strokeStyle = "#91bdb2";
      c.beginPath();
      c.arc(
        x,
        149,
        94,
        start,
        start + (end - start) * Math.min(1, value / max),
      );
      c.stroke();
      for (let i = 0; i <= 10; i++) {
        const a = start + ((end - start) * i) / 10;
        c.strokeStyle = i % 5 ? "#506869" : "#b3c8bf";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * 80, 149 + Math.sin(a) * 80);
        c.lineTo(
          x + Math.cos(a) * (i % 5 ? 75 : 70),
          149 + Math.sin(a) * (i % 5 ? 75 : 70),
        );
        c.stroke();
      }
      c.fillStyle = "#a5b9b1";
      c.font = "17px Segoe UI";
      c.fillText(label, x, 177);
    };
    c.textAlign = "center";
    dial(170, kmh, 160, "KM/H");
    dial(854, Math.abs(speed), 45, "ROAD PACE");
    c.fillStyle = "#e2e8dc";
    c.font = "300 38px Segoe UI";
    c.fillText(String(kmh), 170, 143);
    c.font = "300 32px Segoe UI";
    c.fillText(auto ? "AUTO" : "MANUAL", 854, 143);
    c.fillStyle = "#c1cfc5";
    c.font = "18px Segoe UI";
    c.fillText("A S T E R   G T", 512, 42);
    c.font = "300 113px Segoe UI";
    c.fillStyle = "#eeeadd";
    c.fillText(String(kmh), 512, 166);
    c.font = "18px Segoe UI";
    c.fillStyle = "#92aaa5";
    c.fillText("km/h", 512, 198);
    c.fillStyle = "#ccb88e";
    c.font = "22px Segoe UI";
    c.fillText(reverse ? "R" : "D", 512, 249);
    c.font = "15px Segoe UI";
    c.fillStyle = "#8aa29c";
    c.fillText("TAKE THE LONG WAY", 170, 263);
    c.fillText(auto ? "LANE ASSIST" : "DRIVER CONTROL", 854, 263);
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}
