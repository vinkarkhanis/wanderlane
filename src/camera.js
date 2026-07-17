import * as THREE from 'three';

// Chase + hood cameras following the vehicle heading.
export class CameraRig {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, .1, 3000);
    this.mode = 0;
    addEventListener('resize', () => { this.cam.aspect = innerWidth/innerHeight; this.cam.updateProjectionMatrix(); });
  }
  toggle() { this.mode = (this.mode + 1) % 2; return this.mode === 0 ? 'Chase' : 'Hood'; }
  update(px, py, pz, ang) {
    if (this.mode === 0) {
      this.cam.position.lerp(new THREE.Vector3(px-Math.sin(ang)*7, py+2.4, pz-Math.cos(ang)*7), .1);
      this.cam.lookAt(px+Math.sin(ang)*9, py+1, pz+Math.cos(ang)*9);
    } else {
      this.cam.position.set(px, py+1.4, pz);
      this.cam.lookAt(px+Math.sin(ang)*10, py+1.1, pz+Math.cos(ang)*10);
    }
  }
}
