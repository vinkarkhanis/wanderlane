import { project } from "./projection.mjs";
import { bbox, area, inside, clipRing, round } from "./geometry.mjs";
export function parseOSM(raw, config, report) {
  if (!Array.isArray(raw.elements) || raw.remark)
    throw Error(
      "Invalid or incomplete Overpass extract: " +
        (raw.remark || "missing elements"),
    );
  const nodes = new Map(),
    ways = new Map(),
    relations = [],
    points = [];
  for (const e of raw.elements) {
    if (e.type === "node")
      nodes.set(e.id, {
        ...e,
        p: project(e.lat, e.lon, config.origin).map(round),
      });
    else if (e.type === "way") ways.set(e.id, e);
    else if (e.type === "relation") relations.push(e);
  }
  const bounds = [
    ...project(config.bounds.north, config.bounds.west, config.origin),
    ...project(config.bounds.south, config.bounds.east, config.origin),
  ];
  const polygons = [],
    consumed = new Set();
  const add = (id, t, rings) => {
    const outer = rings.filter((r) => r.role !== "inner"),
      holes = rings.filter((r) => r.role === "inner");
    for (let i = 0; i < outer.length; i++) {
      let ring = clipRing(outer[i].points, bounds);
      if (ring.length < 3 || area(ring) < 2) continue;
      const inner = holes
        .filter((h) => inside(h.points[0], outer[i].points))
        .map((h) => clipRing(h.points, bounds))
        .filter((r) => r.length >= 3);
      polygons.push({
        id: id + ":" + i,
        tags: t,
        outer: ring,
        holes: inner,
        bounds: bbox(ring),
        area: round(area(ring) - inner.reduce((a, r) => a + area(r), 0)),
      });
    }
  };
  const coords = (ids) => ids.map((id) => nodes.get(id)?.p).filter(Boolean);
  for (const rel of relations) {
    if (rel.tags?.type !== "multipolygon") continue;
    const pieces = [];
    for (const m of rel.members || [])
      if (m.type === "way") {
        const w = ways.get(m.ref);
        if (w)
          pieces.push({ ids: [...w.nodes], role: m.role || "outer", id: w.id });
        else
          report.malformed.push(
            "Missing relation member " + rel.id + "/" + m.ref,
          );
      }
    const rings = [];
    while (pieces.length) {
      const p = pieces.shift();
      let changed = true;
      while (p.ids[0] !== p.ids.at(-1) && changed) {
        changed = false;
        for (let i = 0; i < pieces.length; i++) {
          const q = pieces[i];
          if (q.role !== p.role) continue;
          if (q.ids[0] === p.ids.at(-1) || q.ids.at(-1) === p.ids.at(-1)) {
            if (q.ids.at(-1) === p.ids.at(-1)) q.ids.reverse();
            p.ids.push(...q.ids.slice(1));
            pieces.splice(i, 1);
            changed = true;
            break;
          }
        }
      }
      if (p.ids[0] === p.ids.at(-1)) {
        rings.push({ role: p.role, points: coords(p.ids.slice(0, -1)) });
      } else report.malformed.push("Unclosed multipolygon " + rel.id);
    }
    if (rings.length) {
      add("r" + rel.id, rel.tags, rings);
      for (const m of rel.members || [])
        if (m.type === "way") consumed.add(m.ref);
    }
  }
  for (const w of ways.values()) {
    if (consumed.has(w.id) || !w.tags || w.nodes[0] !== w.nodes.at(-1))
      continue;
    if (
      w.tags.building ||
      w.tags.landuse ||
      w.tags.natural ||
      w.tags.leisure ||
      w.tags.water
    )
      add("w" + w.id, w.tags, [
        { role: "outer", points: coords(w.nodes.slice(0, -1)) },
      ]);
  }
  for (const n of nodes.values())
    if (
      n.tags &&
      n.p[0] >= bounds[0] &&
      n.p[0] <= bounds[2] &&
      n.p[1] >= bounds[1] &&
      n.p[1] <= bounds[3]
    )
      points.push({ id: n.id, p: n.p, tags: n.tags });
  return { nodes, ways, relations, polygons, points, bounds };
}
