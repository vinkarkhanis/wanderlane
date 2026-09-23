import * as THREE from "three";

export const CAMERA_MODES = ["Chase", "Bumper", "Wide chase", "Cockpit"];
export const CAR_ANCHORS = {
  chase: [0, 3.4, -8.2],
  hood: [0, 1.13, 2.4],
  wide: [0, 5.7, -13],
  cockpit: [-0.34, 1.25, -0.36],
};

export function roundedBox(w, h, d, r = 0.04) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const g = new THREE.BoxGeometry(w, h, d, 5, 5, 5),
    p = g.attributes.position,
    n = g.attributes.normal;
  const v = new THREE.Vector3(),
    core = new THREE.Vector3(),
    normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    core.set(
      Math.max(-w / 2 + r, Math.min(w / 2 - r, v.x)),
      Math.max(-h / 2 + r, Math.min(h / 2 - r, v.y)),
      Math.max(-d / 2 + r, Math.min(d / 2 - r, v.z)),
    );
    normal.copy(v).sub(core).normalize();
    v.copy(core).addScaledVector(normal, r);
    p.setXYZ(i, v.x, v.y, v.z);
    n.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return g;
}

// Closed smooth cross sections, with scalloped lower surfaces at the wheel wells.
export function coachwork() {
  const sections = [
    [-2.29, 0.84, 0.38, 0.94],
    [-2.1, 0.91, 0.35, 0.98],
    [-1.4, 0.98, 0.32, 1.03],
    [-0.4, 0.89, 0.31, 0.94],
    [0.6, 0.91, 0.32, 0.94],
    [1.34, 0.97, 0.34, 0.99],
    [2.02, 0.85, 0.44, 0.87],
    [2.29, 0.72, 0.5, 0.77],
  ];
  const curves = [1, 2, 3].map(
    (key) =>
      new THREE.CatmullRomCurve3(
        sections.map((s) => new THREE.Vector3(s[0], s[key], 0)),
        false,
        "catmullrom",
        0.25,
      ),
  );
  const pos = [],
    indices = [],
    rings = 150,
    sides = 32;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings,
      v = curves.map((c) => c.getPoint(t)),
      z = v[0].x,
      w = v[0].y,
      top = v[2].y;
    let bottom = v[1].y;
    for (const wz of [-1.4, 1.34]) {
      const dz = z - wz;
      if (Math.abs(dz) < 0.435)
        bottom = Math.max(bottom, 0.36 + Math.sqrt(0.435 ** 2 - dz ** 2));
    }
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        s = Math.sin(a),
        c = Math.cos(a);
      const x = w * Math.sign(s) * Math.pow(Math.abs(s), 0.48),
        y =
          (top + bottom) / 2 +
          ((top - bottom) / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.52);
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i,
        b = j * sides + ((i + 1) % sides);
      const z = (pos[a * 3 + 2] + pos[(a + sides) * 3 + 2]) * 0.5,
        x = (pos[a * 3] + pos[b * 3]) * 0.5,
        y = (pos[a * 3 + 1] + pos[b * 3 + 1]) * 0.5;
      if (z > -0.98 && z < 0.87 && Math.abs(x) < 0.76 && y > 0.88) continue;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  for (const row of [0, rings]) {
    const centre = pos.length / 3,
      offset = row * sides;
    pos.push(
      0,
      (pos[offset * 3 + 1] + pos[(offset + 16) * 3 + 1]) / 2,
      pos[offset * 3 + 2],
    );
    for (let i = 0; i < sides; i++)
      row === 0
        ? indices.push(centre, offset + i, offset + ((i + 1) % sides))
        : indices.push(centre, offset + ((i + 1) % sides), offset + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function panel(points) {
  const p = points.flat(),
    g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}
export function tubing(points, radius = 0.012) {
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    Math.max(10, points.length * 6),
    radius,
    6,
    false,
  );
}

export function reflectionTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const x = c.getContext("2d"),
    g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#7196b4");
  g.addColorStop(0.36, "#c9dce5");
  g.addColorStop(0.5, "#edf0dc");
  g.addColorStop(0.55, "#819277");
  g.addColorStop(1, "#273b37");
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 512);
  // Original soft sky/cloud highlights, baked once for coherent glossy panels.
  for (const [px, py, rx, ry] of [
    [130, 150, 180, 18],
    [480, 115, 120, 26],
    [790, 200, 180, 15],
  ]) {
    const cloud = x.createRadialGradient(px, py, 0, px, py, rx);
    cloud.addColorStop(0, "rgba(255,255,247,.95)");
    cloud.addColorStop(1, "rgba(255,255,247,0)");
    x.save();
    x.translate(px, py);
    x.scale(1, ry / rx);
    x.translate(-px, -py);
    x.fillStyle = cloud;
    x.fillRect(px - rx, py - rx, rx * 2, rx * 2);
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Keep the richer coachwork affordable: one static body draw per material.
// Glass remains separate for sorting and cockpit windshield visibility.
export function batchBodyMeshes(root, owned) {
  const groups = new Map();
  for (const mesh of [...root.children]) {
    if (!mesh.isMesh || mesh.material.transparent) continue;
    if (!groups.has(mesh.material)) groups.set(mesh.material, []);
    groups.get(mesh.material).push(mesh);
  }
  for (const [material, meshes] of groups) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((mesh) => {
      mesh.updateMatrix();
      const g = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      g.applyMatrix4(mesh.matrix);
      return g;
    });
    const count = parts.reduce((n, g) => n + g.attributes.position.count, 0),
      geometry = new THREE.BufferGeometry();
    for (const [key, size] of [
      ["position", 3],
      ["normal", 3],
      ["uv", 2],
    ]) {
      const data = new Float32Array(count * size);
      let offset = 0;
      for (const g of parts) {
        if (g.attributes[key]) data.set(g.attributes[key].array, offset);
        offset += g.attributes.position.count * size;
      }
      geometry.setAttribute(key, new THREE.BufferAttribute(data, size));
    }
    geometry.computeBoundingSphere();
    owned.add(geometry);
    const merged = new THREE.Mesh(geometry, material);
    merged.castShadow = meshes.some((m) => m.castShadow);
    merged.receiveShadow = true;
    for (const mesh of meshes) mesh.removeFromParent();
    for (const part of parts) part.dispose();
    root.add(merged);
  }
  const used = new Set();
  root.parent.traverse((o) => {
    if (o.geometry) used.add(o.geometry);
  });
  for (const g of owned)
    if (!used.has(g)) {
      g.dispose();
      owned.delete(g);
    }
}
