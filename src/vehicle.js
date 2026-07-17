import { PHYS } from './config.js';
import { heightAt } from './heightfield.js';

// Free-driving vehicle physics. Heading only changes when the user steers.
export class Vehicle {
  constructor(x, z) { this.x = x; this.z = z; this.heading = 0; this.speed = 0; this.steer = 0; this.dist = 0; }
  update(dt, input, auto) {
    if (auto) this.speed += (PHYS.autoSpeed - this.speed) * .5 * dt;
    else { this.speed += (input.accel ? PHYS.accel : -PHYS.drag) * dt; if (input.brake) this.speed -= PHYS.brake * dt; }
    this.speed = Math.max(0, Math.min(this.speed, PHYS.maxSpeed));
    const target = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (target - this.steer) * .12;
    const turn = this.steer * PHYS.turnRate * (this.speed / 45) * Math.min(1, this.speed / 8);
    this.heading += turn * dt;
    const mv = this.speed * dt / 3.6;
    this.x += Math.sin(this.heading) * mv; this.z += Math.cos(this.heading) * mv;
    this.dist += this.speed * dt / 3600;
    const yA = heightAt(this.x + Math.sin(this.heading)*3, this.z + Math.cos(this.heading)*3);
    const yB = heightAt(this.x - Math.sin(this.heading)*3, this.z - Math.cos(this.heading)*3);
    this.pitch = Math.atan2(yA - yB, 6);
    this.squat = (input.accel ? .04 : 0) - (input.brake ? .05 : 0);
  }
}
