import * as THREE from 'three';
import { NSEG } from './config.js';
import { heightAt } from './heightfield.js';

function bladeTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d'); x.clearRect(0,0,64,64);
  for (let i = 0; i < 7; i++) {
    const bx = 8 + i*8; x.strokeStyle = 'rgba(255,255,255,' + (.6+Math.random()*.4) + ')'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(bx,64); x.quadraticCurveTo(bx+(Math.random()-.5)*16,30,bx+(Math.random()-.5)*22,4); x.stroke();
  }
  return new THREE.CanvasTexture(cv);
}

// Instanced grass tufts + scattered trees and rocks around the road.
export class Scenery {
  constructor(scene, road) {
    this.scene = scene; this.road = road; this.tmp = new THREE.Color(); this.dummy = new THREE.Object3D();
    const g = new THREE.PlaneGeometry(1.6,1.0); g.translate(0,.5,0);
    this.grass = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color:0x6fae5a, alphaMap:bladeTexture(), transparent:true, alphaTest:.4, side:THREE.DoubleSide, roughness:1 }), 5000);
    scene.add(this.grass);
    this.trunkM = new THREE.MeshStandardMaterial({ color:0x5b432c });
    this.leafM = new THREE.MeshStandardMaterial({ color:0x2f5d2a });
    this.rockM = new THREE.MeshStandardMaterial({ color:0x8a7a6a, flatShading:true });
    this.trunkG = new THREE.CylinderGeometry(.25,.4,3,6); this.leafG = new THREE.ConeGeometry(2,5.5,8); this.rockG = new THREE.DodecahedronGeometry(1.3);
    this.trees = [];
  }
  scatterTrees(t) {
    this.trees.forEach(o => this.scene.remove(o)); this.trees = [];
    for (let i = 2; i < NSEG; i += 5) {
      if (Math.random() > t.treeChance) continue;
      const side = Math.random()<.5?1:-1, off = 18+Math.random()*90, [nx,nz] = this.road.normAt(i);
      const x = this.road.cx[i]+nx*off*side, z = this.road.cz[i]+nz*off*side, y = heightAt(x,z);
      let g;
      if (Math.random()<.12) { g = new THREE.Mesh(this.rockG,this.rockM); g.position.set(x,y,z); g.scale.setScalar(.6+Math.random()); }
      else { g = new THREE.Group(); const lm = this.leafM.clone(); lm.color.copy(this.tmp.setHex(t.tree).offsetHSL(0,0,(Math.random()-.5)*.1));
        const tr = new THREE.Mesh(this.trunkG,this.trunkM), l1 = new THREE.Mesh(this.leafG,lm), l2 = new THREE.Mesh(this.leafG,lm);
        tr.position.y=1.5; l1.position.y=3.4; l2.position.y=5.2; l2.scale.setScalar(.7); g.add(tr,l1,l2); g.position.set(x,y,z); g.scale.setScalar(.9+Math.random()*1.1); }
      g.castShadow = true; this.trees.push(g); this.scene.add(g);
    }
  }
  scatterGrass(px, pz, t) {
    const cx = this.road.cx, cz = this.road.cz, n = cx.length, exclude = this.road.RV + 3;
    for (let k = 0; k < 5000; k++) {
      const a = Math.random()*6.28, r = 6+Math.random()*120, x = px+Math.cos(a)*r, z = pz+Math.sin(a)*r;
      let near = false;
      for (let i = 0; i < n; i += 3) { if (Math.abs(cx[i]-x) < exclude && Math.abs(cz[i]-z) < exclude) { near = true; break; } }
      if (near || Math.random() > t.grassDensity) { this.grass.setMatrixAt(k, new THREE.Matrix4().makeScale(0,0,0)); continue; }
      this.dummy.position.set(x, heightAt(x,z), z); this.dummy.rotation.y = Math.random()*6.28;
      this.dummy.scale.set(.8+Math.random()*.5,.6+Math.random()*.5,1); this.dummy.updateMatrix();
      this.grass.setMatrixAt(k, this.dummy.matrix);
      this.tmp.setHex(t.grass).offsetHSL(0,0,(Math.random()-.5)*.1); this.grass.setColorAt(k, this.tmp);
    }
    this.grass.instanceMatrix.needsUpdate = true; if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true;
  }
  setGrassColor(hex) { this.grass.material.color.setHex(hex); }
}
