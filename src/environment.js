import * as THREE from "three";
import { damp } from "./config.js";
import { random } from "./random.js";
export const TIMES = ["Dawn", "Day", "Sunset", "Night"];
const PRESETS = [
  {
    top: 0x627f9e,
    horizon: 0xe5bba1,
    sun: 0xffcd9a,
    hemi: 0x9eb8cd,
    power: 1.7,
    ambient: 1.35,
    exposure: 1.05,
    night: 0,
    height: 38,
  },
  {
    top: 0x6e9dbd,
    horizon: 0xd8ded0,
    sun: 0xffedcc,
    hemi: 0xc1d9e0,
    power: 2.6,
    ambient: 1.55,
    exposure: 1.02,
    night: 0,
    height: 150,
  },
  {
    top: 0x64778f,
    horizon: 0xe7af8b,
    sun: 0xffb075,
    hemi: 0x94afc8,
    power: 2.1,
    ambient: 1.25,
    exposure: 1.02,
    night: 0,
    height: 24,
  },
  {
    top: 0x101c32,
    horizon: 0x536575,
    sun: 0xaec7e8,
    hemi: 0x7798ba,
    power: 0.5,
    ambient: 0.8,
    exposure: 1.1,
    night: 1,
    height: 100,
  },
];
export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.mode = 2;
    this.night = 0;
    this.temp = new THREE.Color();
    this.skyU = {
      top: { value: new THREE.Color(PRESETS[2].top) },
      bottom: { value: new THREE.Color(PRESETS[2].horizon) },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1300, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: this.skyU,
        vertexShader:
          "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying vec3 p;uniform vec3 top,bottom;void main(){float h=max(0.,normalize(p).y);gl_FragColor=vec4(mix(bottom,top,pow(h,.55)),1.);\n#include <colorspace_fragment>\n}",
        toneMapped: false,
      }),
    );
    scene.add(this.sky);
    // A locally generated sky reflection map gives metallic paint a readable finish.
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d"),
      gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, "#91b1cb");
    gradient.addColorStop(0.46, "#e4e4d5");
    gradient.addColorStop(0.55, "#b9c0b1");
    gradient.addColorStop(1, "#45584a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.reflections = pmrem.fromEquirectangular(texture);
    scene.environment = this.reflections.texture;
    texture.dispose();
    pmrem.dispose();
    this.sun = new THREE.DirectionalLight(0xffb075, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -42,
      right: 42,
      top: 42,
      bottom: -42,
      near: 1,
      far: 400,
    });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x94afc8, 0x5d6055, 1.25);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xe7af8b, 110, 630);
    this.skyObjects = new THREE.Group();
    scene.add(this.skyObjects);
    const rng = random(123),
      points = [];
    for (let i = 0; i < 700; i++) {
      const a = rng() * 6.28,
        y = 0.12 + rng() * 0.88,
        k = Math.sqrt(1 - y * y);
      points.push(Math.sin(a) * k * 1100, y * 1100, Math.cos(a) * k * 1100);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0xf0e7d4,
        size: 1.8,
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
      }),
    );
    this.skyObjects.add(this.stars);
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(9, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xefe5cb,
        transparent: true,
        opacity: 0,
        fog: false,
      }),
    );
    this.moon.position.set(-360, 430, 780);
    this.skyObjects.add(this.moon);
    this.clouds = new THREE.Group();
    this.skyObjects.add(this.clouds);
    const cg = new THREE.IcosahedronGeometry(1, 2),
      cm = new THREE.MeshStandardMaterial({
        color: 0xdedbcc,
        roughness: 1,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      });
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Mesh(cg, cm);
      cloud.position.set(
        (rng() - 0.5) * 1500,
        170 + rng() * 80,
        (rng() - 0.5) * 1500,
      );
      cloud.scale.set(55 + rng() * 60, 4 + rng() * 7, 18 + rng() * 30);
      this.clouds.add(cloud);
    }
  }
  update(v, dt, biome, time, reduced) {
    const p = PRESETS[this.mode],
      a = 1 - Math.exp(-1.25 * dt);
    this.sky.position.set(v.x, 0, v.z);
    this.skyObjects.position.set(v.x, 0, v.z);
    this.skyU.top.value.lerp(this.temp.setHex(p.top), a);
    this.skyU.bottom.value.lerp(this.temp.setHex(p.horizon), a);
    this.scene.fog.color.copy(this.skyU.bottom.value);
    this.scene.fog.far = damp(
      this.scene.fog.far,
      this.mode === 3 ? 410 : this.mode === 0 ? 500 : 650,
      1.25,
      dt,
    );
    this.sun.color.lerp(this.temp.setHex(p.sun), a);
    this.sun.intensity = damp(this.sun.intensity, p.power, 1.25, dt);
    this.hemi.color.lerp(this.temp.setHex(p.hemi), a);
    this.hemi.intensity = damp(this.hemi.intensity, p.ambient, 1.25, dt);
    this.sun.position.x = v.x - 95;
    this.sun.position.z = v.z + 50;
    this.sun.position.y = damp(this.sun.position.y, v.y + p.height, 1.25, dt);
    this.sun.target.position.set(v.x, v.y, v.z + 12);
    this.night = damp(this.night, p.night, 1.25, dt);
    this.renderer.toneMappingExposure = damp(
      this.renderer.toneMappingExposure,
      p.exposure,
      1.25,
      dt,
    );
    this.stars.material.opacity = this.night * 0.85;
    this.moon.material.opacity = this.night;
    this.clouds.visible = this.night < 0.9;
    if (!reduced) this.clouds.rotation.y = time * 0.002;
  }
}
