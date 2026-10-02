import { PUNE_FORK } from "./puneJourney.js";

export class CityJourneyMap {
  constructor() {
    this.panel = document.getElementById("journeyMap");
    this.canvas = document.getElementById("journeyMapCanvas");
    this.ctx = this.canvas.getContext("2d");
  }
  update(path, v, trip, visible) {
    this.panel.hidden = !visible;
    if (!visible) return;
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
    const other =
      path.journeyChoice === "detour"
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
    document.getElementById("journeyMapLabel").textContent =
      trip?.status === "completed"
        ? "Parked · take a moment"
        : path.journeyChoice === "detour"
          ? "Wakeshwar Road detour"
          : "Main route";
  }
}
