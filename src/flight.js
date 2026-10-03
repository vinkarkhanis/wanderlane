import { angleDelta, clamp, damp } from "./config.js";
import { terrainHeight } from "./heightfield.js";
import { clearImpact } from "./vehicleCollisions.js";

export function resetFlight(v) {
  v.flight = "ground";
  v.flightAltitude = 0;
  v.flightTarget = null;
}
export function toggleFlight(v) {
  if (v.flight === "ground") {
    clearImpact(v);
    v.flight = "takeoff";
    v.flightHeight = v.path.city ? 55 : 35;
    v.flightTarget = null;
    v.speed = Math.max(0, v.speed);
  } else if (v.flight === "landing") {
    v.flight =
      v.flightAltitude < (v.path.city ? 45 : 18) ? "takeoff" : "flying";
    v.flightTarget = null;
  } else {
    // Ignore altitude when selecting a road from the air: it would bias the
    // city lookup towards a distant bridge rather than the road below us.
    const p = v.path.findNearestRoadPoint(v.x, v.z, {});
    let heading = p.heading,
      nx = p.nx,
      nz = p.nz;
    const road = v.path.city ? v.path.roads[p.roadId] : null;
    if (road?.oneway === -1) {
      heading += Math.PI;
      nx *= -1;
      nz *= -1;
    }
    const lane = road
      ? road.oneway
        ? 0
        : -Math.min(1.7, road.width / 4)
      : v.lane;
    v.flightTarget = {
      x: p.x + nx * lane,
      z: p.z + nz * lane,
      y: p.y,
      heading,
      pitch: p.pitch || 0,
      distance: p.distance,
    };
    v.flight = "landing";
  }
}
function groundAt(v, biome) {
  const p = v.path.findNearestRoadPoint(v.x, v.z, v.near);
  return Math.max(
    p.y,
    v.path.groundHeight?.(v.x, v.z) ??
      terrainHeight(v.path, p.distance, p.offset, biome),
  );
}
export function stepFlight(v, dt, input, biome, traffic) {
  v.surface = "Air";
  v.wheelHeights = null;
  v.wheelAngle = v.squat = 0;
  v.throttle = damp(v.throttle, input.accel ? 1 : 0, 4, dt);
  v.braking = !!input.brake;
  const base = groundAt(v, biome),
    minHeight = v.path.city ? 45 : 18;
  if (v.flight === "landing") {
    const t = v.flightTarget;
    const gap = Math.hypot(t.x - v.x, t.z - v.z);
    const move = Math.min(gap, Math.max(2, Math.min(18, gap * 1.5)) * dt);
    const nx = gap ? v.x + ((t.x - v.x) / gap) * move : v.x;
    const nz = gap ? v.z + ((t.z - v.z) / gap) * move : v.z;
    const clearance = Math.max(
      base + minHeight,
      t.y + minHeight,
      v.path.flightFloor?.(nx, nz) ?? -Infinity,
    );
    if (gap > 0 && v.y >= clearance - 0.1) {
      v.x = nx;
      v.z = nz;
    }
    v.heading += angleDelta(t.heading, v.heading) * (1 - Math.exp(-3 * dt));
    v.speed = damp(v.speed, 0, 3, dt);
    v.steer = damp(v.steer, 0, 4, dt);
    v.pitch = damp(v.pitch, 0, 4, dt);
    v.roll = damp(v.roll, 0, 4, dt);
    const ready = v.path.flightLandingReady?.(t) ?? true;
    if (gap > 0.08 || !ready) {
      v.y += clamp(clearance - v.y, 0, 9 * dt);
    } else {
      // Reserve the road during descent, including the final touchdown tick.
      traffic?.clearNear(t.distance);
      v.y = Math.max(
        t.y,
        v.y - Math.min(7, Math.max(0.6, (v.y - t.y) * 1.4)) * dt,
      );
      if (v.y - t.y < 0.035) {
        v.x = t.x;
        v.z = t.z;
        v.y = t.y;
        v.heading = t.heading;
        v.pitch = t.pitch;
        v.speed = v.steer = v.throttle = v.roll = 0;
        clearImpact(v);
        resetFlight(v);
        v.path.findNearestRoadPoint(v.x, v.z, v.near, v.y);
        v.surface = "Asphalt";
        return;
      }
    }
  } else {
    const takingOff = v.flight === "takeoff";
    v.steer = damp(
      v.steer,
      (input.left ? 1 : 0) - (input.right ? 1 : 0),
      4,
      dt,
    );
    if (!takingOff) {
      v.heading += v.steer * 0.65 * dt;
      v.speed = clamp(
        v.speed +
          ((input.accel ? 7 : 0) - (input.brake ? 12 : 0) - v.speed * 0.16) *
            dt,
        0,
        32,
      );
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      v.flightHeight = clamp(
        v.flightHeight +
          ((input.rise ? 1 : 0) - (input.descend ? 1 : 0)) * 14 * dt,
        minHeight,
        110,
      );
      // Flight stays inside the finite scenery corridor / authored city pilot.
      if (v.path.city) {
        const b = v.path.bounds;
        v.x = clamp(v.x, b[0] + 15, b[2] - 15);
        v.z = clamp(v.z, b[1] + 15, b[3] - 15);
      } else v.x = clamp(v.x, -180, 180);
    } else v.speed = damp(v.speed, 0, 3, dt);
    const support = groundAt(v, biome);
    const floor = Math.max(
      support + minHeight,
      v.path.flightFloor?.(v.x, v.z) ?? -Infinity,
    );
    const goal = Math.max(support + v.flightHeight, floor);
    v.y += clamp(goal - v.y, -7 * dt, 9 * dt);
    if (!takingOff) v.y = Math.max(v.y, floor);
    if (takingOff && Math.abs(goal - v.y) < 0.2) v.flight = "flying";
    v.pitch = damp(v.pitch, takingOff ? 0.06 : input.accel ? -0.05 : 0, 3, dt);
    v.roll = damp(v.roll, -v.steer * 0.16, 3, dt);
    v.dist += (v.speed * dt) / 1000;
  }
  const ground = groundAt(v, biome);
  v.flightAltitude = Math.max(0, v.y - ground);
}
