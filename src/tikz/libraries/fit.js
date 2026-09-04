export const tikzLibrary = {
  name: "fit",
  status: "builtin",
  implementedBy: "src/tikz/libraries/fit.js:fitOrientedBounds + src/engine/evaluate.js:resolveFitNodeLayout/fitReferencePoints",
  localSourceReviewed: "yes",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryfit.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-fit.tex",
  notes: "Reviewed locally on 2026-09-04: fit scans west/east/north/south for bare node references, treats explicit node anchors as single points, computes rotate fit bounds in the inverse-rotated frame, rotates the center back, and sets the resulting node rotation. Option order matches PGF's immediate key execution. Independent inner separation, minimum dimensions, and ellipse/circle expansion are preserved. Three-way artifacts: outputs/qa-fit-rotate-2026-09-04-after/. Arbitrary nonuniform affine fit transforms remain partial.",
  features: [
    "fit bounds from bare-node compass anchors and explicit coordinate anchors",
    "rotate fit oriented bounds and rotated result anchors",
    "minimum width, height, and size",
    "rectangle, ellipse, and circle fit shapes"
  ],
  implements: [
    "fit bounds from bare-node compass anchors and explicit coordinate anchors",
    "rotate fit oriented bounds and rotated result anchors",
    "minimum width, height, and size",
    "rectangle, ellipse, and circle fit shapes"
  ]
};

export function fitOrientedBounds(points = [], angle = 0) {
  const finitePoints = points.filter((point) =>
    Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))
  );
  if (!finitePoints.length) return null;

  const rotation = Number.isFinite(Number(angle)) ? Number(angle) : 0;
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of finitePoints) {
    const x = Number(point.x);
    const y = Number(point.y);
    const frameX = x * cos + y * sin;
    const frameY = -x * sin + y * cos;
    minX = Math.min(minX, frameX);
    maxX = Math.max(maxX, frameX);
    minY = Math.min(minY, frameY);
    maxY = Math.max(maxY, frameY);
  }

  const frameCenterX = (minX + maxX) / 2;
  const frameCenterY = (minY + maxY) / 2;
  return {
    point: {
      x: frameCenterX * cos - frameCenterY * sin,
      y: frameCenterX * sin + frameCenterY * cos
    },
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    rotation,
    frameBounds: { minX, maxX, minY, maxY }
  };
}
