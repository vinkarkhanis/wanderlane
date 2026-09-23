import { project } from "./projection.mjs";
export function makeRoute(graph, osm, config, report) {
  const restrictions = osm.relations
    .filter((r) => r.tags?.type === "restriction")
    .map((r) => ({
      kind: r.tags.restriction,
      from: r.members.find((m) => m.role === "from")?.ref,
      to: r.members.find((m) => m.role === "to")?.ref,
      via: r.members.find((m) => m.role === "via" && m.type === "node")?.ref,
    }));
  report.turnRestrictions = restrictions.length;
  const restricted = (prev, edge, node) =>
    restrictions.some(
      (r) =>
        r.via === +node &&
        r.from === prev &&
        (r.kind?.startsWith("no_")
          ? r.to === edge.way
          : r.kind?.startsWith("only_")
            ? r.to !== edge.way
            : false),
    );
  // Directed shortest paths between selected district waypoints. Never synthesize links.
  const targetCoords = [
    [18.561, 73.783],
    [18.555, 73.801],
    [18.54, 73.794],
    [18.549, 73.782],
  ];
  const targets = targetCoords.map(([lat, lon]) => {
    const p = project(lat, lon, config.origin);
    let best = null,
      d = Infinity;
    for (const [id, q] of Object.entries(graph.nodePoints)) {
      if (
        !graph.main.has(+id) ||
        (graph.adj[id] || []).every(
          (e) => graph.roads[e.road].type === "service",
        )
      )
        continue;
      const n = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (n < d) {
        best = +id;
        d = n;
      }
    }
    return best;
  });
  const shortest = (start, end) => {
    const dist = new Map([[start + ":0", 0]]),
      previous = new Map(),
      todo = [{ key: start + ":0", node: start, way: 0, cost: 0 }];
    let found;
    while (todo.length) {
      todo.sort((a, b) => b.cost - a.cost);
      const cur = todo.pop();
      if (cur.cost !== dist.get(cur.key)) continue;
      if (cur.node === end) {
        found = cur.key;
        break;
      }
      for (const e of graph.adj[cur.node] || []) {
        const road = graph.roads[e.road];
        if (restricted(cur.way, road, cur.node)) continue;
        const incoming = cur.from ? graph.nodePoints[cur.from] : null;
        const at = graph.nodePoints[cur.node],
          to = graph.nodePoints[e.to];
        const turn = incoming
          ? Math.abs(
              Math.atan2(
                Math.sin(
                  Math.atan2(at[0] - incoming[0], at[1] - incoming[1]) -
                    Math.atan2(to[0] - at[0], to[1] - at[1]),
                ),
                Math.cos(
                  Math.atan2(at[0] - incoming[0], at[1] - incoming[1]) -
                    Math.atan2(to[0] - at[0], to[1] - at[1]),
                ),
              ),
            )
          : 0;
        if (turn > 2) continue;
        const key = e.to + ":" + e.road,
          cost =
            cur.cost +
            e.cost * (road.type === "service" ? 8 : 1) +
            Math.max(0, turn - 1.2) * 120;
        if (cost < (dist.get(key) ?? Infinity)) {
          dist.set(key, cost);
          previous.set(key, { prev: cur.key, edge: { ...e, from: cur.node } });
          todo.push({ key, node: e.to, way: road.way, cost, from: cur.node });
        }
      }
    }
    if (!found)
      throw Error(
        "No connected legal directed path between route waypoints " +
          start +
          " / " +
          end,
      );
    const result = [];
    while (previous.has(found)) {
      const p = previous.get(found);
      result.push(p.edge);
      found = p.prev;
    }
    return result.reverse();
  };
  const edges = [];
  for (let i = 0; i < targets.length; i++)
    edges.push(...shortest(targets[i], targets[(i + 1) % targets.length]));
  // Remove out-and-back waypoint spurs, including the circular seam. They are
  // connected but would require unsuitable residential U-turns.
  let changed = true;
  while (changed && edges.length > 2) {
    changed = false;
    for (let i = 0; i < edges.length; i++) {
      const j = (i + 1) % edges.length,
        a = edges[i],
        b = edges[j];
      if (a.from === b.to && a.to === b.from && a.road === b.road) {
        if (j === 0) {
          edges.pop();
          edges.shift();
        } else edges.splice(i, 2);
        changed = true;
        break;
      }
    }
  }
  const length = edges.reduce((s, e) => s + graph.roads[e.road].length, 0);
  if (length < 1500) throw Error("Route too short");
  return {
    id: "baner-pashan-explorer",
    name: "Baner–Pashan Explorer",
    closed: true,
    waypoints: targets,
    waypointCoordinates: targetCoords,
    edges: edges.map((e) => ({
      road: e.road,
      dir: e.dir,
      from: e.from,
      to: e.to,
    })),
    length: Math.round(length),
    selection:
      "Directed shortest paths through four documented district waypoints; source-node continuity, access and via-node turn restrictions checked.",
  };
}
