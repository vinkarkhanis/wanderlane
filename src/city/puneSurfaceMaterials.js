import * as THREE from "three";
import { random } from "../random.js";
// Original deterministic surface maps. Colour and height are separate: the
// shallow bump contributes under sunlight without painting black noise on top.
export function benchmarkMaterials() {
  const textures = [];
  const make = (kind, base) => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d"),
      rng = random(7621 + kind);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 24000; i++) {
      const v = rng() > 0.5 ? 255 : 28;
      ctx.fillStyle = `rgba(${v},${v},${v},${0.015 + rng() * 0.06})`;
      const size = 0.5 + rng() * 2;
      ctx.fillRect(rng() * 512, rng() * 512, size, size);
    }
    if (kind === 0) {
      ctx.strokeStyle = "rgba(45,42,36,.22)";
      ctx.lineWidth = 2;
      for (let y = 0; y <= 512; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
        for (let x = y % 256 ? 64 : 0; x <= 512; x += 128) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 128);
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < 16; i++) {
      const x = rng() * 512,
        y = rng() * 512,
        g = ctx.createRadialGradient(x, y, 0, x, y, 20 + rng() * 55);
      g.addColorStop(0, "rgba(73,59,42,.045)");
      g.addColorStop(1, "rgba(73,59,42,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textures.push(t);
    const bump = t.clone();
    bump.colorSpace = THREE.NoColorSpace;
    bump.needsUpdate = true;
    textures.push(bump);
    return new THREE.MeshStandardMaterial({
      map: t,
      bumpMap: bump,
      bumpScale: kind === 0 ? 0.018 : 0.012,
      roughness: 0.94,
    });
  };
  return {
    materials: {
      pavement: make(0, "#a8a59a"),
      concrete: make(1, "#b0a899"),
      forecourt: make(2, "#8e8b7e"),
      drain: new THREE.MeshStandardMaterial({
        color: 0x454846,
        roughness: 0.95,
      }),
    },
    textures,
  };
}
