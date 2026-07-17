import * as THREE from 'three';
import { ROAD, NSEG } from './config.js';
import { heightAt } from './heightfield.js';

// Procedural winding road. Builds the centerline once, then exposes the
// asphalt mesh, lane lines, and right-side guardrail.
export class Road {
  constructor(scene) {
    this.scene = scene;
    this.cx = []; this.cz = [];
    let dir = 0, hx = 0, hz = 0, curve = 0;
    for (let i = 0; i < NSEG; i++) {
      if (Math.random() < .025) curve = (Math.random() - .5) * .05;
      dir += curve; hx += Math.sin(dir) * ROAD.SEG; hz += Math.cos(dir) * ROAD.SEG;
      this.cx.push(hx); this.cz.push(hz);
    }
    this.RV = ROAD.WIDTH / 2;
    this._buildSurface();
    this._buildLines();
    this._buildGuardrail();
  }

  normAt(i) {
    const a = Math.max(0, i - 1), b = Math.min(NSEG - 1, i + 1);
    const tx = this.cx[b] - this.cx[a], tz = this.cz[b] - this.cz[a], l = Math.hypot(tx, tz) || 1;
    return [-tz / l, tx / l];
  }

  _buildSurface() {
    const g = new THREE.PlaneGeometry(1, 1, 1, NSEG - 1), p = g.attributes.position;
    for (let i = 0; i < NSEG; i++) {
      const [nx, nz] = this.normAt(i), y = heightAt(this.cx[i], this.cz[i]) + .2;
      p.setXYZ(i*2, this.cx[i]+nx*this.RV, y, this.cz[i]+nz*this.RV);
      p.setXYZ(i*2+1, this.cx[i]-nx*this.RV, y, this.cz[i]-nz*this.RV);
    }
    p.needsUpdate = true; g.computeVertexNormals();
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color:0x33373d, roughness:.9 }));
    this.mesh.receiveShadow = true; this.scene.add(this.mesh);
  }

  _line(off, w) {
    const g = new THREE.PlaneGeometry(1, 1, 1, NSEG - 1), p = g.attributes.position;
    for (let i = 0; i < NSEG; i++) {
      const [nx, nz] = this.normAt(i), y = heightAt(this.cx[i], this.cz[i]) + .22;
      p.setXYZ(i*2, this.cx[i]+nx*(off+w), y, this.cz[i]+nz*(off+w));
      p.setXYZ(i*2+1, this.cx[i]+nx*(off-w), y, this.cz[i]+nz*(off-w));
    }
    p.needsUpdate = true;
    this.scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color:0xeeeee0, roughness:.6 })));
  }
  _buildLines() { this._line(this.RV-.4,.12); this._line(-this.RV+.4,.12); this._line(.4,.12); this._line(-.4,.12); }

  _buildGuardrail() {
    const m = new THREE.MeshStandardMaterial({ color:0xbcc2c8, metalness:.6, roughness:.4 });
    for (let i = 4; i < NSEG; i += 6) {
      const [nx, nz] = this.normAt(i), x = this.cx[i]+nx*(this.RV+1.5), z = this.cz[i]+nz*(this.RV+1.5), y = heightAt(x,z);
      const post = new THREE.Mesh(new THREE.BoxGeometry(.15,1.2,.15), m); post.position.set(x,y+.6,z); post.castShadow=true; this.scene.add(post);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.1,.4,4), m); bar.position.set(x,y+.9,z);
      bar.lookAt(this.cx[i+5]+nx*(this.RV+1.5), y+.9, this.cz[i+5]+nz*(this.RV+1.5)); this.scene.add(bar);
    }
  }

  setColor(hex) { this.mesh.material.color.setHex(hex); }
}
