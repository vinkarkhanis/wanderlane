import * as THREE from "three";
import { random } from "./random.js";

// One persistent weather pool across worlds; no particles or audio nodes are
// allocated during driving. Wet patches use the existing sky reflection map.
export class Monsoon {
  constructor(scene) {
    this.time = 0;
    this.wet = { value: 0 };
    this.materials = new WeakSet();
    const rng = random(4187);
    this.seeds = Array.from({ length: 4800 }, () => [rng(), rng(), rng()]);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0],
        3,
      ),
    );
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    geometry.setAttribute(
      "rainSeed",
      new THREE.InstancedBufferAttribute(
        new Float32Array(this.seeds.flat()),
        3,
      ),
    );
    geometry.instanceCount = 840;
    this.rain = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: {
          elapsed: { value: 0 },
          center: { value: new THREE.Vector3() },
          viewport: { value: new THREE.Vector2(1, 1) },
          night: { value: 0 },
          strength: { value: 1 },
        },
        vertexShader: `
          attribute vec3 rainSeed;
          uniform float elapsed; uniform vec3 center; uniform vec2 viewport; uniform float strength;
          varying vec2 streakUV; varying float visibility;
          void main() {
            float fallSpeed = 9.0 + rainSeed.y * 7.0;
            // World-space wrapping retains motion as the driver moves through rain.
            // Each drop has its own length, speed, width, opacity and gust phase.
            vec2 wind = vec2(1.3, -0.6);
            vec2 drift = wind * elapsed + vec2(sin(elapsed * .7 + rainSeed.y * 31.0), cos(elapsed * .43 + rainSeed.x * 23.0)) * .32;
            vec3 local = vec3(mod(rainSeed.x * 947.0 + drift.x - center.x + 24.0, 48.0) - 24.0,
              mod(rainSeed.y * 319.0 - elapsed * fallSpeed - center.y, 20.0) + .15,
              mod(rainSeed.z * 839.0 + drift.y - center.z + 24.0, 48.0) - 24.0);
            vec3 point = center + local;
            float exposure = mix(.025, .045, strength) + rainSeed.x * rainSeed.z * .045;
            vec3 tail = point + vec3(-wind.x, fallSpeed, -wind.y) * exposure;
            vec4 start = projectionMatrix * viewMatrix * vec4(point, 1.0);
            vec4 end = projectionMatrix * viewMatrix * vec4(tail, 1.0);
            vec2 direction = (end.xy / max(.01, end.w) - start.xy / max(.01, start.w)) * viewport;
            vec2 side = normalize(vec2(-direction.y, direction.x) + vec2(.0001));
            gl_Position = mix(start, end, position.y);
            // Feathered streaks retain a visible core at desktop and mobile sizes.
            gl_Position.xy += side * position.x * (1.15 + strength * .8 + rainSeed.z * .8) / viewport * gl_Position.w;
            float distanceToEye = distance(point, cameraPosition);
            visibility = smoothstep(.8, 2.5, distanceToEye) * (1.0 - smoothstep(22.0, 36.0, distanceToEye))
              * (.38 + strength * .22 + rainSeed.z * rainSeed.z * .38) * step(.1, min(start.w, end.w));
            streakUV = vec2(position.x, position.y);
          }`,
        fragmentShader: `
          uniform float night; varying vec2 streakUV; varying float visibility;
          void main() {
            float feather = pow(max(0.0, 1.0 - abs(streakUV.x)), 1.5);
            float taper = smoothstep(0.0, .12, streakUV.y) * (1.0 - smoothstep(.4, 1.0, streakUV.y));
            gl_FragColor = vec4(mix(vec3(.79, .86, .89), vec3(.60, .73, .82), night), visibility * feather * taper);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    this.rain.frustumCulled = false;
    scene.add(this.rain);
    const sprayGeometry = new THREE.BufferGeometry();
    sprayGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(96 * 3), 3),
    );
    const mist = document.createElement("canvas");
    mist.width = mist.height = 32;
    const mc = mist.getContext("2d"),
      gradient = mc.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,.65)");
    gradient.addColorStop(0.4, "rgba(255,255,255,.30)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    mc.fillStyle = gradient;
    mc.fillRect(0, 0, 32, 32);
    this.mistTexture = new THREE.CanvasTexture(mist);
    this.spray = new THREE.Points(
      sprayGeometry,
      new THREE.PointsMaterial({
        color: 0xc0d2d4,
        size: 0.38,
        map: this.mistTexture,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.spray.frustumCulled = false;
    scene.add(this.spray);
    const splashGeo = new THREE.PlaneGeometry(0.32, 0.32).rotateX(-Math.PI / 2);
    splashGeo.setAttribute(
      "impactPhase",
      new THREE.InstancedBufferAttribute(
        new Float32Array(this.seeds.slice(0, 64).map((s) => s[1])),
        1,
      ),
    );
    this.splashes = new THREE.InstancedMesh(
      splashGeo,
      new THREE.ShaderMaterial({
        uniforms: { elapsed: { value: 0 } },
        vertexShader: `attribute float impactPhase; uniform float elapsed; varying vec2 splashUV; varying float age;
        void main(){ splashUV=uv; age=fract(elapsed*(1.4+impactPhase)+impactPhase*19.0);
          gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 splashUV; varying float age;
        void main(){ float radius=length(splashUV-.5); float ring=exp(-pow((radius-age*.42)*90.0,2.0));
          gl_FragColor=vec4(.62,.69,.72,ring*(1.0-age)*.22);
          #include <colorspace_fragment>
        }`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
      64,
    );
    this.splashes.frustumCulled = false;
    scene.add(this.splashes);
    this.splashTransform = new THREE.Object3D();
    this.lastSplashPlacement = -1;
    this.canvas = document.createElement("canvas");
    this.canvas.id = "windshieldRain";
    this.canvas.hidden = true;
    this.canvas.width = 512;
    this.canvas.height = 256;
    this.canvas.setAttribute("aria-hidden", "true");
    document.querySelector("#c").after(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.windshieldTexture = new THREE.CanvasTexture(this.canvas);
    this.windshieldTexture.colorSpace = THREE.SRGBColorSpace;
    const windshieldGeometry = new THREE.BufferGeometry();
    windshieldGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(12), 3),
    );
    windshieldGeometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(8), 2),
    );
    windshieldGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.windshield = new THREE.Mesh(
      windshieldGeometry,
      new THREE.MeshBasicMaterial({
        map: this.windshieldTexture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    this.windshield.matrixAutoUpdate = false;
    this.windshield.frustumCulled = false;
    this.windshield.renderOrder = 1;
    scene.add(this.windshield);
    this.drops = Array.from({ length: 240 }, () => ({
      x: 0.08 + rng() * 0.84,
      y: 0.06 + rng() * 0.59,
      size: 0.5 + rng() ** 3 * 2.4,
      phase: rng() * 13,
      cleared: -10,
    }));
    this.lastDraw = -1;
    this.snapshot = {};
  }
  surface(material) {
    if (!material || this.materials.has(material)) return;
    this.materials.add(material);
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms.monsoonWet = this.wet;
      shader.vertexShader =
        "varying vec3 weatherPosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nweatherPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
      shader.fragmentShader =
        `uniform float monsoonWet; varying vec3 weatherPosition;
        float rainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float rainNoise(vec2 p) { vec2 cell=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(rainHash(cell),rainHash(cell+vec2(1,0)),f.x),mix(rainHash(cell+vec2(0,1)),rainHash(cell+vec2(1,1)),f.x),f.y); }
        ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float wetPatch = smoothstep(.32, .78, rainNoise(weatherPosition.xz*.19) * .65 + rainNoise(weatherPosition.xz*.71)*.35);
        roughnessFactor = mix(roughnessFactor, mix(.52, .28, wetPatch), monsoonWet);
        diffuseColor.rgb *= mix(1.0, mix(.88, .76, wetPatch), monsoonWet);`,
      );
    };
    material.customProgramCacheKey = () => "wanderlane-monsoon-v2";
    material.needsUpdate = true;
  }
  update(
    v,
    {
      active,
      intensity,
      camera,
      quality,
      reduced,
      paused,
      cockpit,
      enclosed,
      grounded,
      asphalt,
      world,
      dt,
      car,
      pixelRatio,
      path,
      roadDistance,
      night,
    },
  ) {
    if (!paused) this.time += dt;
    this.wet.value = active ? 1 : 0;
    this.surface(world.res.asphalt);
    const heavy = intensity === "Heavy";
    const count = heavy
      ? quality === "Low" ? 1200 : quality === "High" ? 4800 : 2800
      : quality === "Low" ? 360 : quality === "High" ? 1200 : 720;
    this.rain.visible = active && !reduced;
    this.spray.visible =
      active && !reduced && grounded && asphalt && Math.abs(v.speed) > 2;
    this.windshield.visible =
      active && !reduced && cockpit && enclosed && grounded;
    const t = this.time;
    if (this.rain.visible) {
      this.rain.geometry.instanceCount = count;
      this.rain.material.uniforms.elapsed.value = t;
      this.rain.material.uniforms.center.value.set(camera.position.x, v.y, camera.position.z);
      this.rain.material.uniforms.strength.value = heavy ? 1 : 0;
      this.rain.material.uniforms.viewport.value.set(
        innerWidth * pixelRatio,
        innerHeight * pixelRatio,
      );
      this.rain.material.uniforms.night.value = night;
    }
    this.splashes.visible = active && !reduced && grounded && asphalt;
    this.splashes.count = heavy
      ? quality === "Low" ? 24 : quality === "High" ? 64 : 48
      : quality === "Low" ? 12 : quality === "High" ? 32 : 24;
    this.splashes.material.uniforms.elapsed.value = t;
    if (this.splashes.visible && t - this.lastSplashPlacement > 0.12) {
      for (let i = 0; i < this.splashes.count; i++) {
        const [x, y, z] = this.seeds[i];
        const p = path.sampleAtDistance(roadDistance + (x - 0.5) * 36);
        const side = (z - 0.5) * 5;
        this.splashTransform.position.set(
          p.x + p.nx * side,
          p.y + 0.035,
          p.z + p.nz * side,
        );
        this.splashTransform.scale.setScalar(0.4 + y * 0.6);
        this.splashTransform.updateMatrix();
        this.splashes.setMatrixAt(i, this.splashTransform.matrix);
      }
      this.splashes.instanceMatrix.needsUpdate = true;
      this.lastSplashPlacement = t;
    }
    if (this.spray.visible) {
      this.spray.position.set(v.x, v.y, v.z);
      this.spray.rotation.y = v.heading;
      const a = this.spray.geometry.attributes.position;
      const sprayCount = quality === "Low" ? 24 : quality === "High" ? 96 : 56;
      this.spray.geometry.setDrawRange(0, sprayCount);
      this.spray.material.opacity = Math.min(heavy ? 0.48 : 0.24, Math.abs(v.speed) * (heavy ? 0.022 : 0.01));
      for (let i = 0; i < sprayCount; i++) {
        const [x, y, z] = this.seeds[i];
        const age = (t * 1.8 + z) % 1;
        a.setXYZ(
          i,
          (i % 2 ? 0.8 : -0.8) + (x - 0.5) * age * 1.4,
          0.16 + Math.sin(age * Math.PI) * y * 0.8,
          -Math.sign(v.speed) *
            (1.2 + age * Math.min(6, Math.abs(v.speed) * 0.3)),
        );
      }
      a.needsUpdate = true;
    }
    if (this.windshield.visible) {
      const glass = car.windshield || car.windows?.[0];
      if (glass && this.car !== car) {
        this.car = car;
        const source = glass.geometry.attributes.position;
        const position = this.windshield.geometry.attributes.position;
        const uv = this.windshield.geometry.attributes.uv;
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        for (let i = 0; i < 4; i++) {
          minX = Math.min(minX, source.getX(i));
          maxX = Math.max(maxX, source.getX(i));
          minY = Math.min(minY, source.getY(i));
          maxY = Math.max(maxY, source.getY(i));
        }
        for (let i = 0; i < 4; i++) {
          position.setXYZ(
            i,
            source.getX(i),
            source.getY(i),
            source.getZ(i) - 0.004,
          );
          uv.setXY(
            i,
            (source.getX(i) - minX) / (maxX - minX),
            (source.getY(i) - minY) / (maxY - minY),
          );
        }
        position.needsUpdate = uv.needsUpdate = true;
      }
      car.body.updateWorldMatrix(true, false);
      this.windshield.matrix.copy(car.body.matrixWorld);
    }
    if (
      this.windshield.visible &&
      t - this.lastDraw >= (quality === "Low" ? 1 / 15 : 1 / 24)
    ) {
      this.drawWindshield(t, quality, heavy);
      this.lastDraw = t;
    }
    this.snapshot = {
      active,
      intensity,
      rainCount: this.rain.visible ? count : 0,
      sprayCount: this.spray.visible ? this.spray.geometry.drawRange.count : 0,
      windshield: this.windshield.visible,
      splashCount: this.splashes.visible ? this.splashes.count : 0,
      time: t,
    };
  }
  drawWindshield(t, quality, heavy) {
    const width = this.canvas.width,
      height = this.canvas.height;
    const c = this.ctx,
      w = width,
      h = height;
    c.clearRect(0, 0, w, h);
    const sweep = (1 - Math.cos(t * Math.PI * (heavy ? 2.2 : 1.1))) / 2;
    const angle = -0.12 - sweep * 1.3;
    const pivots = [0.28, 0.7];
    const n = heavy ? quality === "Low" ? 90 : quality === "High" ? 240 : 180 : quality === "Low" ? 40 : quality === "High" ? 120 : 80;
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      const lifetime = 7 + d.phase * 0.4;
      const age = (t + d.phase) % lifetime;
      const cycle = Math.floor((t + d.phase) / lifetime);
      const x = ((d.x + Math.sin(cycle * 17.1 + i * 4.3) * 0.17 + 1) % 1) * w,
        y = (d.y * 1.3 + age * age * 0.0005 * d.size) * h;
      for (const pivot of pivots) {
        const dx = x - pivot * w,
          dy = y - h * 0.95;
        if (
          Math.hypot(dx, dy) < h * 0.9 &&
          Math.abs(Math.atan2(dy, dx) - angle) < 0.15
        )
          d.cleared = t;
      }
      const alpha =
        Math.min(0.65, Math.max(0, (t - d.cleared - 0.35) * 0.3)) *
        Math.min(1, age * 3, (lifetime - age) * 2);
      // Small clear beads with a dark refractive edge and a local glint, not white outlines.
      const bead = c.createRadialGradient(
        x - d.size * 0.25,
        y - d.size * 0.3,
        0,
        x,
        y,
        d.size * 1.3,
      );
      bead.addColorStop(0, `rgba(216,231,236,${alpha * 0.7})`);
      bead.addColorStop(0.42, `rgba(127,158,169,${alpha * 0.12})`);
      bead.addColorStop(0.85, `rgba(36,65,76,${alpha * 0.3})`);
      bead.addColorStop(1, "rgba(36,65,76,0)");
      c.fillStyle = bead;
      c.beginPath();
      c.ellipse(
        x,
        y,
        d.size,
        d.size * 1.25,
        Math.sin(i) * 0.15,
        0,
        Math.PI * 2,
      );
      c.fill();
      if (d.size > 1.6 && age > 2) {
        c.strokeStyle = `rgba(172,199,210,${alpha * 0.13})`;
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(x, y - d.size);
        c.quadraticCurveTo(
          x + 0.8,
          y - 4,
          x - 0.3,
          y - Math.min(13, age * d.size),
        );
        c.stroke();
      }
    }
    // Automatic wipers clear droplets along their actual swept arcs.
    for (const pivot of pivots) {
      const x = pivot * w,
        y = h * 0.95,
        length = h * 0.87;
      c.strokeStyle = "rgba(17,28,30,.85)";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      c.stroke();
    }
    this.windshieldTexture.needsUpdate = true;
  }
}
