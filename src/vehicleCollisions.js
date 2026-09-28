// Bounded planar rigid-body contacts. Metres, kilograms and seconds; heading
// uses the game's +Z forward convention. No renderer or timer dependencies.
export const vehicleMass = (type) =>
  ({ car: 1250, rickshaw: 520, scooter: 230, bus: 6500 })[type] ?? 1250;
const dot = (a, b) => a.x * b.x + a.z * b.z;
const axes = (b) => [
  { x: Math.cos(b.heading), z: -Math.sin(b.heading) },
  { x: Math.sin(b.heading), z: Math.cos(b.heading) },
];
const radius = (b, n) => {
  const [right, forward] = axes(b);
  return (
    Math.abs(dot(right, n)) * b.halfWidth +
    Math.abs(dot(forward, n)) * b.halfLength
  );
};
const torque = (r, n) => r.z * n.x - r.x * n.z;
export function vehicleContact(a, b) {
  if (Math.abs(a.y - b.y) > 1.6) return null;
  const delta = { x: b.x - a.x, z: b.z - a.z };
  if (
    Math.hypot(delta.x, delta.z) >
    Math.hypot(a.halfWidth, a.halfLength) +
      Math.hypot(b.halfWidth, b.halfLength)
  )
    return null;
  let depth = Infinity,
    normal;
  for (const axis of [...axes(a), ...axes(b)]) {
    const overlap =
      radius(a, axis) + radius(b, axis) - Math.abs(dot(delta, axis));
    if (overlap <= 0) return null;
    if (overlap < depth) {
      depth = overlap;
      const sign = dot(delta, axis) < 0 ? -1 : 1;
      normal = { x: axis.x * sign, z: axis.z * sign };
    }
  }
  const tangent = { x: -normal.z, z: normal.x };
  const along =
    (dot(a, normal) + radius(a, normal) + dot(b, normal) - radius(b, normal)) /
    2;
  const lo = Math.max(
    dot(a, tangent) - radius(a, tangent),
    dot(b, tangent) - radius(b, tangent),
  );
  const hi = Math.min(
    dot(a, tangent) + radius(a, tangent),
    dot(b, tangent) + radius(b, tangent),
  );
  const across = (lo + hi) / 2;
  return {
    depth,
    normal,
    x: normal.x * along + tangent.x * across,
    z: normal.z * along + tangent.z * across,
  };
}
export function resolveVehicleContact(a, b) {
  const hit = vehicleContact(a, b);
  if (!hit) return null;
  const n = hit.normal,
    ia = 1 / a.mass,
    ib = 1 / b.mass;
  const invInertia = (body) =>
    3 / (body.mass * (body.halfLength ** 2 + body.halfWidth ** 2));
  const aa = invInertia(a),
    bb = invInertia(b),
    ra = { x: hit.x - a.x, z: hit.z - a.z },
    rb = { x: hit.x - b.x, z: hit.z - b.z };
  const relative = () => ({
    x: b.vx + b.omega * rb.z - a.vx - a.omega * ra.z,
    z: b.vz - b.omega * rb.x - a.vz + a.omega * ra.x,
  });
  const apply = (axis, impulse) => {
    a.vx -= axis.x * impulse * ia;
    a.vz -= axis.z * impulse * ia;
    a.omega -= torque(ra, axis) * impulse * aa;
    b.vx += axis.x * impulse * ib;
    b.vz += axis.z * impulse * ib;
    b.omega += torque(rb, axis) * impulse * bb;
  };
  const closing = -dot(relative(), n);
  let impulse = 0;
  if (closing > 0) {
    const denominator =
      ia + ib + torque(ra, n) ** 2 * aa + torque(rb, n) ** 2 * bb;
    impulse = (closing * (closing > 1 ? 0.12 + 1 : 1)) / denominator;
    apply(n, impulse);
    const t = { x: -n.z, z: n.x },
      friction =
        -dot(relative(), t) /
        (ia + ib + torque(ra, t) ** 2 * aa + torque(rb, t) ** 2 * bb);
    apply(t, Math.max(-impulse * 0.38, Math.min(impulse * 0.38, friction)));
  }
  // Position correction is separate from velocity: parked contacts cannot add energy.
  const correction = ((hit.depth + 0.002) * 0.8) / (ia + ib);
  a.x -= n.x * correction * ia;
  a.z -= n.z * correction * ia;
  b.x += n.x * correction * ib;
  b.z += n.z * correction * ib;
  return { ...hit, closing: Math.max(0, closing), impulse };
}

export function clearImpact(v) {
  v.impactVX = 0;
  v.impactVZ = 0;
  v.impactYaw = 0;
  v.impactHold = 0;
}
export function integrateImpact(v, dt) {
  v.x += (v.impactVX || 0) * dt;
  v.z += (v.impactVZ || 0) * dt;
  v.heading += (v.impactYaw || 0) * dt;
  const slide = Math.exp(-2.4 * dt),
    spin = Math.exp(-3.2 * dt);
  v.impactVX = (v.impactVX || 0) * slide;
  v.impactVZ = (v.impactVZ || 0) * slide;
  v.impactYaw = (v.impactYaw || 0) * spin;
  v.impactHold = Math.max(0, (v.impactHold || 0) - dt);
}
