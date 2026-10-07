import * as THREE from "three";

// Route distance alone is not a visibility test: a city loop can fold back
// beside itself, and an aerial camera can see well beyond the driving corridor.
export class TrafficVisibility {
  constructor() {
    this.frustum = new THREE.Frustum();
    this.matrix = new THREE.Matrix4();
    this.sphere = new THREE.Sphere();
    this.cameraPosition = new THREE.Vector3();
    this.ready = false;
  }
  update(camera, visibleRange = Infinity) {
    camera.updateWorldMatrix(true, false);
    this.matrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.matrix);
    camera.getWorldPosition(this.cameraPosition);
    this.visibleRange = visibleRange;
    this.ready = true;
  }
  canRecycle(c, player, dt) {
    const position = c.car.group.position;
    const nearby =
      Math.hypot(position.x - player.x, position.z - player.z) < 180;
    this.sphere.center.copy(position);
    this.sphere.center.y += 1.5;
    // A generous envelope keeps recycling away from the edge of the screen.
    const bounds = c.car.bounds;
    this.sphere.radius =
      Math.hypot(bounds.halfWidth, bounds.halfLength, 3) + 15;
    const withinFog =
      this.sphere.center.distanceTo(this.cameraPosition) <
      this.visibleRange + this.sphere.radius;
    const onScreen =
      this.ready && withinFog && this.frustum.intersectsSphere(this.sphere);
    if (nearby || onScreen) {
      c.recycleDelay = 0;
      return false;
    }
    c.recycleDelay = (c.recycleDelay || 0) + dt;
    return c.recycleDelay >= 1;
  }
}
