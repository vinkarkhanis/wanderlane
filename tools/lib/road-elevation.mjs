import { round } from "./geometry.mjs";
// Shared-node bridge deck heights; ramps propagate along the connected graph.
// Ground roads crossing at a different OSM node/layer remain at ground level.
export function applyRoadElevation(graph, elevation, report) {
  const lift = new Map(),
    adj = new Map(),
    queue = [];
  for (const r of graph.roads) {
    for (const [a, b] of [
      [r.a, r.b],
      [r.b, r.a],
    ]) {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push([b, r.length]);
    }
    if (r.tags.bridge && r.tags.bridge !== "no") {
      const h = Math.max(3.5, Math.min(14, (parseInt(r.tags.layer) || 1) * 5));
      for (const id of [r.a, r.b])
        if (h > (lift.get(id) || 0)) {
          lift.set(id, h);
          queue.push([id, h]);
        }
    }
  }
  while (queue.length) {
    const [id, h] = queue.shift();
    for (const [next, l] of adj.get(id) || []) {
      const nh = h - l * 0.045;
      if (nh > 0.02 && nh > (lift.get(next) || 0)) {
        lift.set(next, nh);
        queue.push([next, nh]);
      }
    }
  }
  for (const r of graph.roads) {
    r.y0 = round(elevation.height(...r.p) + (lift.get(r.a) || 0));
    r.y1 = round(elevation.height(...r.q) + (lift.get(r.b) || 0));
    r.elevated = !!(lift.get(r.a) || lift.get(r.b));
  }
  report.elevatedRoadSegments = graph.roads.filter((r) => r.elevated).length;
  report.bridgeTreatment =
    "Simplified shared-node decks, source layer * 5 m (3.5–14 m), connected approach ramps at 4.5% added slope; manual review required.";
}
