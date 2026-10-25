// pgfcirctripoles.tex: pgfcircdeclaretubegeneric and its four standard grids.
// Coordinates are local canvas units; rendering and named anchors share them.
export const TUBE_DEFAULTS = {
  "tube radius": .4,
  "anode distance": .4,
  "anode width": .4,
  "grid protrusion": .25,
  "grid dashes": 5,
  "grid separation": .2,
  "grid shift": 0,
  "cathode distance": .4,
  "cathode width": .4,
  "cathode corners": .06,
  "cathode right extend": .075,
  "filament distance": .1,
  "filament angle": 15
};

const KAPPA = .55228475;

export function tubeGeometry(size, kind = "triode", options = {}) {
  const s = { ...TUBE_DEFAULTS, ...options };
  const hw = size.width / 2, hh = size.height / 2;
  const rx = 2 * hw * s["tube radius"], ry = 2 * hh * s["tube radius"];
  const outline = tubeOutline(rx, ry);
  const separation = s["grid separation"], shift = s["grid shift"];
  const levels = kind === "pentode" ? [-separation, 0, separation] :
    kind === "tetrode" ? [-separation / 2, separation / 2] : kind === "triode" ? [0] : [];
  const grids = levels.map(y => (y + shift) * hh);
  const electrodes = [];
  const line = (x1, y1, x2, y2) => electrodes.push(["M", x1, y1], ["L", x2, y2]);
  const left = -(s["tube radius"] + s["grid protrusion"]) * hw;
  const count = Math.max(1, Math.trunc(s["grid dashes"]));
  // The native grid continues toward 2*radius*halfWidth, not anode width.
  const step = (2 * hw * s["tube radius"] - left) / (2 * count + 1);
  for (const y of grids) {
    line(-hw, y, left, y);
    for (let i = 0; i < count; i++) line(left + (2 * i + 1) * step, y, left + (2 * i + 2) * step, y);
  }
  const cathodeX = s["cathode width"] * hw;
  const cathodeY = -s["cathode distance"] * hh;
  const angle = s["filament angle"] * Math.PI / 180;
  const filamentX = s["tube radius"] * Math.sin(angle) * hw;
  const filamentY = -(s["cathode distance"] + s["filament distance"]) * hh;
  if (s.filament) {
    const bendY = -s["tube radius"] * (1 + Math.cos(angle)) * hh;
    for (const x of [-filamentX, filamentX]) electrodes.push(["M", 0, filamentY], ["L", x, bendY], ["L", x, -hh]);
  }
  const anodeY = s["anode distance"] * hh;
  line(0, hh, 0, anodeY);
  line(-s["anode width"] * hw, anodeY, s["anode width"] * hw, anodeY);
  if (!s.nocathode) {
    const endY = s.fullcathode ? -hh : cathodeY - s["cathode right extend"] * hh;
    const r = Math.max(0, Math.min(s["cathode corners"] * hh, Math.abs(cathodeX),
      Math.abs(hh + cathodeY), Math.abs(cathodeY - endY)));
    // PGF's rounded-corner operation uses two cubic quarter circles.
    electrodes.push(["M", -cathodeX, -hh], ["L", -cathodeX, cathodeY - r],
      ["C", -cathodeX, cathodeY - r + KAPPA * r, -cathodeX + r - KAPPA * r, cathodeY, -cathodeX + r, cathodeY],
      ["L", cathodeX - r, cathodeY],
      ["C", cathodeX - r + KAPPA * r, cathodeY, cathodeX, cathodeY - r + KAPPA * r, cathodeX, cathodeY - r],
      ["L", cathodeX, endY]);
  }
  const anchors = {
    center: [0, 0], anode: [0, hh], plate: [0, hh],
    cathode: [-cathodeX, -hh], "cathode 1": [-cathodeX, -hh], "cathode 2": [cathodeX, -hh],
    "filament 1": [-filamentX, -hh], "filament 2": [filamentX, -hh], "filament center": [0, filamentY],
    "tube top": [0, ry], "tube bottom": [0, -ry], "tube left": [-rx, 0], "tube right": [rx, 0],
    "tube ne": [rx, ry]
  };
  if (grids.length) anchors.grid = anchors.control = [-hw, grids[0]];
  if (grids.length > 1) anchors.screen = [-hw, grids[1]];
  if (grids.length > 2) anchors.suppressor = [-hw, grids[2]];
  const sx = rx > ry ? rx - ry : rx, sy = rx > ry ? ry : ry - rx;
  Object.assign(anchors, {
    "tubesq ne": [sx, sy], "tube top right": [sx, sy], "tube top left": [-sx, sy],
    "tube bottom right": [sx, -sy], "tube bottom left": [-sx, -sy],
    "tube top center": [0, sy], "tube bottom center": [0, -sy],
    "tube right center": [sx, 0], "tube left center": [-sx, 0]
  });
  for (const [name, value] of Object.entries({n: [0, hh], s: [0, -hh], e: [hw, 0], w: [-hw, 0],
    ne: [hw, hh], nw: [-hw, hh], se: [hw, -hh], sw: [-hw, -hh]})) {
    anchors[name] = value;
    anchors[{n: "north", s: "south", e: "east", w: "west", ne: "north east", nw: "north west", se: "south east", sw: "south west"}[name]] = value;
  }
  const points = [...outline.full, ...electrodes].flatMap(command => {
    const values = command.slice(1);
    return Array.from({length: values.length / 2}, (_, i) => [values[2 * i], values[2 * i + 1]]);
  });
  return { outline, electrodes, anchors: Object.fromEntries(Object.entries(anchors).map(([k, [x, y]]) => [k, {x, y}])),
    bounds: {minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
      minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1]))} };
}

function tubeOutline(rx, ry) {
  const k = KAPPA;
  let parts;
  if (rx > ry) {
    const d = rx - ry;
    parts = [
      [["M", -rx, 0], ["C", -rx, k * ry, -d - k * ry, ry, -d, ry]],
      [["M", -d, ry], ["L", d, ry]],
      [["M", d, ry], ["C", d + k * ry, ry, rx, k * ry, rx, 0]],
      [["M", rx, 0], ["C", rx, -k * ry, d + k * ry, -ry, d, -ry]],
      [["M", d, -ry], ["L", -d, -ry]],
      [["M", -d, -ry], ["C", -d - k * ry, -ry, -rx, -k * ry, -rx, 0]]
    ];
  } else {
    const d = ry - rx;
    parts = [
      [["M", 0, ry], ["C", k * rx, ry, rx, d + k * rx, rx, d]],
      [["M", rx, d], ["L", rx, -d]],
      [["M", rx, -d], ["C", rx, -d - k * rx, k * rx, -ry, 0, -ry]],
      [["M", 0, -ry], ["C", -k * rx, -ry, -rx, -d - k * rx, -rx, -d]],
      [["M", -rx, -d], ["L", -rx, d]],
      [["M", -rx, d], ["C", -rx, d + k * rx, -k * rx, ry, 0, ry]]
    ];
  }
  return {parts, full: [...parts.flatMap((part, i) => i ? part.slice(1) : part), ["Z"]]};
}
