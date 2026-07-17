import * as THREE from 'three';
import { heightAt } from './heightfield.js';

// Low-poly ground that follows the car, plus a distant hill ring.
export class Terrain {
  constructor(scene) {
    const SIZE = 1200, SEG = 120;
    this.geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    this.pos = this.geo.attributes.position;
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ color:0x5a9a4e, roughness:1, flatShading:true }));
    this.mesh.rotation.x = -Math.PI/2; this.mesh.position.y = -.5; this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.hills = new THREE.Mesh(new THREE.RingGeometry(400,1900,64,1), new THREE.MeshBasicMaterial({ color:0x8fb878, fog:false }));
    this.hills.rotation.x = -Math.PI/2; this.hills.position.y = 2; scene.add(this.hills);
  }
  update(px, pz) {
    this.mesh.position.set(px, -.5, pz); this.hills.position.set(px, 8, pz);
    for (let i = 0; i < this.pos.count; i++) {
      const wx = this.pos.getX(i)+px, wz = -this.pos.getY(i)+pz;
      this.pos.setZ(i, heightAt(wx, wz) + .5);
    }
    this.pos.needsUpdate = true; this.geo.computeVertexNormals();
  }
  setColor(hex) { this.mesh.material.color.setHex(hex); this.hills.material.color.setHex(hex); }
}
