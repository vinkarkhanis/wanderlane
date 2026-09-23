import * as THREE from "three";
import { random } from "./random.js";

// Original, locally generated botanical geometry and leaf artwork. All templates
// are shared across chunks; no per-tree materials or downloaded assets.
function merge(parts) {
  const positions = [],
    normals = [],
    uvs = [],
    colors = [];
  for (const source of parts) {
    const g = source.index ? source.toNonIndexed() : source;
    positions.push(...g.attributes.position.array);
    normals.push(...g.attributes.normal.array);
    uvs.push(
      ...(g.attributes.uv?.array ||
        new Float32Array(g.attributes.position.count * 2)),
    );
    colors.push(
      ...(g.attributes.color?.array ||
        new Float32Array(g.attributes.position.count * 3).fill(1)),
    );
    if (g !== source) g.dispose();
    source.dispose();
  }
  const g = new THREE.BufferGeometry();
  for (const [name, data, size] of [
    ["position", positions, 3],
    ["normal", normals, 3],
    ["uv", uvs, 2],
    ["color", colors, 3],
  ])
    g.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
  g.computeBoundingSphere();
  return g;
}

function limb(a, b, radius, color) {
  const direction = new THREE.Vector3().subVectors(b, a),
    g = new THREE.CylinderGeometry(
      radius * 0.48,
      radius,
      direction.length(),
      7,
      1,
      true, // Branch joints and buried roots do not need hidden end caps.
    );
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    ),
  );
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  const colors = [];
  for (let i = 0; i < g.attributes.position.count; i++) {
    const k = 0.8 + 0.2 * Math.sin(i * 2.3) ** 2;
    colors.push(color.r * k, color.g * k, color.b * k);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

function leafTexture(pine = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d"),
    r = random(pine ? 729 : 391);
  ctx.clearRect(0, 0, 256, 256);
  if (pine) {
    // Dense serrated boughs retain their silhouette through texture mipmaps.
    // Individual needles alone average to transparent pixels in distant trees.
    ctx.fillStyle = "#b7c6ab";
    ctx.beginPath();
    ctx.moveTo(128, 12);
    for (let j = 0; j < 9; j++) {
      const y = 30 + j * 23,
        reach = 34 + Math.sin((j / 9) * Math.PI) * 74;
      ctx.lineTo(128 + reach, y + 17);
      ctx.lineTo(147, y + 15);
    }
    ctx.lineTo(128, 245);
    for (let j = 8; j >= 0; j--) {
      const y = 30 + j * 23,
        reach = 34 + Math.sin((j / 9) * Math.PI) * 74;
      ctx.lineTo(109, y + 15);
      ctx.lineTo(128 - reach, y + 17);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e4e9df";
    ctx.lineWidth = 6;
    for (let j = 1; j < 8; j++) {
      ctx.beginPath();
      ctx.moveTo(52, 30 + j * 23);
      ctx.lineTo(125, 43 + j * 23);
      ctx.lineTo(199, 30 + j * 23);
      ctx.stroke();
    }
  }
  // Fine twigs tie separated leaves into airy sprays rather than opaque blobs.
  ctx.strokeStyle = "#707249";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 225);
  ctx.bezierCurveTo(116, 160, 149, 95, 128, 32);
  ctx.stroke();
  for (let i = 0; i < (pine ? 130 : 54); i++) {
    const angle = r() * Math.PI * 2,
      rad = Math.sqrt(r()),
      x = 128 + Math.cos(angle) * rad * 99,
      y = 128 + Math.sin(angle) * rad * 99;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + r());
    const shade = 135 + Math.floor(r() * 95);
    ctx.fillStyle = `rgb(${shade},${Math.min(255, shade + 15)},${Math.floor(shade * 0.67)})`;
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      pine ? 3 : 5 + r() * 4,
      pine ? 13 : 9 + r() * 6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (!pine) {
      ctx.strokeStyle = "#819164";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 8);
      ctx.stroke();
    }
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function canopyCard(center, width, height, yaw, tilt, shade) {
  const g = new THREE.PlaneGeometry(width, height);
  g.rotateX(tilt);
  g.rotateY(yaw);
  g.translate(center.x, center.y, center.z);
  const colors = [];
  for (let i = 0; i < 4; i++) colors.push(shade, shade, shade);
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

function barkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext("2d"),
    r = random(609);
  ctx.fillStyle = "#dededb";
  ctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 210; i++) {
    const x = r() * 128,
      y = r() * 512,
      length = 18 + r() * 160;
    ctx.strokeStyle = `rgba(45,44,38,${0.06 + r() * 0.25})`;
    ctx.lineWidth = 0.4 + r() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + 3,
      y + length * 0.3,
      x - 2,
      y + length * 0.65,
      x + 1,
      y + length,
    );
    ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(50,48,42,${0.12 + r() * 0.28})`;
    ctx.fillRect(r() * 128, r() * 512, 2 + r() * 13, 0.5 + r() * 1.6);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function treeTemplate(kind, seed) {
  const r = random(seed),
    wood = [],
    leaves = [],
    birch = kind === "birch",
    pine = kind === "pine",
    height = birch ? 10 : pine ? 11 : 7.8,
    spread = birch ? 2.2 : pine ? 3.4 : 4.2;
  const bark = new THREE.Color(birch ? 0xc5c3ad : 0x6b5a43),
    base = new THREE.Vector3(),
    top = new THREE.Vector3(0.24, height * 0.91, 0.18);
  wood.push(limb(base, top, birch ? 0.14 : pine ? 0.22 : 0.32, bark));
  const forks = pine ? 15 : birch ? 11 : 12;
  for (let i = 0; i < forks; i++) {
    const a = i * 2.399 + r() * 0.6,
      y = pine ? 1.5 + i * 0.5 : height * (0.29 + r() * 0.47),
      reach = spread * (pine ? 1 - y / height : 0.55 + r() * 0.45),
      root = new THREE.Vector3((top.x * y) / height, y, (top.z * y) / height),
      tip = new THREE.Vector3(
        Math.cos(a) * reach,
        y + (pine ? 0.25 : 1.1 + r() * 1.4),
        Math.sin(a) * reach,
      );
    const bend = root.clone().lerp(tip, 0.52);
    bend.y -= pine ? 0.16 : 0.24;
    bend.x += Math.sin(a + 1.2) * 0.18;
    const radius = pine ? 0.055 : birch ? 0.045 : 0.09;
    wood.push(
      limb(root, bend, radius, bark),
      limb(bend, tip, radius * 0.6, bark),
    );
    for (let twig = 0; twig < 3; twig++) {
      const end = tip
        .clone()
        .add(
          new THREE.Vector3(
            (r() - 0.5) * 1.4,
            0.35 + r() * 0.6,
            (r() - 0.5) * 1.4,
          ),
        );
      wood.push(limb(tip, end, 0.025, bark));
      const count = pine ? 5 : 7;
      for (let j = 0; j < count; j++) {
        const center = end
          .clone()
          .add(
            new THREE.Vector3(
              (r() - 0.5) * (pine ? 1.4 : 1.8),
              (r() - 0.5) * (birch ? 1.9 : 1.1),
              (r() - 0.5) * 1.8,
            ),
          );
        leaves.push(
          canopyCard(
            center,
            pine ? 1.8 : 1.45 + r() * 0.65,
            pine ? 0.85 : 1.3 + r() * 0.6,
            r() * Math.PI * 2,
            (r() - 0.5) * 2,
            0.78 + r() * 0.3,
          ),
        );
      }
    }
  }
  // A light crown at the leader avoids a cut-off conifer/birch silhouette.
  for (let j = 0; j < 20; j++) {
    const c = new THREE.Vector3(
      (r() - 0.5) * 1.8,
      height - 0.8 + r() * 1.0,
      (r() - 0.5) * 1.8,
    );
    leaves.push(
      canopyCard(c, 1.4, 1.5, r() * 6.28, (r() - 0.5) * 2, 0.9 + r() * 0.18),
    );
  }
  return { wood: merge(wood), leaves: merge(leaves) };
}

function grassGeometry() {
  const r = random(1893),
    pos = [],
    uv = [],
    colors = [],
    idx = [];
  for (let blade = 0; blade < 12; blade++) {
    const x = (r() - 0.5) * 1.4,
      z = (r() - 0.5) * 1.4,
      h = 0.24 + r() * 0.48,
      w = 0.012 + r() * 0.017,
      a = r() * 6.28,
      bend = 0.09 + r() * 0.24,
      base = pos.length / 3;
    for (let j = 0; j < 4; j++) {
      const t = j / 3,
        tipWidth = w * (1 - t) + 0.001;
      for (const side of [-1, 1]) {
        pos.push(
          x + Math.cos(a) * tipWidth * side + Math.sin(a) * bend * t * t,
          h * t,
          z + Math.sin(a) * tipWidth * side + Math.cos(a) * bend * t * t,
        );
        uv.push(side > 0 ? 1 : 0, t);
        const c = new THREE.Color().setRGB(
          0.36 + 0.38 * t,
          0.44 + 0.36 * t,
          0.22 + 0.24 * t,
        );
        colors.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < 3; j++) {
      const n = base + j * 2;
      idx.push(n, n + 1, n + 2);
      if (j < 2) idx.push(n + 1, n + 3, n + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function vegetationResources(biome, wind) {
  const r = {},
    pine = biome === "snow";
  r.leafTexture = leafTexture(pine);
  r.barkTexture = barkTexture();
  const leafColor = biome === "canyon" ? 0xa2a079 : pine ? 0x8baba0 : 0xa9bc7c;
  r.leaf = new THREE.MeshStandardMaterial({
    map: r.leafTexture,
    color: leafColor,
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaTest: 0.42,
    roughness: 0.85,
    alphaToCoverage: true,
  });
  r.bark = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: r.barkTexture,
    bumpMap: r.barkTexture,
    bumpScale: 0.035,
    vertexColors: true,
    roughness: 1,
  });
  r.grass = new THREE.MeshStandardMaterial({
    color:
      biome === "desert"
        ? 0xc7b886
        : biome === "snow"
          ? 0xa0aaa0
          : biome === "canyon"
            ? 0xada575
            : 0xb2c486,
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  r.grassBlades = grassGeometry();
  for (const [key, kind, seed] of [
    ["oak", "oak", 114],
    ["birch", "birch", 352],
    ["field", "oak", 741],
  ]) {
    const t = treeTemplate(pine ? "pine" : kind, seed);
    r[key + "Wood"] = t.wood;
    r[key + "Leaves"] = t.leaves;
  }
  r.leafDepth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: r.leafTexture,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  });
  const animate = (material, grass) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.windTime = wind;
      shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n float sway=sin(windTime*${grass ? "1.5" : "0.8"}+instanceMatrix[3].x*.11+instanceMatrix[3].z*.08);transformed.x+=sway*${grass ? ".12*pow(max(position.y,0.),2.)" : ".018*max(position.y-2.,0.)"};`,
      );
      if (grass)
        shader.vertexShader = shader.vertexShader.replace(
          "#include <project_vertex>",
          "vec3 tuftWorld=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;\n transformed.y*=1.-smoothstep(95.,165.,distance(cameraPosition.xz,tuftWorld.xz));\n#include <project_vertex>",
        );
    };
  };
  animate(r.leaf, false);
  animate(r.leafDepth, false);
  animate(r.grass, true);
  return r;
}

export function addGroundDetail(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec2 groundXZ;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n groundXZ=position.xz;",
    );
    shader.fragmentShader =
      "varying vec2 groundXZ;\nfloat groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1,0)),f.x),mix(groundHash(i+vec2(0,1)),groundHash(i+vec2(1,1)),f.x),f.y);}\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n float groundPatch=groundNoise(groundXZ*.065);float grain=groundNoise(groundXZ*3.5);diffuseColor.rgb*=.82+.23*groundPatch+.11*grain;",
    );
  };
}
