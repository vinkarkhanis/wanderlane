import { readFile } from "node:fs/promises";
import { round } from "./geometry.mjs";
export async function elevationSource(file, origin) {
  if (!file)
    return {
      metadata: {
        kind: "procedural-fallback",
        label: "Synthetic terrain — not surveyed Pune elevation",
        source: "Original mathematical hills; no DEM downloaded",
        licence: "CC0-1.0",
        verticalDatum: "arbitrary metres",
        baseElevation: 0,
      },
      height: (x, z) =>
        round(
          5 * Math.sin(x / 700) * Math.cos(z / 850) +
            22 * Math.exp(-((x + 250) ** 2 + (z - 240) ** 2) / 180000),
        ),
    };
  const d = JSON.parse(await readFile(file, "utf8"));
  if (
    !d.source ||
    !d.licence ||
    !d.retrievedAt ||
    !d.commercialReuseConfirmed ||
    !d.origin ||
    Math.abs(d.origin.lat - origin.lat) > 1e-8 ||
    Math.abs(d.origin.lon - origin.lon) > 1e-8
  )
    throw Error(
      "DEM must document source, licence, retrieval date, commercialReuseConfirmed and matching origin",
    );
  if (
    !Number.isInteger(d.cols) ||
    !Number.isInteger(d.rows) ||
    d.cols < 2 ||
    d.rows < 2 ||
    !(d.cellSize > 0) ||
    !Number.isFinite(d.x0) ||
    !Number.isFinite(d.z0) ||
    !Number.isFinite(d.baseElevation) ||
    d.values?.length !== d.rows * d.cols ||
    !d.values.every(Number.isFinite)
  )
    throw Error("Invalid DEM metric grid or nodata values");
  return {
    metadata: {
      ...d,
      values: undefined,
      kind: "user-supplied-dem",
      label: "User-supplied elevation: " + d.source,
    },
    height: (x, z) => {
      const gx = (x - d.x0) / d.cellSize,
        gz = (z - d.z0) / d.cellSize;
      if (gx < 0 || gz < 0 || gx > d.cols - 1 || gz > d.rows - 1)
        throw Error("DEM does not cover import bounds");
      const i = Math.min(d.cols - 2, Math.floor(gx)),
        j = Math.min(d.rows - 2, Math.floor(gz)),
        a = gx - i,
        b = gz - j,
        v = d.values,
        k = j * d.cols + i;
      return round(
        v[k] * (1 - a) * (1 - b) +
          v[k + 1] * a * (1 - b) +
          v[k + d.cols] * (1 - a) * b +
          v[k + d.cols + 1] * a * b -
          d.baseElevation,
      );
    },
  };
}
