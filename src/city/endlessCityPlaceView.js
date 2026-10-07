import * as THREE from "three";

// Shared geometry and instanced facade parts keep streamed landmarks bounded.
export function buildCityPlaces(plan, path, res, heightAt) {
  const group = new THREE.Group(),
    owned = [],
    colliders = [];
  for (const p of plan) {
    const root = new THREE.Group(),
      parts = new Map(),
      trees = [[], []];
    const heights = [-1, 1].flatMap((u) =>
      [-1, 1].map((v) =>
        heightAt(
          p.x + (p.tx * p.width * u) / 2 + (p.nx * p.depth * v) / 2,
          p.z + (p.tz * p.width * u) / 2 + (p.nz * p.depth * v) / 2,
        ),
      ),
    );
    const y =
      p.kind === "lake" ? path.height(p.s) + 0.15 : Math.max(...heights) + 0.15;
    root.position.set(p.x, y, p.z);
    root.rotation.y = p.yaw;
    root.userData.cityPlace = { id: p.id, kind: p.kind, name: p.name, s: p.s };
    group.add(root);
    const box = (x, y, z, w, h, d, material) => {
      if (!parts.has(material)) parts.set(material, []);
      parts.get(material).push([x, y, z, w, h, d, 0]);
    };
    const shape = (geometry, material, x, y, z, sx, sy, sz) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = material !== res.cityWater;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    };
    const sign = (text, x, yy, z, width = 20, height = 2.5) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 128;
      const c = canvas.getContext("2d");
      c.fillStyle = "#183b42";
      c.fillRect(0, 0, 1024, 128);
      c.strokeStyle = "#d8bd80";
      c.lineWidth = 5;
      c.strokeRect(5, 5, 1014, 118);
      c.fillStyle = "#fff2d6";
      c.font = "bold 58px Georgia";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, 512, 64, 960);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.25,
        roughness: 0.7,
      });
      const geometry = new THREE.PlaneGeometry(width, height);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.y = Math.PI;
      mesh.position.set(x, yy, z);
      root.add(mesh);
      owned.push(texture, material, geometry);
    };
    const bench = (x, z) => {
      box(x, 0.6, z, 3.4, 0.18, 0.8, res.timber);
      box(x, 1.1, z + 0.36, 3.4, 0.85, 0.12, res.timber);
      for (const side of [-1, 1])
        box(x + side * 1.25, 0.3, z, 0.12, 0.6, 0.55, res.metal);
    };
    const tree = (x, z, size = 1) => {
      const variant = Math.abs(Math.round(x + z)) % 2;
      const scale = size * (variant ? 0.72 : 0.9);
      trees[variant].push([x, 0, z, scale, scale, scale, x * 0.71 + z * 0.43]);
    };
    const pavilion = (x, z) => {
      box(x, 0.25, z, 10, 0.5, 8, res.cityStone);
      for (const u of [-4, 4])
        for (const v of [-3, 3])
          box(x + u, 2.4, z + v, 0.35, 4.4, 0.35, res.cityStone);
      shape(res.cityCone, res.cityClay, x, 5.2, z, 7.5, 2.8, 6.3);
    };

    if (["mall", "hotel", "temple"].includes(p.kind)) {
      box(0, -1.1, 0, p.width + 12, 2.4, p.depth + 14, res.cityStone);
      colliders.push({ ...p, y, base: Math.min(...heights) });
    }
    if (p.kind === "mall") {
      box(0, 7.5, 0, 64, 15, 32, res.cityCream);
      box(0, 15.25, 0, 67, 0.5, 34, res.cityClay);
      box(0, 4, -16.15, 62, 5.8, 0.22, res.cityGlass);
      box(0, 11.5, -16.15, 62, 5.4, 0.22, res.cityGlass);
      for (let x = -30; x <= 30; x += 5)
        box(x, 7.5, -16.4, 0.55, 15, 0.65, res.cityStone);
      box(0, 7.2, -19, 27, 0.45, 8, res.cityClay);
      for (const x of [-12, 12])
        box(x, 3.4, -21.4, 0.45, 6.8, 0.45, res.cityStone);
      sign(p.name, 0, 9, -16.65, 29, 2.7);
      // Entry steps, planters, a paved shopping forecourt and marked parking.
      for (let k = 0; k < 3; k++)
        box(0, 0.15 * k, -22 - k, 25, 0.3, 1.4, res.cityStone);
      for (const x of [-25, 25]) {
        box(x, 0.7, -21, 5, 1.4, 3, res.cityClay);
        tree(x, -21, 0.9);
      }
      for (const x of [-26, -20, 20, 26])
        box(x, 0.14, -21.5, 0.12, 0.05, 5, res.line);
      bench(-17, -21);
      bench(17, -21);
    } else if (p.kind === "hotel") {
      box(0, p.height / 2, 0, p.width, p.height, p.depth, res.cityCream);
      box(0, p.height + 0.2, 0, p.width + 2, 0.4, p.depth + 2, res.cityClay);
      for (let floor = 1; floor < p.height / 3; floor++) {
        for (let x = -p.width / 2 + 3; x < p.width / 2; x += 4) {
          box(
            x,
            floor * 3 + 1.1,
            -p.depth / 2 - 0.1,
            2.8,
            1.9,
            0.15,
            res.cityGlass,
          );
          box(
            x,
            floor * 3 + 0.05,
            -p.depth / 2 - 0.5,
            3.3,
            0.18,
            1.1,
            res.cityStone,
          );
        }
        for (const side of [-1, 1])
          for (let z = -p.depth / 2 + 3; z < p.depth / 2; z += 4)
            box(
              side * (p.width / 2 + 0.1),
              floor * 3 + 1.1,
              z,
              0.15,
              1.9,
              2.8,
              res.cityGlass,
            );
      }
      box(0, 2.5, -p.depth / 2 - 0.15, 14, 4.9, 0.2, res.cityGlass);
      box(0, 5.2, -p.depth / 2 - 3, 22, 0.5, 8, res.cityClay);
      for (const x of [-9, 9])
        box(x, 2.6, -p.depth / 2 - 6.5, 0.3, 5.2, 0.3, res.cityStone);
      sign(p.name, 0, 7.2, -p.depth / 2 - 0.4, p.width - 4, 2.8);
      for (const x of [-p.width / 2 - 3, p.width / 2 + 3])
        tree(x, -p.depth / 2 - 3, 1.1);
      box(0, p.height + 0.5, 0, 15, 0.3, 9, res.cityStone);
      box(0, p.height + 0.7, 0, 12, 0.16, 6, res.cityWater);
    } else if (p.kind === "temple") {
      for (let k = 0; k < 4; k++)
        box(0, k * 0.25, 0, 25 - k * 2, 0.5, 26 - k * 2, res.cityStone);
      box(0, 4.8, 4, 12, 7.4, 13, res.cityTemple);
      box(0, 8.9, 4, 15, 0.65, 16, res.cityClay);
      for (let k = 0; k < 5; k++) {
        const radius = 6.3 - k * 0.95;
        shape(
          res.cityCone,
          res.cityTemple,
          0,
          10.5 + k * 2,
          4,
          radius,
          4.2,
          radius,
        );
      }
      shape(res.citySphere, res.cityGold, 0, 21.4, 4, 0.7, 1.1, 0.7);
      box(0, 6.9, -7, 20, 0.6, 12, res.cityClay);
      for (const x of [-8, -3, 3, 8])
        for (const z of [-11, -3])
          shape(res.cityCylinder, res.cityTemple, x, 3.5, z, 0.35, 6.5, 0.35);
      box(0, 3.4, -2.7, 3.2, 5.5, 0.1, res.cityGlass);
      sign(p.name, 0, 1.9, -19, 24, 2.2);
      for (const x of [-16, 16]) {
        tree(x, 8, 1);
        bench(x, -7);
      }
      for (const x of [-12, 12]) box(x, 1, -19, 0.18, 2, 0.18, res.cityStone);
      box(0, 10.5, 4, 0.12, 24, 0.12, res.cityGold);
      box(1.5, 22.6, 4, 3, 1.5, 0.07, res.cityClay);
    } else if (p.kind === "lake") {
      const waterY = path.height(p.s) - 1.05 - y;
      shape(res.cityDisc, res.cityBank, 0, waterY - 0.15, 0, 102, 1, 61);
      shape(res.cityDisc, res.cityWater, 0, waterY, 0, 95, 1, 55);
      for (let i = 0; i < 36; i++) {
        const x = Math.sin(i * 7.1) * 75,
          z = Math.cos(i * 2.3) * 38;
        box(x, waterY + 0.025, z, 2.4 + (i % 4), 0.025, 0.13, res.cityRipple);
      }
      // A road-facing promenade with railings, trees, benches and two gazebos.
      box(0, 0.05, -63, 145, 0.22, 5.5, res.cityStone);
      for (let x = -70; x <= 70; x += 7)
        box(x, 0.8, -59.8, 0.14, 1.6, 0.14, res.metal);
      box(0, 1.3, -59.8, 145, 0.1, 0.1, res.metal);
      for (const x of [-48, -24, 24, 48]) {
        bench(x, -63);
        tree(x, -68, 0.85);
      }
      pavilion(-70, -50);
      pavilion(70, -50);
      sign(p.name, 0, 2.8, -66.2, 20, 2.7);
      // Small leisure boats help communicate the lake's scale.
      for (const x of [-32, 26]) {
        box(x, waterY + 0.35, 5, 4.8, 0.65, 1.8, res.cityClay);
        box(x, waterY + 0.65, 5, 3.5, 0.18, 1.25, res.cityCream);
      }
    } else {
      box(0, -0.2, 0, p.width, 0.6, p.depth, res.cityStone);
      pavilion(0, 2);
      for (const x of [-13, 13]) {
        bench(x, -7);
        tree(x, 8, 1.3);
      }
      sign(p.name, 0, 2, -p.depth / 2 - 0.2, 25, 2.7);
      if (p.kind === "hills") {
        for (let x = -17; x <= 17; x += 4)
          box(x, 1.3, p.depth / 2, 0.14, 2.6, 0.14, res.metal);
        box(0, 2.3, p.depth / 2, 36, 0.1, 0.1, res.metal);
      } else
        for (const x of [-24, 24]) for (const z of [-12, 12]) tree(x, z, 1);
    }
    for (const [material, items] of parts)
      res.instances(root, res.box, material, items, true);
    ["oak", "field"].forEach((key, i) => {
      res.instances(root, res[key + "Wood"], res.bark, trees[i], true);
      res.instances(root, res[key + "Leaves"], res.leaf, trees[i], true);
    });
  }
  return { group, owned, colliders, places: plan };
}
