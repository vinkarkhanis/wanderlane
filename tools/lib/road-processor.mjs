import { nearest, Grid, round } from "./geometry.mjs";
export function roadsFromOSM(osm, config, report) {
  const roads = [],
    nodePoints = {},
    adj = {};
  const inBounds = (p) =>
    p &&
    p[0] >= osm.bounds[0] &&
    p[0] <= osm.bounds[2] &&
    p[1] >= osm.bounds[1] &&
    p[1] <= osm.bounds[3];
  for (const w of osm.ways.values()) {
    const t = w.tags || {},
      type = t.highway?.replace("_link", "");
    if (!(type in config.widths)) continue;
    if (
      ["no", "private"].includes(t.motor_vehicle || t.vehicle || t.access) ||
      ["parking_aisle", "driveway", "emergency_access"].includes(t.service)
    ) {
      report.excludedRoadWays++;
      continue;
    }
    const width = Math.max(
      3,
      Math.min(
        24,
        parseFloat(t.width) || parseFloat(t.lanes) * 3 || config.widths[type],
      ),
    );
    const one =
      t.oneway === "-1"
        ? -1
        : ["yes", "1", "true"].includes(t.oneway) ||
            (t.junction === "roundabout" && t.oneway !== "no")
          ? 1
          : 0;
    for (let i = 1; i < w.nodes.length; i++) {
      const a = osm.nodes.get(w.nodes[i - 1]),
        b = osm.nodes.get(w.nodes[i]);
      if (!inBounds(a?.p) || !inBounds(b?.p)) continue;
      const length = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
      if (length < 0.1) continue;
      const road = {
        id: roads.length,
        way: w.id,
        a: a.id,
        b: b.id,
        p: a.p,
        q: b.p,
        length: round(length),
        width: round(width),
        oneway: one,
        type,
        tags: t,
      };
      roads.push(road);
      nodePoints[a.id] = a.p;
      nodePoints[b.id] = b.p;
      adj[a.id] ??= [];
      adj[b.id] ??= [];
      if (one !== -1)
        adj[a.id].push({ to: b.id, road: road.id, dir: 1, cost: length });
      if (one !== 1)
        adj[b.id].push({ to: a.id, road: road.id, dir: -1, cost: length });
      report.roadLengthByClass[type] =
        (report.roadLengthByClass[type] || 0) + length;
    }
  }
  const grid = new Grid();
  for (const r of roads)
    grid.insert(r, [
      Math.min(r.p[0], r.q[0]) - r.width,
      Math.min(r.p[1], r.q[1]) - r.width,
      Math.max(r.p[0], r.q[0]) + r.width,
      Math.max(r.p[1], r.q[1]) + r.width,
    ]);
  const closest = (x, z) => {
    let best = { d: Infinity };
    for (const r of grid.query(x, z, 80)) {
      const n = nearest([x, z], r.p, r.q);
      if (n.d < best.d) best = { ...n, road: r };
    }
    return best;
  };
  const seen = new Set(),
    components = [];
  const undirected = {};
  for (const r of roads) {
    (undirected[r.a] ??= []).push(r.b);
    (undirected[r.b] ??= []).push(r.a);
  }
  for (const id of Object.keys(nodePoints)) {
    if (seen.has(+id)) continue;
    const stack = [+id],
      component = [];
    seen.add(+id);
    while (stack.length) {
      const n = stack.pop();
      component.push(n);
      for (const q of undirected[n] || [])
        if (!seen.has(q)) {
          seen.add(q);
          stack.push(q);
        }
    }
    components.push(component);
  }
  components.sort((a, b) => b.length - a.length);
  const main = new Set(components[0]);
  report.disconnectedDriveableSegments = roads.filter(
    (r) => !main.has(r.a),
  ).length;
  report.connectedComponents = components.length;
  report.roadSegments = roads.length;
  report.bridges = roads.filter(
    (r) => r.tags.bridge && r.tags.bridge !== "no",
  ).length;
  report.tunnels = roads.filter(
    (r) => r.tags.tunnel && r.tags.tunnel !== "no",
  ).length;
  for (const k of Object.keys(report.roadLengthByClass))
    report.roadLengthByClass[k] = round(report.roadLengthByClass[k]);
  return { roads, nodePoints, adj, closest, main, grid };
}
