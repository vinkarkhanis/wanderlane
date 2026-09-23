export const round = (n) => Math.round(n * 100) / 100;
export const area = (r) =>
  Math.abs(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2,
  );
export function bbox(r) {
  return [
    Math.min(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[1])),
  ];
}
export function inside(p, r) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
export function nearest(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1),
      ),
    );
  const x = a[0] + dx * t,
    z = a[1] + dz * t;
  return { x, z, t, d: Math.hypot(p[0] - x, p[1] - z) };
}
export function clipRing(r, b) {
  for (let side = 0; side < 4; side++) {
    const axis = side % 2,
      value = b[side],
      low = side < 2,
      out = [];
    if (!r.length) return r;
    let a = r.at(-1),
      ai = low ? a[axis] >= value : a[axis] <= value;
    for (const p of r) {
      const pi = low ? p[axis] >= value : p[axis] <= value;
      if (ai !== pi) {
        const t = (value - a[axis]) / (p[axis] - a[axis]);
        out.push([a[0] + (p[0] - a[0]) * t, a[1] + (p[1] - a[1]) * t]);
      }
      if (pi) out.push(p);
      a = p;
      ai = pi;
    }
    r = out;
  }
  return r;
}
export class Grid {
  constructor(size = 64) {
    this.size = size;
    this.cells = new Map();
  }
  insert(item, b) {
    for (
      let x = Math.floor(b[0] / this.size);
      x <= Math.floor(b[2] / this.size);
      x++
    )
      for (
        let z = Math.floor(b[1] / this.size);
        z <= Math.floor(b[3] / this.size);
        z++
      ) {
        const k = x + "," + z;
        if (!this.cells.has(k)) this.cells.set(k, []);
        this.cells.get(k).push(item);
      }
  }
  query(x, z, r = 0) {
    const set = new Set();
    for (
      let i = Math.floor((x - r) / this.size);
      i <= Math.floor((x + r) / this.size);
      i++
    )
      for (
        let j = Math.floor((z - r) / this.size);
        j <= Math.floor((z + r) / this.size);
        j++
      )
        for (const a of this.cells.get(i + "," + j) || []) set.add(a);
    return set;
  }
}
