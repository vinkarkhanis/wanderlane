import { CityPath } from "./city/cityPath.js";
import { CityWorld, SEASONS } from "./city/cityWorld.js";
import { CityTraffic } from "./city/cityTraffic.js";
import { CityExperience, chaiTrip } from "./city/cityExperience.js";
import {
  DiscoveryJournal,
  discoveryTrip,
  POSTCARD,
} from "./city/puneDiscovery.js";
import { CitySignals } from "./city/citySignals.js";
import { CityTripUI } from "./city/cityTripUI.js";
import * as THREE from "three";
import { RoadPath } from "./roadPath.js";
import { WorldManager } from "./worldManager.js";
import { Vehicle } from "./vehicle.js";
import { VehiclePose } from "./vehiclePose.js";
import { Car } from "./car.js";
import { CAMERA_MODES } from "./carGeometry.js";
import { CameraRig } from "./camera.js";
import { Environment, TIMES } from "./environment.js";
import { Traffic, TRAFFIC } from "./traffic.js";
import { Controls } from "./controls.js";
import { AudioSystem } from "./audio.js";
import { Particles } from "./particles.js";
import { BIOMES, BIOME_KEYS } from "./biomes.js";
import { COLORS, QUALITY } from "./config.js";
import { loadSettings, saveSettings } from "./settings.js";
const el = (id) => document.getElementById(id),
  saved = loadSettings();
const renderer = new THREE.WebGLRenderer({
  canvas: el("c"),
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(),
  rig = new CameraRig(),
  env = new Environment(scene, renderer),
  audio = new AudioSystem(),
  particles = new Particles(scene);
const journal = new DiscoveryJournal();
let endlessLane = 2;
let experience = null,
  signals = null;
let driveMode = "endless",
  season = "Summer",
  cityData = null,
  switching = false;
let seed = String(saved.seed || "aster-2026"),
  path = new RoadPath(seed),
  vehicle = new Vehicle(path),
  world,
  traffic,
  biome = "meadow",
  color = 0,
  auto = false,
  started = false,
  paused = true,
  time = 0,
  quality = QUALITY[saved.quality] ? saved.quality : "Medium",
  reduced =
    !!saved.reduced || matchMedia("(prefers-reduced-motion: reduce)").matches;
const car = new Car(scene, COLORS[0][1]);
const tripUI = new CityTripUI(
  async () => {
    if (!experience || switching) return;
    controls.clear();
    auto = false;
    chooseDiscovery();
    vehicle.reset(experience.definition.start, -1.6);
    signals.reset(vehicle.near.distance);
    signals.time = 0;
    experience.start();
    traffic.setMode(traffic.mode, vehicle);
    env.mode = experience.definition.time ?? 2;
    if (experience.definition.season) {
      season = experience.definition.season;
      world.setSeason(season);
      el("puneSeason").value = season;
    }
    rig.snap = true;
    try {
      await world.ready(vehicle);
    } catch (error) {
      experience?.cancel();
      toast("The trip could not load: " + error.message);
    }
    updateLabels();
  },
  () => {
    experience?.cancel();
  },
);
world = makeWorld();
traffic = new Traffic(scene, path);
world.update(vehicle.near.distance, 0, reduced, true);
car.place(vehicle);
rig.update(vehicle, 1, true);
function makeWorld() {
  const w =
    driveMode === "pune"
      ? new CityWorld(
          scene,
          path,
          cityData.manifest,
          cityData.base,
          season,
          quality,
        )
      : new WorldManager(scene, path, biome, quality);
  if (path.city) {
    path.groundHeight = (x, z) => w.heightAt(x, z);
    path.resolveContacts = (v, dt) => w.constrain(v, dt);
  }
  return w;
}
function updateWorld(immediate = false) {
  if (driveMode === "pune")
    world.update(vehicle, time, reduced, env.night, env.mode === 2);
  else world.update(vehicle.near.distance, time, reduced, immediate);
}
async function switchMode() {
  if (switching) return;
  const wasPaused = paused;
  switching = true;
  paused = true;
  controls.clear();
  if (driveMode === "endless") endlessLane = vehicle.lane;
  const requested = el("driveMode").value,
    old = driveMode;
  el("cityLoading").hidden = false;
  el("cityLoading").textContent =
    "Loading city chunks · route · terrain · traffic…";
  let nextWorld;
  try {
    let nextPath;
    if (requested === "pune") {
      const base = new URL("./assets/cities/pune/", document.baseURI);
      const get = async (file) => {
        const r = await fetch(new URL(file, base));
        if (!r.ok) throw Error(file + " HTTP " + r.status);
        return r.json();
      };
      const manifest = await get("manifest.json"),
        nav = await get(manifest.navigation);
      cityData = { manifest, nav, base };
      nextPath = new CityPath(nav, manifest);
      nextWorld = new CityWorld(
        scene,
        nextPath,
        manifest,
        base,
        season,
        quality,
      );
    } else {
      nextPath = new RoadPath(seed);
      nextWorld = new WorldManager(scene, nextPath, biome, quality);
    }
    const nextVehicle = new Vehicle(nextPath);
    nextVehicle.lane = requested === "pune" ? -1.6 : endlessLane;
    nextVehicle.reset(40, nextVehicle.lane);
    if (requested === "pune") {
      await nextWorld.ready(nextVehicle);
      nextPath.groundHeight = (x, z) => nextWorld.heightAt(x, z);
      nextPath.resolveContacts = (v, dt) => nextWorld.constrain(v, dt);
    }
    const trafficMode = traffic.mode;
    experience?.dispose();
    signals?.dispose();
    world.dispose();
    traffic.dispose();
    path = nextPath;
    vehicle = nextVehicle;
    world = nextWorld;
    driveMode = requested;
    experience = driveMode === "pune" ? new CityExperience(path) : null;
    if (experience) {
      experience.journal = journal;
      chooseDiscovery();
    }
    signals = driveMode === "pune" ? new CitySignals(path) : null;
    if (signals) {
      world.signals = signals;
      world.experience = experience;
    }
    traffic =
      driveMode === "pune"
        ? new CityTraffic(scene, path)
        : new Traffic(scene, path);
    traffic.signals = signals;
    traffic.quality = quality;
    traffic.setMode(trafficMode, vehicle);
    auto = false;
    rig.snap = true;
    updateWorld(true);
    updateLabels();
    persist();
    el("cityLoading").hidden = true;
    toast(
      driveMode === "pune"
        ? "Pune pilot · " +
            cityData.manifest.elevation.label +
            " · drive on the left"
        : "Back to Endless Drive",
    );
  } catch (e) {
    nextWorld?.dispose();
    el("driveMode").value = old;
    el("cityLoading").textContent =
      "Pune could not load: " +
      e.message +
      ". Endless Drive remains available.";
  } finally {
    switching = false;
    paused = wasPaused || el("settings").open;
  }
}
function toast(text) {
  el("toast").textContent = text;
  el("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el("toast").classList.remove("show"), 2600);
}
function persist() {
  saveSettings({
    driveMode,
    seed,
    quality,
    reduced,
    shadows: el("shadows").value,
    master: audio.master,
    engine: audio.engine,
    ambience: audio.ambience,
    muted: audio.muted,
    traffic: traffic?.mode ?? 0,
  });
}
function setQuality() {
  quality = el("quality").value;
  if (path.city) {
    traffic.quality = quality;
    traffic.setMode(traffic.mode, vehicle);
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY[quality].dpr));
  renderer.setSize(innerWidth, innerHeight);
  world.dispose();
  world = makeWorld();
  if (signals && driveMode === "pune") {
    world.signals = signals;
    world.experience = experience;
  }
  updateWorld(true);
  persist();
}
function setShadows() {
  const value = el("shadows").value;
  renderer.shadowMap.enabled = value !== "Off";
  env.sun.castShadow = value !== "Off";
  const size = value === "High" ? 2048 : 1024;
  env.sun.shadow.mapSize.set(size, size);
  if (env.sun.shadow.map) {
    env.sun.shadow.map.dispose();
    env.sun.shadow.map = null;
  }
  persist();
}
function rebuild() {
  world.dispose();
  world = makeWorld();
  if (signals && driveMode === "pune") {
    world.signals = signals;
    world.experience = experience;
  }
  updateWorld(true);
}
function returnToRoad() {
  const nearest = path.findNearestRoadPoint(
    vehicle.x,
    vehicle.z,
    {},
    vehicle.y,
  );
  traffic.clearNear(nearest.distance);
  if (path.city) path.resetNearest(vehicle);
  else vehicle.reset(nearest.distance, vehicle.lane);
  signals?.reset(vehicle.near.distance);
  signals?.reset(vehicle.near.distance);
  rig.snap = true;
  toast("Back on the road. Take your time.");
}
function updateLabels() {
  el("terrainBtn").textContent =
    driveMode === "pune" ? season : BIOMES[biome].name;
  el("puneOptions").hidden = driveMode !== "pune";
  el("mapAttribution").hidden = driveMode !== "pune";
  el("lane").disabled = driveMode === "pune";
  el("lane").value = driveMode === "pune" ? "-2" : String(vehicle.lane);
  el("seedBtn").disabled = driveMode === "pune";
  el("seed").disabled = driveMode === "pune";
  el("biomeLabel").textContent =
    driveMode === "pune"
      ? "PUNE · " + season.toUpperCase()
      : biome.toUpperCase();
  el("timeBtn").textContent = TIMES[env.mode];
  el("timeLabel").textContent = TIMES[env.mode].toUpperCase();
  el("autoBtn").textContent = auto ? "Auto drive" : "Manual";
  el("autoBtn").setAttribute("aria-pressed", auto);
  el("camBtn").textContent = CAMERA_MODES[rig.mode];
  el("trafficBtn").textContent =
    "Traffic " + TRAFFIC[traffic.mode].toLowerCase();
  el("traffic").selectedIndex = traffic.mode;
  el("colorBtn").textContent = COLORS[color][0];
  el("muteBtn").textContent = audio.muted ? "Sound muted" : "Sound on";
  el("seedInfo").textContent = "Seed: " + seed;
  el("driveStatus").textContent = auto
    ? "Following the road. Enjoy the view."
    : "A little further. A little quieter.";
}
function pause() {
  if (!started) return;
  if (el("postcardDialog").open) {
    el("postcardDialog").close();
    return;
  }
  if (el("settings").open) {
    el("settings").close();
    return;
  }
  paused = true;
  controls.clear();
  el("settings").showModal();
}
const controls = new Controls({
  time() {
    env.mode = (env.mode + 1) % 4;
    updateLabels();
  },
  terrain() {
    if (driveMode === "pune") {
      season = SEASONS[(SEASONS.indexOf(season) + 1) % 3];
      world.setSeason(season);
      el("puneSeason").value = season;
      updateLabels();
      return;
    }
    biome = BIOME_KEYS[(BIOME_KEYS.indexOf(biome) + 1) % 4];
    rebuild();
    updateLabels();
  },
  cockpit() {
    rig.mode = rig.mode === 3 ? 0 : 3;
    rig.snap = true;
    updateLabels();
  },
  cam() {
    rig.mode = (rig.mode + 1) % CAMERA_MODES.length;
    rig.snap = true;
    updateLabels();
  },
  color() {
    color = (color + 1) % COLORS.length;
    car.setColor(COLORS[color][1]);
    updateLabels();
  },
  auto() {
    if (path.city && vehicle.near.routeGap > 35) {
      toast("Return near the Explorer route before enabling auto-drive.");
      return;
    }
    auto = !auto;
    updateLabels();
  },
  return: returnToRoad,
  traffic() {
    traffic.setMode((traffic.mode + 1) % 3, vehicle);
    persist();
    updateLabels();
  },
  mute() {
    audio.muted = !audio.muted;
    audio.start();
    persist();
    updateLabels();
  },
  pause,
});
function chooseDiscovery() {
  if (!experience) return;
  const id = el("discoveryDrive").value;
  experience.definition =
    id === "evening-chai-run" ? chaiTrip(path) : discoveryTrip(path, id);
  experience.reset();
}
el("discoveryDrive").addEventListener("change", () => {
  if (experience?.status !== "active") chooseDiscovery();
});
function canPostcard() {
  if (!path.city || Math.abs(vehicle.speed) > 0.8 || paused) return false;
  const p = path.sampleAtDistance(POSTCARD.s, {});
  return Math.hypot(vehicle.x - p.x, vehicle.z - p.z) < POSTCARD.radius;
}
el("postcardBtn").addEventListener("click", () => {
  if (!canPostcard()) return;
  controls.clear();
  auto = false;
  paused = true;
  renderer.render(scene, rig.cam);
  el("postcardImage").src = renderer.domElement.toDataURL("image/png");
  journal.postcard(POSTCARD.id);
  el("postcardDialog").showModal();
  updateLabels();
});
el("postcardDialog").addEventListener("close", () => {
  controls.clear();
  paused = switching || el("settings").open;
});
el("settings").addEventListener("close", () => {
  paused = switching;
  controls.clear();
});
el("settings").addEventListener("cancel", () => controls.clear());
el("quality").value = quality;
el("shadows").value = ["Off", "Medium", "High"].includes(saved.shadows)
  ? saved.shadows
  : "Medium";
el("reducedMotion").checked = reduced;
el("seed").value = seed;
for (const [id, key, defaultValue] of [
  ["masterVolume", "master", 0.55],
  ["engineVolume", "engine", 0.6],
  ["ambienceVolume", "ambience", 0.5],
]) {
  audio[key] = Math.max(0, Math.min(1, Number(saved[key] ?? defaultValue)));
  el(id).value = audio[key];
  el(id).addEventListener("input", () => {
    audio[key] = Number(el(id).value);
    persist();
  });
}
audio.muted = !!saved.muted;
traffic.setMode([0, 1, 2].includes(saved.traffic) ? saved.traffic : 0, vehicle);
el("driveMode").addEventListener("change", switchMode);
el("puneSeason").addEventListener("change", () => {
  season = el("puneSeason").value;
  if (path.city) world.setSeason(season);
  updateLabels();
});
el("quality").addEventListener("change", setQuality);
el("shadows").addEventListener("change", setShadows);
el("traffic").addEventListener("change", () => {
  traffic.setMode(el("traffic").selectedIndex, vehicle);
  persist();
  updateLabels();
});
el("lane").addEventListener(
  "change",
  () => (vehicle.lane = Number(el("lane").value)),
);
el("reducedMotion").addEventListener("change", () => {
  reduced = el("reducedMotion").checked;
  persist();
});
el("seedBtn").addEventListener("click", () => {
  seed = el("seed").value.trim() || "aster-2026";
  const mode = traffic.mode;
  traffic.dispose();
  path = new RoadPath(seed);
  vehicle = new Vehicle(path);
  vehicle.lane = Number(el("lane").value);
  traffic = new Traffic(scene, path);
  traffic.setMode(mode, vehicle);
  rebuild();
  rig.snap = true;
  persist();
  updateLabels();
  toast("A fresh road awaits.");
});
el("startBtn").addEventListener("click", () => {
  started = true;
  paused = false;
  el("loading").remove();
  audio.start();
  controls.clear();
});
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  rig.resize();
});
document.addEventListener("visibilitychange", () => {
  controls.clear();
  if (document.hidden && started && !paused) pause();
});
renderer.domElement.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  paused = true;
  toast("Graphics context lost. Reload to resume your drive.");
});
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY[quality].dpr));
setShadows();
const preferredDriveMode = ["endless", "pune"].includes(saved.driveMode)
  ? saved.driveMode
  : "pune";
el("driveMode").value = preferredDriveMode;
if (preferredDriveMode !== driveMode) await switchMode();
updateLabels();
let last = performance.now(),
  accumulator = 0,
  hudTime = 0,
  frameMs = 16.7;
const step = 1 / 60;
const presentation = new VehiclePose();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  frameMs += (dt * 1000 - frameMs) * 0.05;
  if (!paused) {
    accumulator += dt;
    const input = controls.input;
    while (accumulator >= step) {
      presentation.capture(vehicle);
      vehicle.update(step, input, auto, biome, traffic);
      const violations = signals?.update(step, vehicle) || 0;
      experience?.update(step, vehicle, violations);
      if (experience?.status === "completed" && auto) {
        auto = false;
        updateLabels();
      }
      traffic.update(step, vehicle, env.night);
      accumulator -= step;
      time += step;
    }
  } else accumulator = 0;
  vehicle.auto = auto;
  car.setCameraMode(rig.mode);
  const visual = presentation.sample(
    vehicle,
    accumulator / step,
    paused || rig.snap,
  );
  car.place(visual, reduced);
  car.update(paused ? 0 : dt, visual.speed, env.night, vehicle.braking);
  updateWorld();
  env.update(visual, dt, biome, time, reduced);
  if (driveMode === "pune") {
    scene.fog.far = season === "Monsoon" ? 360 : quality === "Low" ? 260 : 490;
    if (season === "Monsoon") {
      env.sun.intensity *= 0.65;
      env.skyU.top.value.lerp(env.temp.setHex(0x84979b), 0.04);
    }
    if (world.error) el("cityLoading").textContent = world.error;
    if (world.error) el("cityLoading").hidden = false;
    const b = path.bounds;
    if (
      vehicle.x < b[0] + 5 ||
      vehicle.x > b[2] - 5 ||
      vehicle.z < b[1] + 5 ||
      vehicle.z > b[3] - 5
    ) {
      vehicle.x = Math.max(b[0] + 5, Math.min(b[2] - 5, vehicle.x));
      vehicle.z = Math.max(b[1] + 5, Math.min(b[3] - 5, vehicle.z));
      vehicle.speed = 0;
      toast("Edge of the Pune pilot. Turn back or use Return to Road.");
    }
  }
  for (const material of Object.values(world.res))
    if (material?.isMaterial) material.envMapIntensity = 0.5 - env.night * 0.44;
  particles.update(visual, biome, env.night, time, reduced);
  rig.update(visual, dt, reduced, car);
  audio.update(
    vehicle,
    env.night,
    paused,
    driveMode === "pune"
      ? {
          district:
            experience?.definition.objectives[experience.objectiveIndex]
              ?.district ?? "Pashan approach",
          season,
          time: experience?.status === "active" ? experience.elapsed : time,
        }
      : null,
  );
  hudTime += dt;
  if (hudTime > 0.15) {
    el("postcardBtn").hidden = !canPostcard();
    const entries = journal.snapshot;
    const journalText =
      [
        ...entries.drives.map((d) => `${d.name} · ${d.quality}`),
        ...entries.scenes.map((s) => `${s.label} — ${s.provenance}`),
        ...entries.postcards.map(
          () => "A pause for chai · postcard saved for this visit",
        ),
      ].join("\n") ||
      "Take the long way. Your discoveries stay for this visit.";
    if (el("journalEntries").textContent !== journalText)
      el("journalEntries").textContent = journalText;
    tripUI.update(
      experience?.snapshot,
      started && !paused && driveMode === "pune",
    );
    el("speed").textContent = Math.round(Math.abs(vehicle.speed) * 3.6);
    el("dist").textContent = vehicle.dist.toFixed(2);
    el("surface").textContent = (vehicle.surface || "Asphalt").toUpperCase();
    el("routeStatus").hidden = driveMode !== "pune";
    if (driveMode === "pune")
      el("routeStatus").textContent =
        "Baner–Pashan Explorer · " +
        Math.round((vehicle.near.distance / path.length) * 100) +
        "% · " +
        (cityData.manifest.elevation.kind === "procedural-fallback"
          ? "Synthetic terrain"
          : "DEM terrain");
    hudTime = 0;
  }
  renderer.render(scene, rig.cam);
}
requestAnimationFrame(loop);
el("startBtn").disabled = false;
el("startBtn").textContent = "Begin your drive →";
// Read-only diagnostics for local QA, available without changing normal play.
window.wanderlane = {
  get state() {
    return {
      seed,
      frameMs,
      driveMode,
      settlementBuildings: world.settlementCount ?? 0,
      season,
      city:
        driveMode === "pune"
          ? {
              ...world.stats,
              trafficTypes: traffic.cars.reduce(
                (counts, c) => {
                  counts[c.car.type]++;
                  return counts;
                },
                { car: 0, rickshaw: 0, scooter: 0, bus: 0 },
              ),
            }
          : null,
      journal: journal.snapshot,
      experience: experience?.snapshot ?? { available: false },
      biome,
      time: TIMES[env.mode],
      auto,
      paused,
      camera: rig.mode,
      traffic: traffic.mode,
      collisions: traffic.collisions.snapshot,
      impact: {
        lateralSpeed: Math.hypot(vehicle.impactVX || 0, vehicle.impactVZ || 0),
        yawRate: vehicle.impactYaw || 0,
      },
      speed: vehicle.speed,
      heading: vehicle.heading,
      distance: vehicle.dist,
      roadDistance: vehicle.near.distance,
      offset: vehicle.near.offset,
      surface: vehicle.surface,
      chunks: world.chunks.size,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      headlights: car.lights.map((l) => l.intensity),
      trafficCars: traffic.cars.map((c) => ({
        variant: c.car.variant || "car",
        s: c.s,
        lane: c.lane,
        speed: c.speed,
        visible: c.car.group.visible,
        waiting: !!c.waiting,
        type: c.car.type || "car",
        impactOffset: Math.hypot(c.impactX || 0, c.impactZ || 0),
        impactYaw: c.impactHeading || 0,
        position: { x: c.sample.x, y: c.sample.y, z: c.sample.z },
      })),
      position: { x: vehicle.x, y: vehicle.y, z: vehicle.z },
      renderPosition: {
        x: car.group.position.x,
        y: car.group.position.y,
        z: car.group.position.z,
      },
      cameraPosition: rig.cam.position.toArray(),
      cockpitVisible: car.cockpit.group.visible,
      steeringWheelAngle: car.cockpit.wheel.rotation.z,
      instrumentSpeed: car.cockpit.lastSpeed,
      muted: audio.muted,
      audioStatus: audio.status,
      audioNodes: audio.nodes?.length ?? 0,
      quality,
      reduced,
    };
  },
};
