const TRAPEZIUM_EPSILON = 1e-9;
const STAR_DEFAULT_POINT_RATIO = 1.5;
const STAR_DEFAULT_POINT_HEIGHT = 0.5;

export function starLayoutSize(contentWidth, contentHeight, options = {}) {
  const contentRadius = Math.max(0, Number(contentWidth) || 0, Number(contentHeight) || 0) / 2;
  const usesPointRatio = options.starUsesPointRatio !== false;
  const pointRatio = normalizedStarPointRatio(options.starPointRatio);
  const pointHeight = normalizedStarPointHeight(options.starPointHeight);
  const innerRadius = Math.SQRT2 * contentRadius;
  const sourceOuterRadius = usesPointRatio
    ? innerRadius * pointRatio
    : innerRadius + pointHeight;
  const minimumDiameter = Math.max(
    0,
    Number(options.minimumWidth) || 0,
    Number(options.minimumHeight) || 0,
    Number(options.minimumSize) || 0
  );
  const outerRadius = Math.max(sourceOuterRadius, minimumDiameter / 2);

  return {
    width: outerRadius * 2,
    height: outerRadius * 2
  };
}

export function starNodePoints(center, outerRadius, data = {}) {
  const count = Math.max(3, Math.round(Number(data.starPoints) || 5));
  const radius = Math.max(0, Math.abs(Number(outerRadius) || 0));
  const usesPointRatio = data.starUsesPointRatio !== false;
  const innerRadius = usesPointRatio
    ? radius / normalizedStarPointRatio(data.starPointRatio)
    : Math.max(0, radius - normalizedStarPointHeight(data.starPointHeight));
  const startAngle = 90 + (Number(data.shapeBorderRotate) || 0);
  const x = Number(center?.x) || 0;
  const y = Number(center?.y) || 0;

  return Array.from({ length: count * 2 }, (_unused, index) => {
    const angle = ((startAngle + (180 * index) / count) * Math.PI) / 180;
    const pointRadius = index % 2 === 0 ? radius : innerRadius;
    return {
      x: x + Math.cos(angle) * pointRadius,
      y: y + Math.sin(angle) * pointRadius
    };
  });
}

export function trapeziumLayoutSize(contentWidth, contentHeight, options = {}) {
  let bodyHalfWidth = Math.max(0, Number(contentWidth) || 0) / 2;
  let halfHeight = Math.max(TRAPEZIUM_EPSILON, Math.max(0, Number(contentHeight) || 0) / 2);
  const minimumWidth = Math.max(0, Number(options.minimumWidth) || 0);
  const minimumHeight = Math.max(0, Number(options.minimumHeight) || 0);
  let leftExtension = trapeziumSideExtension(halfHeight, options.leftAngle);
  let rightExtension = trapeziumSideExtension(halfHeight, options.rightAngle);
  const minimumHalfHeight = minimumHeight / 2;

  // `\installtrapeziumparameters` preserves the side-angle construction when
  // a default trapezium is raised to its minimum height.
  if (halfHeight < minimumHalfHeight) {
    const scale = minimumHalfHeight / halfHeight;
    bodyHalfWidth *= scale;
    halfHeight *= scale;
    leftExtension *= scale;
    rightExtension *= scale;
  }

  const span = () => bodyHalfWidth * 2 + Math.abs(leftExtension) + Math.abs(rightExtension);
  if (span() < minimumWidth) {
    const scale = minimumWidth / Math.max(TRAPEZIUM_EPSILON, span());
    bodyHalfWidth *= scale;
    leftExtension *= scale;
    rightExtension *= scale;
    halfHeight *= scale;
  }

  return {
    width: bodyHalfWidth * 2 + Math.abs(leftExtension) + Math.abs(rightExtension),
    height: halfHeight * 2
  };
}

export function trapeziumNodePoints(center, halfWidth, halfHeight, data = {}) {
  const height = Math.max(TRAPEZIUM_EPSILON, Math.abs(Number(halfHeight) || 0));
  const leftExtension = trapeziumSideExtension(height, data.trapeziumLeftAngle);
  const rightExtension = trapeziumSideExtension(height, data.trapeziumRightAngle);
  const bodyHalfWidth = Math.max(0, Math.abs(Number(halfWidth) || 0) - (Math.abs(leftExtension) + Math.abs(rightExtension)) / 2);
  const x = Number(center?.x) || 0;
  const y = Number(center?.y) || 0;

  return [
    { x: x - bodyHalfWidth - Math.max(0, leftExtension), y: y - height },
    { x: x - bodyHalfWidth + Math.min(0, leftExtension), y: y + height },
    { x: x + bodyHalfWidth - Math.min(0, rightExtension), y: y + height },
    { x: x + bodyHalfWidth + Math.max(0, rightExtension), y: y - height }
  ];
}

function trapeziumSideExtension(halfHeight, rawAngle) {
  const angle = normalizeTrapeziumAngle(rawAngle);
  const radians = (angle * Math.PI) / 180;
  const sine = Math.sin(radians);
  if (Math.abs(sine) < TRAPEZIUM_EPSILON) return 0;
  return 2 * halfHeight * (Math.cos(radians) / sine);
}

function normalizedStarPointRatio(rawRatio) {
  const value = Number(rawRatio);
  return Number.isFinite(value) && value > TRAPEZIUM_EPSILON ? value : STAR_DEFAULT_POINT_RATIO;
}

function normalizedStarPointHeight(rawHeight) {
  const value = Number(rawHeight);
  return Number.isFinite(value) && value >= 0 ? value : STAR_DEFAULT_POINT_HEIGHT;
}

function normalizeTrapeziumAngle(rawAngle) {
  const numeric = Number(rawAngle);
  const fallback = 60;
  const normalized = Number.isFinite(numeric) ? ((numeric % 360) + 360) % 360 : fallback;
  // PGF accepts a broad angular range. This focused SVG shape needs finite,
  // non-degenerate sides, so retain the safe range already used by TikZKit.
  return Math.max(10, Math.min(170, normalized || fallback));
}

export const tikzLibrary = {
  "name": "shapes.geometric",
  "status": "partial",
  "implementedBy": [
    "src/engine/evaluate.js:regularPolygonLayoutSize/regularPolygonStartAngle/regularPolygonOuterRadiusExtension/nodeBorderPoint/polygonBorderPointWithPadding",
    "src/tikz/libraries/shapes.geometric.js:starLayoutSize/starNodePoints/trapeziumLayoutSize/trapeziumNodePoints",
    "src/renderers/svg/nodeShapes.js:regularPolygonNodePoints/starNodePoints"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": [
    "regular polygon with PGF circumcircle sizing, odd/even orientation, rotation, and border crop",
    "star with PGF radius modes, minimum sizing, and border rotation",
    "trapezium with default PGF cotangent side geometry, minimum-size scaling, and mitered curve terminal crop",
    "cloud",
    "isosceles triangle with apex angle, minimum height, rotation, and named anchors"
  ],
  "implements": [
    "regular polygon",
    "star",
    "trapezium",
    "cloud",
    "isosceles triangle"
  ],
  "notes": "Reviewed locally on 2026-08-07 against pgflibraryshapes.geometric.code.tex and the PGF shapes manual. Regular polygons use the source's sqrt(2)*apothem*sec(180/sides) content radius, circumcircle minimum size, odd/even orientation, `shape border rotate`/`regular polygon rotate`, and the outer-separation mitre extension used by curved terminal arrows. The permanent visual driver is arrows/regular-polygon-curved-terminal.tex. Stars now share PGF's max-content-radius, sqrt(2) inner-radius, ratio/point-height outer-radius, largest-minimum-diameter, and `star rotate` construction across layout, clipping, and SVG paint; arrows-shape-curved-terminal-padding is the visual driver. The default trapezium follows `\\installtrapeziumparameters`: side extensions are 2*half-height*cot(angle), minimum width/height preserve that construction by uniform scaling, and curve terminal rays intersect the mitered offset contour rather than an arbitrary adjacent side. `test/fixtures/arrows/shape-curved-terminal-miters.tex` is the visual regression. `trapezium stretches`, `trapezium stretches body`, star outer-separation anchor radii, named inner/outer star anchors, degenerate angular ranges, and custom-shape border geometry remain partial."
};
