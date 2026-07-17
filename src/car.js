import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { heightAt } from './heightfield.js';

const MODEL = 'https://threejs.org/examples/models/gltf/ferrari.glb';
const DRACO = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

// Loads a real modeled sports car (glTF). Falls back to procedural body if load fails.
export class Car {
  constructor(scene, color = 0xd61f3a) {
    this.group = new THREE.Group();
    this.wheels = [];
    this.paint = new THREE.MeshPhysicalMaterial({ color, metalness:.9, roughness:.35, clearcoat:1, clearcoatRoughness:.1 });
    scene.add(this.group);
    this._buildFallback();
    this._loadModel();
  }
  _loadModel() {
    const draco = new DRACOLoader().setDecoderPath(DRACO);
    const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
    loader.load(MODEL, gltf => {
      const m = gltf.scene; m.scale.set(2.6,2.6,2.6); m.rotation.y = Math.PI;
      m.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.name === 'body') o.material = this.paint;
        if (o.material && o.material.name === 'glass') { o.material.transparent = true; o.material.opacity = .35; } } });
      ['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].forEach(n => { const w = m.getObjectByName(n); if (w) this.wheels.push(w); });
      this.fallback.visible = false; this.group.add(m); this.modeled = true;
    }, undefined, () => { console.warn('glTF car failed, using fallback'); });
  }
  _buildFallback() {
    this.fallback = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-2.4,.3); s.quadraticCurveTo(-2.55,.55,-2.35,.78); s.lineTo(-1.55,.82);
    s.quadraticCurveTo(-.8,1.3,.2,1.32); s.quadraticCurveTo(1.0,1.28,1.55,.8); s.lineTo(2.15,.72);
    s.quadraticCurveTo(2.5,.6,2.45,.3); s.quadraticCurveTo(2.4,.14,2.0,.18); s.lineTo(-2.1,.2); s.quadraticCurveTo(-2.35,.18,-2.4,.3);
    const g = new THREE.ExtrudeGeometry(s,{depth:1.9,bevelEnabled:true,bevelSize:.3,bevelThickness:.15,bevelSegments:5,curveSegments:24}); g.center(); g.rotateY(Math.PI/2);
    const b = new THREE.Mesh(g,this.paint); b.position.y=.5; b.castShadow=true; this.fallback.add(b);
    const tireG=new THREE.CylinderGeometry(.54,.54,.42,20),tm=new THREE.MeshStandardMaterial({color:0x0b0b0b});
    [[-1,-1.5],[1,-1.5],[-1,1.5],[1,1.5]].forEach(p=>{const t=new THREE.Mesh(tireG,tm);t.rotation.z=Math.PI/2;t.position.set(p[0],.54,p[1]);t.castShadow=true;this.fallback.add(t);this.wheels.push(t);});
    this.group.add(this.fallback);
  }
  setColor(hex) { this.paint.color.setHex(hex); }
  get position() { return this.group.position; }
  place(x, z, heading, steer, pitch, squat) {
    this.group.position.set(x, heightAt(x,z) + .05, z);
    this.group.rotation.set(-pitch + squat, heading, -steer*.1);
  }
  spin(dt, speed) { this.wheels.forEach(w => w.rotation.x -= speed*dt*.12); }
}
