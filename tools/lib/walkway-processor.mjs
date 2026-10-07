export function walkwaysFromOSM(osm) {
  const paths = [];
  for (const way of osm.ways.values()) {
    const t = way.tags || {};
    if (
      !["footway", "pedestrian", "path", "steps", "cycleway"].includes(
        t.highway,
      ) ||
      t.area === "yes" ||
      ["private", "no"].includes(t.access)
    )
      continue;
    for (let i = 1; i < way.nodes.length; i++) {
      const p = osm.nodes.get(way.nodes[i - 1])?.p,
        q = osm.nodes.get(way.nodes[i])?.p;
      if (!p || !q) continue;
      if (
        p.some((n, j) => n < osm.bounds[j] || n > osm.bounds[j + 2]) ||
        q.some((n, j) => n < osm.bounds[j] || n > osm.bounds[j + 2])
      )
        continue;
      paths.push({
        id: `${way.id}/${i}`,
        p,
        q,
        width: Math.max(
          0.8,
          Math.min(
            4,
            parseFloat(t.width) || (t.highway === "pedestrian" ? 3 : 1.5),
          ),
        ),
        kind: t.highway,
        tags: t,
      });
    }
  }
  return paths;
}
