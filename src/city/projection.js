const R = 6371008.8,
  D = Math.PI / 180;
// Local equirectangular/tangent approximation, adequate for this 4 km pilot.
// +X east, +Z south: north-up world preserves Three.js handedness and left lanes.
export function project(lat, lon, origin) {
  return [
    (lon - origin.lon) * D * R * Math.cos(origin.lat * D),
    -(lat - origin.lat) * D * R,
  ];
}
export function unproject(x, z, origin) {
  return {
    lat: origin.lat - z / (D * R),
    lon: origin.lon + x / (D * R * Math.cos(origin.lat * D)),
  };
}
