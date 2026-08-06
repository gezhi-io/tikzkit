export const tikzLibrary = {
  "name": "3d",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/3d.js:canvasPlaneSpec + src/engine/evaluate.js:canvasPlaneEnvironment",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrary3d.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-3d.tex",
  "localSourceReviewed": true,
  "features": [
    "plane origin / plane x / plane y",
    "canvas is plane",
    "canvas is xy/yx plane at z",
    "canvas is xz/zx plane at y",
    "canvas is yz/zy plane at x"
  ],
  "implements": [
    "plane origin / plane x / plane y",
    "canvas is plane",
    "canvas is xy/yx plane at z",
    "canvas is xz/zx plane at y",
    "canvas is yz/zy plane at x"
  ],
  "notes": "Maps local two-dimensional canvas coordinates onto a projected 3D origin and pair of plane vectors. xyz cylindrical/spherical coordinate systems and exact transform-order parity with arbitrary same-scope affine options remain partial."
};

const SHORTCUTS = [
  {
    key: "canvas is xy plane at z",
    coordinates: (value) => ({ origin: [0, 0, value], x: [1, 0, value], y: [0, 1, value] })
  },
  {
    key: "canvas is yx plane at z",
    coordinates: (value) => ({ origin: [0, 0, value], x: [0, 1, value], y: [1, 0, value] })
  },
  {
    key: "canvas is xz plane at y",
    coordinates: (value) => ({ origin: [0, value, 0], x: [1, value, 0], y: [0, value, 1] })
  },
  {
    key: "canvas is zx plane at y",
    coordinates: (value) => ({ origin: [0, value, 0], x: [0, value, 1], y: [1, value, 0] })
  },
  {
    key: "canvas is yz plane at x",
    coordinates: (value) => ({ origin: [value, 0, 0], x: [value, 1, 0], y: [value, 0, 1] })
  },
  {
    key: "canvas is zy plane at x",
    coordinates: (value) => ({ origin: [value, 0, 0], x: [value, 0, 1], y: [value, 1, 0] })
  }
];

// Mirrors tikzlibrary3d.code.tex: a shorthand first defines three projected
// 3D points, then `canvas is plane` consumes their origin and two vectors.
export function canvasPlaneSpec(options = {}) {
  for (const shortcut of SHORTCUTS) {
    if (!Object.hasOwn(options, shortcut.key)) continue;
    const value = planeCoordinateValue(options[shortcut.key]);
    return coordinateTripletSpec(shortcut.coordinates(value));
  }

  if (!Object.hasOwn(options, "canvas is plane")) return null;
  return {
    origin: String(options["plane origin"] ?? "(0,0)").trim(),
    x: String(options["plane x"] ?? "(1,0)").trim(),
    y: String(options["plane y"] ?? "(0,1)").trim()
  };
}

function coordinateTripletSpec(points) {
  return {
    origin: coordinateFromTriplet(points.origin),
    x: coordinateFromTriplet(points.x),
    y: coordinateFromTriplet(points.y)
  };
}

function coordinateFromTriplet(values) {
  return `(${values.map((value) => String(value)).join(",")})`;
}

function planeCoordinateValue(value) {
  if (value === true || value === false || value === undefined || value === null || value === "") return "0";
  return String(value).trim();
}
