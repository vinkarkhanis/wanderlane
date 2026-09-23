import * as THREE from "three";
import { CAR_ANCHORS } from "./carGeometry.js";
export class CameraRig {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(
      58,
      innerWidth / innerHeight,
      0.08,
      1600,
    );
    this.mode = 0;
    this.position = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.snap = true;
  }
  update(v, dt, reduced = false, car = null) {
    const cockpit = this.mode === 3;
    const desiredFov = cockpit ? 72 : 58;
    if (this.cam.fov !== desiredFov) {
      this.cam.fov = desiredFov;
      this.cam.updateProjectionMatrix();
    }
    if (cockpit && car) {
      car.body.updateWorldMatrix(true, false);
      this.cam.position
        .fromArray(CAR_ANCHORS.cockpit)
        .applyMatrix4(car.body.matrixWorld);
      this.target
        .set(CAR_ANCHORS.cockpit[0], 1.19, 25)
        .applyMatrix4(car.body.matrixWorld);
      this.cam.up.set(0, 1, 0).transformDirection(car.body.matrixWorld);
      this.cam.lookAt(this.target);
      this.snap = false;
      return;
    }
    this.cam.up.set(0, 1, 0);
    const wide = this.mode === 2,
      hood = this.mode === 1,
      back = wide ? 13 : 8.2,
      up = wide ? 5.7 : 3.4,
      s = Math.sin(v.heading),
      c = Math.cos(v.heading);
    this.position.set(
      v.x + s * (hood ? 2.4 : -back),
      v.y + (hood ? 1.13 : up),
      v.z + c * (hood ? 2.4 : -back),
    );
    this.target.set(v.x + s * 18, v.y + (hood ? 0.85 : 1.1), v.z + c * 18);
    const a = this.snap || hood || reduced ? 1 : 1 - Math.exp(-7 * dt);
    this.cam.position.lerp(this.position, a);
    this.look.lerp(this.target, a);
    this.cam.lookAt(this.look);
    this.snap = false;
  }
  resize() {
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }
}
