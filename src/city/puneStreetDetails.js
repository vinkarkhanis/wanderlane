import { nearest, inside } from "./spatial.js";
// Metre coordinates selected against ALL imported roads and owning chunk geometry.
// These are fictional roadside scenes, not claims of surveyed shops or bus stops.
export const STREET_SCENES = [
  {
    id: "evening-chai-crowd",
    s: 9750,
    x: -1115.612,
    z: -248.366,
    yaw: 2.3059193535,
    tile: "-5,-1",
    kind: "chai",
    district: "Baner",
    label: "Misal & Chai · मिसळ आणि चहा",
  },
  {
    id: "baner-shops",
    s: 10480,
    x: -1009.231,
    z: -896.271,
    yaw: 3.04903969,
    tile: "-4,-4",
    kind: "shops",
    district: "Baner",
    label: "Pancard Club Road · पॅनकार्ड क्लब रोड",
  },
  {
    id: "baner-stop",
    s: 300,
    x: -498.347,
    z: -906.322,
    yaw: 2.304878828,
    tile: "-2,-4",
    kind: "stop",
    district: "Baner",
    label: "Bus stop · बस थांबा",
  },
  {
    id: "shoulder-roadworks",
    s: 1810,
    x: 469.192,
    z: -393.373,
    yaw: 0.888186488,
    tile: "1,-2",
    kind: "works",
    district: "Baner Road",
    label: "Shoulder works · सावकाश",
  },
  {
    id: "junction-stop",
    s: 2760,
    x: 787.126,
    z: -309.567,
    yaw: -1.590285755,
    tile: "3,-2",
    kind: "stop",
    district: "Baner Road",
    label: "Baner Road · बाणेर रस्ता",
  },
  {
    id: "compound-garden",
    s: 3500,
    x: 779.141,
    z: 282.118,
    yaw: 0.055542029,
    tile: "3,1",
    kind: "garden",
    district: "Pashan approach",
    label: "Wada courtyard · वाडा अंगण",
  },
  {
    id: "park-ridge",
    s: 3980,
    x: 572.12,
    z: 662.194,
    yaw: -1.716151734,
    tile: "2,2",
    kind: "garden",
    district: "Pashan approach",
    label: "Phool & Bhaji · फुले आणि भाजी",
  },
  {
    id: "arrival-chai",
    s: 4870,
    x: 279.093,
    z: 1235.601,
    yaw: 0.547590323,
    tile: "1,4",
    kind: "chai",
    district: "Pashan approach",
    label: "Lake approach · चहा आणि निवांत वेळ",
  },
];
export const ACTOR_BUDGET = { Low: 1, Medium: 3, High: 4 };
export function safeStreetScene(p, data, path) {
  const radius = 7;
  return (
    p.tile === data.id &&
    p.x > data.x + radius &&
    p.x < data.x + data.size - radius &&
    p.z > data.z + radius &&
    p.z < data.z + data.size - radius &&
    !data.buildings.some(
      (b) =>
        p.x > b.bounds[0] - radius &&
        p.x < b.bounds[2] + radius &&
        p.z > b.bounds[1] - radius &&
        p.z < b.bounds[3] + radius,
    ) &&
    ![...path.grid.query(p.x, p.z, 20)].some(
      (r) => nearest([p.x, p.z], r.p, r.q).d < r.width / 2 + radius,
    ) &&
    !data.land.some(
      (l) =>
        l.kind === "water" &&
        (inside([p.x, p.z], l.outer) ||
          l.outer.some(
            (a, i) =>
              nearest([p.x, p.z], a, l.outer[(i + 1) % l.outer.length]).d <
              radius,
          )),
    )
  );
}
