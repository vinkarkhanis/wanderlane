import * as THREE from 'three';
import { TERRAINS, TERRAIN_KEYS, COLORS } from './config.js';
import { Road } from './road.js';
import { Terrain } from './terrain.js';
import { Scenery } from './scenery.js';
import { Car } from './car.js';
import { Vehicle } from './vehicle.js';
import { Environment } from './environment.js';
import { CameraRig } from './camera.js';
import { Controls } from './controls.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;
addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));

const scene = new THREE.Scene();
const env = new Environment(scene);
const road = new Road(scene);
const terrain = new Terrain(scene);
const scenery = new Scenery(scene, road);
const car = new Car(scene, COLORS[0][1]);
const rig = new CameraRig();
const vehicle = new Vehicle(road.cx[2], road.cz[2]);

let tk = 0, ci = 0, auto = false;
function applyTerrain() {
  const t = TERRAINS[TERRAIN_KEYS[tk]];
  terrainBtn.lastChild.textContent = ' ' + t.name;
  terrain.setColor(t.ground); road.setColor(t.road); scenery.setGrassColor(t.grass);
  scenery.scatterTrees(t); scenery.scatterGrass(vehicle.x, vehicle.z, t);
}
applyTerrain();

const controls = new Controls({
  time:   () => { timeBtn.lastChild.textContent = ' ' + (env.toggle() ? 'Day' : 'Night'); },
  terrain:() => { tk = (tk+1) % TERRAIN_KEYS.length; applyTerrain(); },
  cam:    () => { camBtn.lastChild.textContent = ' ' + rig.toggle(); },
  auto:   () => { auto = !auto; autoBtn.lastChild.textContent = ' ' + (auto ? 'Auto' : 'Manual'); },
  color:  () => { ci = (ci+1) % COLORS.length; car.setColor(COLORS[ci][1]); colorBtn.lastChild.textContent = ' ' + COLORS[ci][0]; },
});

const speedEl = document.getElementById('speed'), distEl = document.getElementById('dist');
const clock = new THREE.Clock(); let lastGX = vehicle.x, lastGZ = vehicle.z;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .05), t = TERRAINS[TERRAIN_KEYS[tk]];
  vehicle.update(dt, controls.input, auto);
  car.place(vehicle.x, vehicle.z, vehicle.heading, vehicle.steer, vehicle.pitch, vehicle.squat);
  car.spin(dt, vehicle.speed);
  terrain.update(vehicle.x, vehicle.z);
  if (Math.hypot(vehicle.x-lastGX, vehicle.z-lastGZ) > 40) { scenery.scatterGrass(vehicle.x, vehicle.z, t); lastGX = vehicle.x; lastGZ = vehicle.z; }
  env.update(vehicle.x, vehicle.z, t.fog);
  rig.update(vehicle.x, car.position.y, vehicle.z, vehicle.heading);
  speedEl.innerHTML = Math.round(vehicle.speed) + '<small> km/h</small>';
  distEl.textContent = vehicle.dist.toFixed(2) + ' km';
  renderer.render(scene, rig.cam);
}
loop();
