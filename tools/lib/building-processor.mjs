import { area, inside, round, nearest } from "./geometry.mjs";
export function landuseFromOSM(osm, report) {
  const land = osm.polygons
    .filter((p) => !p.tags.building)
    .map((p) => ({
      ...p,
      kind:
        p.tags.natural === "water" ||
        p.tags.water ||
        p.tags.landuse === "reservoir"
          ? "water"
          : p.tags.leisure === "park" ||
              p.tags.landuse === "forest" ||
              p.tags.natural === "wood"
            ? "park"
            : "land",
    }));
  report.landusePolygons = land.length;
  report.parks = land.filter((p) => p.kind === "park").length;
  report.waterPolygons = land.filter((p) => p.kind === "water").length;
  return land;
}
export function buildingsFromOSM(osm, graph, land, elevation, config, report) {
  const buildings = [];
  report.buildingsExplicitHeight = 0;
  report.buildingsInferredHeight = 0;
  report.buildingsOmittedForOverlap = 0;
  for (const p of osm.polygons.filter(
    (p) => p.tags.building && p.tags.building !== "no",
  )) {
    const b = p.bounds,
      x = (b[0] + b[2]) / 2,
      z = (b[1] + b[3]) / 2,
      candidates = [
        ...graph.grid.query(
          x,
          z,
          Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 15,
        ),
      ],
      t = p.tags;
    if (
      land.some(
        (l) =>
          l.kind === "water" &&
          inside([x, z], l.outer) &&
          !l.holes.some((h) => inside([x, z], h)),
      ) ||
      candidates.some((r) => {
        const n = nearest([x, z], r.p, r.q);
        return (
          (inside([n.x, n.z], p.outer) &&
            !p.holes.some((h) => inside([n.x, n.z], h))) ||
          p.outer.some((v) => nearest(v, r.p, r.q).d < r.width / 2 + 0.5)
        );
      })
    ) {
      report.buildingsOmittedForOverlap++;
      continue;
    }
    const explicit = parseFloat(t.height),
      levels = parseFloat(t["building:levels"]);
    const hash = String(p.id)
      .split("")
      .reduce(
        (a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0,
        config.seed,
      );
    const type = t.building,
      style =
        type === "warehouse" || type === "industrial"
          ? "warehouse"
          : type === "school" || t.amenity
            ? "institution"
            : type === "parking"
              ? "parking"
              : type === "commercial" || type === "office"
                ? "office"
                : type === "retail"
                  ? "shops"
                  : p.area > 800
                    ? "tower"
                    : p.area > 220
                      ? "apartments"
                      : "home";
    const fallback =
      style === "tower"
        ? 6 + (hash % 7)
        : style === "apartments"
          ? 3 + (hash % 4)
          : style === "warehouse"
            ? 2
            : 1 + (hash % 3);
    const height = round(
      Math.max(
        2.8,
        Math.min(
          85,
          explicit ||
            levels * config.floorHeight ||
            fallback * config.floorHeight,
        ),
      ),
    );
    if (explicit > 0) report.buildingsExplicitHeight++;
    else report.buildingsInferredHeight++;
    const y = Math.min(...p.outer.map((v) => elevation.height(...v))) - 0.3;
    buildings.push({
      ...p,
      height,
      style,
      y,
      variant: hash % 4,
      heightRule: explicit
        ? "height"
        : levels
          ? "levels"
          : "deterministic-type-area",
      roof: t["roof:shape"] || "flat",
    });
  }
  report.buildingsImported = buildings.length;
  return buildings;
}
