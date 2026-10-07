import { PUNE_FORK } from "./puneJourney.js";
import { cityDistrict, nearbyCityPlaces } from "./endlessCityPlaces.js";

export class CityJourneyMap {
  constructor() {
    this.panel = document.getElementById("journeyMap");
    this.canvas = document.getElementById("journeyMapCanvas");
    this.ctx = this.canvas.getContext("2d");
  }
  update(path, v, trip, visible) {
    this.panel.hidden = !visible;
    if (!visible) return;
    if (path.urban) return this.updateEndlessCity(path, v);
    const c = this.ctx,
      scale = 0.65,
      cx = 100,
      cy = 80;
    const point = (p) => [cx + (p[0] - v.x) * scale, cy + (p[1] - v.z) * scale];
    c.clearRect(0, 0, 200, 160);
    c.fillStyle = "#183235";
    c.fillRect(0, 0, 200, 160);
    const draw = (r, color, width) => {
      const a = point(r.p),
        b = point(r.q);
      c.strokeStyle = color;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(...a);
      c.lineTo(...b);
      c.stroke();
    };
    for (const r of path.grid.query(v.x, v.z, 180))
      draw(r, "#526968", Math.max(1.4, r.width * scale * 0.45));
    for (const r of path.routeGrid.query(v.x, v.z, 180)) draw(r, "#dec596", 3);
    c.setLineDash([3, 4]);
    const other = path.nav.exploration
      ? []
      : path.journeyChoice === "detour"
        ? path.nav.originalRoute.edges
            .slice(PUNE_FORK.from, PUNE_FORK.to)
            .map((e) => e.road)
        : PUNE_FORK.roads;
    for (const id of other) draw(path.roads[id], "#8aaca0", 2);
    c.setLineDash([]);
    if (trip?.arrival) {
      const [x, y] = point([trip.arrival.x, trip.arrival.z]);
      c.fillStyle = "#f4d395";
      c.fillRect(x - 5, y - 5, 10, 10);
      c.fillStyle = "#173337";
      c.font = "bold 9px Arial";
      c.textAlign = "center";
      c.fillText("P", x, y + 3);
    }
    c.save();
    c.translate(cx, cy);
    c.rotate(-v.heading);
    c.fillStyle = "#f6f3dc";
    c.beginPath();
    c.moveTo(0, 9);
    c.lineTo(-5, -6);
    c.lineTo(0, -3);
    c.lineTo(5, -6);
    c.closePath();
    c.fill();
    c.restore();
    c.fillStyle = "#afc5ba";
    c.font = "10px Arial";
    c.textAlign = "left";
    c.fillText("N ↑", 9, 14);
    document.getElementById("journeyMapLabel").textContent = path.nav
      .exploration
      ? path.nav.route.name
      : trip?.status === "completed"
        ? "Parked · take a moment"
        : path.journeyChoice === "detour"
          ? "Wakeshwar Road detour"
          : "Main route";
  }
  updateEndlessCity(path, v) {
    const c = this.ctx,
      scale = 0.13;
    const point = (x, z) => [100 + (x - v.x) * scale, 85 + (z - v.z) * scale];
    c.clearRect(0, 0, 200, 160);
    c.fillStyle = "#183235";
    c.fillRect(0, 0, 200, 160);
    c.strokeStyle = "#dec596";
    c.lineWidth = 4;
    c.beginPath();
    for (let s = v.near.distance - 650; s <= v.near.distance + 650; s += 10) {
      const p = path.sampleAtDistance(s);
      const q = point(p.x, p.z);
      if (s === v.near.distance - 650) c.moveTo(...q);
      else c.lineTo(...q);
    }
    c.stroke();
    c.font = "bold 9px Arial";
    c.textAlign = "center";
    for (const p of nearbyCityPlaces(path, v.near.distance, 620)) {
      const [x, z] = point(p.x, p.z);
      if (z < 24 || z > 137) continue;
      c.fillStyle =
        p.kind === "lake"
          ? "#72bed0"
          : p.kind === "hills" || p.kind === "park"
            ? "#96c18a"
            : "#f2ce88";
      c.beginPath();
      c.arc(x, z, p.kind === "lake" ? 8 : 4, 0, Math.PI * 2);
      c.fill();
      const label = p.short;
      const lx = Math.max(
        c.measureText(label).width / 2 + 4,
        Math.min(196 - c.measureText(label).width / 2, x),
      );
      c.fillText(label, lx, z - 10);
    }
    c.fillStyle = "#f6f3dc";
    c.beginPath();
    c.arc(100, 85, 3, 0, Math.PI * 2);
    c.fill();
    c.textAlign = "left";
    c.fillStyle = "#afc5ba";
    c.fillText("N ↑  · endless city", 9, 14);
    document.getElementById("journeyMapLabel").textContent = cityDistrict(
      v.near.distance,
    ).name;
  }
}
