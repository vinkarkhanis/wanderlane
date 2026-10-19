// Decorative paint only. OSM centre lines, widths and vehicle lanes stay authoritative.
export function roadPaint(r, junctions) {
  const marks = [],
    len = r.length;
  if (
    r.width < 5.5 ||
    !["primary", "secondary", "tertiary", "trunk"].includes(r.type)
  )
    return marks;
  const start = junctions.has(r.a) ? Math.max(5, r.width * 0.65) : 0.1;
  const end = len - (junctions.has(r.b) ? Math.max(5, r.width * 0.65) : 0.1);
  if (end <= start) return marks;
  for (const side of [-1, 1])
    marks.push({
      kind: "edge",
      d: (start + end) / 2,
      offset: side * (r.width / 2 - 0.3),
      width: 0.11,
      length: end - start,
    });
  // Divided carriageways need lane dividers rather than a two-way centre line.
  if (r.oneway) {
    const lanes = Math.max(
      1,
      Math.min(3, parseInt(r.tags.lanes) || Math.floor(r.width / 3)),
    );
    for (let lane = 1; lane < lanes; lane++)
      for (let d = start + 1; d + 2.6 < end; d += 8)
        marks.push({
          kind: "lane",
          d: d + 1.3,
          offset: -r.width / 2 + (lane * r.width) / lanes,
          width: 0.13,
          length: 2.6,
        });
  }
  if (!r.elevated && len > 28) {
    for (const atStart of [true, false]) {
      if (!junctions.has(atStart ? r.a : r.b)) continue;
      // Paint is kept on the approach, outside the junction's turning area.
      const d = atStart ? start + 2.5 : end - 2.5;
      if (d < 3 || d > len - 3) continue;
      const stop = atStart ? d + 2.6 : d - 2.6;
      // Only paint a stop line for traffic approaching this end.
      if (!r.oneway || (atStart ? r.oneway === -1 : r.oneway === 1))
        marks.push({
          kind: "stop",
          d: stop,
          offset: r.oneway ? 0 : atStart ? r.width / 4 : -r.width / 4,
          width: r.oneway ? r.width - 0.8 : r.width / 2 - 0.5,
          length: 0.3,
        });
      for (let x = -r.width / 2 + 0.6; x < r.width / 2 - 0.5; x += 1.05)
        marks.push({
          kind: "crossing",
          d,
          offset: x + 0.25,
          width: 0.5,
          length: 3.1,
        });
    }
  }
  return marks;
}

export function renderRoadPaint(r, marks, block, material) {
  const dx = (r.q[0] - r.p[0]) / r.length,
    dz = (r.q[1] - r.p[1]) / r.length;
  const yaw = Math.atan2(dx, dz);
  for (const m of marks) {
    const f = m.d / r.length;
    block(
      r.p[0] + dx * m.d - dz * m.offset,
      r.y0 + (r.y1 - r.y0) * f + 0.108,
      r.p[1] + dz * m.d + dx * m.offset,
      m.width,
      0.008,
      m.length,
      yaw,
      material,
    );
  }
}
