import * as THREE from "three";
import { CAR_ANCHORS } from "./carGeometry.js";
import { CAMERA, damp, angleDelta, clamp } from "./config.js";
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
    this.aerialMix = 0;
  }
  update(v, dt, reduced = false, car = null) {
    dt = Math.max(0, Math.min(dt, 0.1));
    const profile = v.spec?.ride;
    const amount =
      reduced || v.flight !== "ground" ? 0 : (profile?.camera ?? 0);
    if (this.snap || this.model !== v.spec?.id || reduced) {
      this.sway = this.push = this.bump = 0;
      this.model = v.spec?.id;
    }
    this.sway = damp(
      this.sway || 0,
      clamp((v.lateralAcceleration || 0) * 0.025 * amount, -0.16, 0.16),
      4,
      dt,
    );
    this.push = damp(
      this.push || 0,
      clamp((v.acceleration || 0) * 0.012 * amount, -0.08, 0.08),
      4,
      dt,
    );
    this.bump = damp(
      this.bump || 0,
      clamp((v.suspensionOffset || 0) * amount, -0.04, 0.04),
      7,
      dt,
    );
    this.response = { sway: this.sway, push: this.push, bump: this.bump };
    this.height = this.snap
      ? v.y
      : damp(this.height, v.y, reduced ? 3 : CAMERA.vertical, dt);
    if (this.pickupScene && car && !reduced) {
      car.body.updateWorldMatrix(true, false);
      this.cam.position.set(7, 3.8, -6.2).applyMatrix4(car.body.matrixWorld);
      this.target.set(1.6, 0.9, 0.2).applyMatrix4(car.body.matrixWorld);
      this.cam.up.set(0, 1, 0);
      this.cam.fov = 52;
      this.cam.updateProjectionMatrix();
      this.cam.lookAt(this.target);
      this.snap = false;
      return;
    }
    this.pitch = this.snap
      ? v.pitch
      : damp(this.pitch, v.pitch, CAMERA.pitch, dt);
    this.heading = this.snap
      ? v.heading
      : this.heading +
        angleDelta(v.heading, this.heading) *
          (1 - Math.exp(-(profile?.lag ?? CAMERA.horizontal) * dt));
    const cockpit = this.mode === 3;
    const desiredFov = cockpit
      ? v.spec?.kind === "bike"
        ? 80
        : 72
      : (profile?.fov ?? 58);
    if (this.cam.fov !== desiredFov) {
      this.cam.fov = desiredFov;
      this.cam.updateProjectionMatrix();
    }
    if (cockpit && car) {
      car.body.updateWorldMatrix(true, false);
      this.cam.position
        .fromArray(car.cockpitAnchor || CAR_ANCHORS.cockpit)
        .applyMatrix4(car.body.matrixWorld);
      const anchor = car.cockpitAnchor || CAR_ANCHORS.cockpit;
      this.target
        .set(
          anchor[0] + this.sway,
          anchor[1] - 0.06 + this.push + this.bump,
          25,
        )
        .applyMatrix4(car.body.matrixWorld);
      this.cam.up.set(0, 1, 0).transformDirection(car.body.matrixWorld);
      if (this.passengerLook && car.passengerSeat) {
        // Use the actual seat row for the glance. The normal forward cockpit
        // anchor differs between models and can sit behind a front headrest.
        this.cam.position.set(
          -car.passengerSeat[0],
          Math.max(anchor[1], car.passengerSeat[1] + 0.74) + 0.05,
          car.passengerSeat[2] - 0.1,
        );
        this.cam.position.applyMatrix4(car.body.matrixWorld);
        this.target.fromArray(car.passengerSeat);
        this.target.y += 0.3;
        this.target.z -= 0.04;
        this.target.applyMatrix4(car.body.matrixWorld);
      }
      this.cam.lookAt(this.target);
      this.snap = false;
      return;
    }
    this.cam.up.set(0, 1, 0);
    const aerial = v.flight && v.flight !== "ground";
    this.aerialMix = damp(this.aerialMix, aerial ? 1 : 0, 3, dt);
    const wide = this.mode === 2,
      hood = this.mode === 1,
      back =
        (wide ? 13 : (profile?.back ?? 8.2)) +
        (car?.cameraHeight || 0) +
        this.aerialMix * (wide ? 11 : 7.8),
      up =
        (wide ? 5.7 : (profile?.height ?? 3.4)) +
        (car?.cameraHeight || 0) +
        this.aerialMix * (wide ? 6.3 : 3.6),
      s = Math.sin(hood ? v.heading : this.heading),
      c = Math.cos(hood ? v.heading : this.heading);
    this.position.set(
      v.x + s * (hood ? (car?.bumperAnchor?.[2] ?? 2.4) : -back),
      (hood ? v.y : this.height) +
        (hood ? (car?.bumperAnchor?.[1] ?? 1.13) : up),
      v.z + c * (hood ? (car?.bumperAnchor?.[2] ?? 2.4) : -back),
    );
    this.target.set(
      v.x + s * 18,
      (hood ? v.y : this.height) +
        (hood ? 0.85 : 1.1) +
        this.pitch * (reduced ? 3 : 8),
      v.z + c * 18,
    );
    this.position.y += this.bump;
    this.target.x += c * this.sway;
    this.target.z -= s * this.sway;
    this.target.y += this.push;
    // Smooth the orbit, not world translation: car and camera must advance on
    // the same render clock, otherwise their different delays create vibration.
    this.cam.position.copy(this.position);
    this.look.copy(this.target);
    this.cam.lookAt(this.look);
    this.snap = false;
  }
  resize() {
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }
}
