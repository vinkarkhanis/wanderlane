import * as THREE from "three";
export function renderEdge(p, y, block, res, add) {
  const co = Math.cos(p.yaw),
    si = Math.sin(p.yaw);
  const b = (x, h, z, w, t, d, m = res.trim) =>
    block(
      p.x + x * co + z * si,
      y + h,
      p.z - x * si + z * co,
      w,
      t,
      d,
      p.yaw,
      m,
    );
  const round = (x, h, z, w, t, d, m) => {
    const g = new THREE.SphereGeometry(1, 12, 8);
    g.scale(w, t, d);
    g.rotateY(p.yaw);
    g.translate(p.x + x * co + z * si, y + h, p.z - x * si + z * co);
    add(g, m);
  };
  const wheel = (x, h, z, r) => {
    const g = new THREE.CylinderGeometry(r, r, 0.16, 12);
    g.rotateZ(Math.PI / 2);
    g.rotateY(p.yaw);
    g.translate(p.x + x * co + z * si, y + h, p.z - x * si + z * co);
    add(g, res.rubber);
  };
  if (p.kind === "footpath" || p.kind === "drain") {
    b(0, 0.1, 0, 1.4, 0.2, 3.6, res.roof);
    for (let z = -1.5; z < 1.8; z += 0.6)
      b(0, 0.21, z, p.kind === "drain" ? 1.2 : 1.4, 0.035, 0.07);
    b(-0.7, 0.2, 0, 0.12, 0.35, 3.6, res.shoulder);
  } else if (p.kind === "wall" || p.kind === "gate") {
    b(0, 0.65, 0, 0.22, 1.3, 3.6, res.roof);
    for (const z of [-1.7, 1.7]) b(0, 0.9, z, 0.38, 1.8, 0.38, res.shoulder);
    if (p.kind === "gate")
      for (let z = -1.4; z < 1.5; z += 0.25) b(-0.15, 1.2, z, 0.1, 1.2, 0.06);
  } else if (p.kind === "scooter") {
    for (const x of [-0.55, 0.55]) {
      for (const z of [-0.65, 0.65]) wheel(x, 0.27, z, 0.27);
      round(x, 0.59, 0, 0.23, 0.21, 0.7, res.solar);
      b(x, 0.83, -0.25, 0.5, 0.12, 0.6, res.rubber);
      b(x, 0.9, 0.5, 0.44, 0.65, 0.15, res.solar);
      b(x, 1.24, 0.5, 0.65, 0.06, 0.09, res.rubber);
      round(x, 1.09, 0.61, 0.12, 0.12, 0.04, res.fixture);
    }
  } else if (p.kind === "rickshaw") {
    wheel(-0.58, 0.3, -0.8, 0.3);
    wheel(0.58, 0.3, -0.8, 0.3);
    wheel(0, 0.3, 0.94, 0.3);
    b(0, 0.65, -0.2, 1.25, 0.5, 1.95, res.rubber);
    b(0, 1.08, 0.67, 1, 0.6, 0.14, res.solar);
    round(0, 1.84, -0.15, 0.7, 0.18, 1.12, res.rubber);
    b(0, 1.02, -0.4, 1.12, 0.12, 0.6, res.rubber);
    for (const x of [-0.59, 0.59])
      b(x, 1.32, -0.85, 0.07, 1, 0.07, res.autoPaint);
    round(0, 0.83, 0.97, 0.47, 0.33, 0.35, res.autoPaint);
    round(0, 1.02, 1.27, 0.12, 0.11, 0.03, res.fixture);
  } else if (p.kind === "car") {
    b(0, 0.65, 0, 1.65, 0.65, 3.4, res.solar);
    b(0, 1.17, -0.1, 1.45, 0.55, 1.8, res.trim);
    b(0, 1.49, -0.1, 1.5, 0.08, 1.8, res.solar);
    for (const x of [-0.8, 0.8])
      for (const z of [-1, 1]) wheel(x, 0.32, z, 0.32);
    b(0, 0.7, 1.72, 1.3, 0.14, 0.05, res.fixture);
  } else if (p.kind === "cart") {
    b(0, 0.9, 0, 1.8, 0.8, 1, res.shoulder);
    b(0, 2.1, 0, 2.2, 0.12, 1.5, res.solar);
    for (const x of [-0.8, 0.8]) {
      b(x, 1.6, 0, 0.06, 1.1, 0.06);
      b(x, 0.36, 0, 0.14, 0.6, 0.6);
    }
  } else {
    b(0, 3.2, 0, 0.18, 6.4, 0.18);
    b(0, 5.9, 0, 1.6, 0.1, 0.1);
    b(0.65, 0.65, 0, 0.65, 1.3, 0.5, res.roof);
    for (const x of [-0.55, 0, 0.55])
      b(x, 6.1, 0, 0.14, 0.2, 0.14, res.shoulder);
  }
}
