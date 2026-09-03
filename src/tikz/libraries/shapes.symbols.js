const NOWHERE = "nowhere";

export const tikzLibrary = {
  name: "shapes.symbols",
  status: "partial",
  implementedBy: "src/tikz/libraries/shapes.symbols.js:forbiddenSignGeometry/magnifyingGlassGeometry/magnifyingGlassBorderPoint/parseSignalDirections/signalLayoutSize/signalGeometry/signalBorderPoint/tapeLayoutSize/tapeGeometry/tapeBorderPoint/magneticTapeLayoutSize/magneticTapeGeometry/magneticTapeBorderPoint/cloudLayoutSize/cloudGeometry/cloudBorderPoint/starburstLayoutSize/starburstGeometry/starburstBorderPoint + src/engine/evaluate.js:nodeShape/estimateNodeSize/nodeAnchorOffset/nodeBorderPoint/forbiddenSignForegroundItem/magnifyingGlassForegroundItem + src/tikz/textMetrics.js:estimateFormulaParts + src/renderers/svg/renderSvg.js + src/renderers/svg/nodeShapes.js + src/renderers/svg/bounds.js",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  features: [
    "forbidden sign and correct forbidden sign",
    "forbidden-sign circle inheritance and foreground diagonal",
    "magnifying glass circle inheritance and foreground handle",
    "magnifying glass handle angle and aspect",
    "magnifying glass circle anchors and border clipping",
    "signal shape",
    "signal to/from compass directions",
    "signal pointer angle",
    "opposite horizontal or vertical pointers",
    "signal compass anchors and border clipping",
    "tape bend top/bottom styles and bend height",
    "tape compass anchors and border clipping",
    "magnetic tape shape and tail controls",
    "magnetic tape compass/tail anchors and border clipping",
    "cloud circular-puff outline and circum-ellipse sizing",
    "cloud puffs, puff arc, aspect, and aspect-ignore controls",
    "cloud compass/puff anchors and curved border clipping",
    "starburst polygon outline and content/minimum sizing",
    "starburst points, point height, and PGF-seeded random heights",
    "starburst outer/inner/numeric/compass anchors and border clipping",
    "starburst shape-border rotation and mitered outer separation"
  ],
  implements: [
    "forbidden sign",
    "correct forbidden sign",
    "magnifying glass",
    "magnifying glass handle angle",
    "magnifying glass handle aspect",
    "signal",
    "signal to",
    "signal from",
    "signal pointer angle",
    "tape",
    "tape bend",
    "tape bend top",
    "tape bend bottom",
    "tape bend height",
    "magnetic tape",
    "magnetic tape tail",
    "magnetic tape tail extend",
    "cloud",
    "cloud puffs",
    "cloud puff arc",
    "cloud ignores aspect",
    "cloud anchors use ellipse",
    "starburst",
    "starburst points",
    "starburst point height",
    "random starburst",
    "shape border rotate",
    "shape border uses incircle"
  ],
  notes: "Implements every node family declared by the TeX Live 2025 shapes.symbols source: forbidden-sign, magnifying-glass, signal, tape, magnetic-tape, cloud, and starburst. Forbidden signs inherit circle sizing, anchors, and border clipping; their source-direction diagonal is a marker-free foreground path painted over text. Magnifying glass also inherits the circle completely, while its source-angle radial handle is a marker-free foreground path that expands paint bounds without changing anchors or edge clipping. Tape follows the source's two elliptical half-wave construction, bend-before-minimum-height sizing, three bend styles, compass anchors, and curved border clipping. Magnetic tape follows the source's sqrt(2) circular sizing, clamped tail controls, asymmetric bounds, compass/tail anchors, and piecewise circular/tail border clipping. Its content-driven radius also uses local TeX metrics for comma-separated subscript sequences ending in dots. Cloud follows the source's inner-ellipse content fit, aspect/minimum-size circum-ellipse equations, circular puff arcs, puff anchors, and shared curved border clipping. Starburst follows the source's sqrt(2) content fit, exact seeded LCG point heights, mitered outer-separation polygon, rotated anchor border, named point anchors, and shared contour clipping; as in the PGF source, shape-border rotation affects anchors while the paint path stays unrotated. The TeX Live 2025 source default cloud puff arc is 150 degrees even though the manual prose says 135. The library remains partial for the already-documented advanced transform and exact TeX metric limits inside individual families."
};

export function isMagnifyingGlassShape(shape) {
  const normalized = String(shape || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized === "magnifyingglass";
}

export function magnifyingGlassGeometry(size = {}, data = {}) {
  const paintedRadius = Math.max(0, positive(size.width), positive(size.height)) / 2;
  const outerSep = positive(data.magnifyingGlassOuterSep ?? data.outerSep);
  const anchorRadius = paintedRadius + outerSep;
  const rawAngle = Number(data.magnifyingGlassHandleAngle ?? data.handleAngle);
  const handleAngle = Number.isFinite(rawAngle) ? rawAngle : -45;
  const rawAspect = Number(data.magnifyingGlassHandleAspect ?? data.handleAspect);
  const handleAspect = Number.isFinite(rawAspect) ? rawAspect : 1.5;
  const direction = circlePoint(1, handleAngle);
  const handleStart = roundPoint({
    x: direction.x * paintedRadius,
    y: direction.y * paintedRadius
  });
  const handleEnd = roundPoint({
    x: direction.x * paintedRadius * (1 + handleAspect),
    y: direction.y * paintedRadius * (1 + handleAspect)
  });
  const bounds = {
    minX: round(Math.min(-paintedRadius, handleStart.x, handleEnd.x)),
    minY: round(Math.min(-paintedRadius, handleStart.y, handleEnd.y)),
    maxX: round(Math.max(paintedRadius, handleStart.x, handleEnd.x)),
    maxY: round(Math.max(paintedRadius, handleStart.y, handleEnd.y))
  };
  const geometry = {
    paintedRadius: round(paintedRadius),
    outerSep: round(outerSep),
    anchorRadius: round(anchorRadius),
    handleAngle: round(handleAngle),
    handleAspect: round(handleAspect),
    handleStart,
    handleEnd,
    handleCommands: [
      { type: "moveTo", ...handleStart },
      { type: "lineTo", ...handleEnd }
    ],
    bounds,
    anchors: { center: { x: 0, y: 0 } }
  };
  for (const [name, directionValue] of Object.entries({
    north: { x: 0, y: 1 },
    "north east": { x: 1, y: 1 },
    east: { x: 1, y: 0 },
    "south east": { x: 1, y: -1 },
    south: { x: 0, y: -1 },
    "south west": { x: -1, y: -1 },
    west: { x: -1, y: 0 },
    "north west": { x: -1, y: 1 }
  })) {
    geometry.anchors[name] = magnifyingGlassBorderPoint(geometry, directionValue);
  }
  return geometry;
}

export function magnifyingGlassBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const direction = { x: Number(toward.x) || 0, y: Number(toward.y) || 0 };
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 1e-12) return { x: 0, y: 0 };
  const radius = positive(geometry.anchorRadius) + positive(padding);
  return roundPoint({
    x: direction.x * radius / length,
    y: direction.y * radius / length
  });
}

export function cloudLayoutSize(contentWidth, contentHeight, options = {}) {
  const puffs = normalizedCloudPuffs(options.puffs ?? options.cloudPuffs);
  const puffArc = normalizedCloudPuffArc(options.puffArc ?? options.cloudPuffArc);
  const aspect = Math.max(1e-9, positive(options.aspect) || 1);
  const ignoresAspect = Boolean(options.ignoresAspect ?? options.cloudIgnoresAspect);
  let innerRadiusX = Math.SQRT2 * positive(contentWidth) / 2;
  let innerRadiusY = Math.SQRT2 * positive(contentHeight) / 2;

  if (!ignoresAspect) {
    innerRadiusX = Math.max(innerRadiusX, aspect * innerRadiusY);
    innerRadiusY = Math.max(innerRadiusY, innerRadiusX / aspect);
    innerRadiusX = aspect * innerRadiusY;
  }

  const constants = cloudConstants(puffs, puffArc);
  let outerRadiusX = constants.cosHalfStep * innerRadiusX + constants.k * innerRadiusY;
  let outerRadiusY = constants.cosHalfStep * innerRadiusY + constants.k * innerRadiusX;
  const minimumSize = positive(options.minimumSize);
  outerRadiusX = Math.max(outerRadiusX, positive(options.minimumWidth) / 2, minimumSize / 2);
  outerRadiusY = Math.max(outerRadiusY, positive(options.minimumHeight) / 2, minimumSize / 2);

  return {
    width: round(outerRadiusX * 2),
    height: round(outerRadiusY * 2)
  };
}

export function cloudGeometry(size = {}, data = {}) {
  const puffs = normalizedCloudPuffs(data.cloudPuffs ?? data.puffs);
  const puffArc = normalizedCloudPuffArc(data.cloudPuffArc ?? data.puffArc);
  const outerRadiusX = positive(size.width) / 2;
  const outerRadiusY = positive(size.height) / 2;
  const outerSep = positive(data.cloudOuterSep ?? data.outerSep);
  const anchorsUseEllipse = Boolean(data.cloudAnchorsUseEllipse ?? data.anchorsUseEllipse);
  const constants = cloudConstants(puffs, puffArc);
  const denominator = Math.max(1e-9, constants.cosHalfStep ** 2 - constants.k ** 2);
  const innerRadiusX = Math.max(1e-9,
    (constants.cosHalfStep * outerRadiusX - constants.k * outerRadiusY) / denominator);
  const innerRadiusY = Math.max(1e-9,
    (constants.cosHalfStep * outerRadiusY - constants.k * outerRadiusX) / denominator);
  const puffGeometry = [];
  const outlineCommands = [];
  const boundaryPoints = [];
  const outerBoundaryPoints = [];
  const step = 360 / puffs;
  const firstAngle = 90 - step / 2;

  for (let index = 0; index < puffs; index += 1) {
    const startAngle = firstAngle + step * index;
    const endAngle = startAngle + step;
    const start = ellipsePoint(0, 0, innerRadiusX, innerRadiusY, startAngle);
    const end = ellipsePoint(0, 0, innerRadiusX, innerRadiusY, endAngle);
    const puff = cloudPuff(start, end, puffArc, outerSep);
    if (index === 0) outlineCommands.push({ type: "moveTo", ...roundPoint(start) });
    outlineCommands.push(...circleArcAtCommands(puff.center, puff.radius, puff.startAngle, puffArc, end));
    const visibleSamples = sampleCircleArcAt(puff.center, puff.radius, puff.startAngle, puffArc, 16);
    const outerSamples = sampleCircleArcAt(puff.center, puff.outerRadius, puff.startAngle, puffArc, 16);
    boundaryPoints.push(...(index ? visibleSamples.slice(1) : visibleSamples));
    outerBoundaryPoints.push(...(index ? outerSamples.slice(1) : outerSamples));
    puffGeometry.push({
      index: index + 1,
      start: roundPoint(start),
      end: roundPoint(end),
      center: roundPoint(puff.center),
      radius: round(puff.radius),
      outerRadius: round(puff.outerRadius),
      startAngle: round(puff.startAngle),
      anchor: roundPoint(circlePointAt(puff.center, puff.outerRadius, puff.startAngle + puffArc / 2))
    });
  }
  outlineCommands.push({ type: "closePath" });

  const geometry = {
    puffs: puffGeometry,
    puffCount: puffs,
    puffArc,
    innerRadiusX: round(innerRadiusX),
    innerRadiusY: round(innerRadiusY),
    outerRadiusX: round(outerRadiusX),
    outerRadiusY: round(outerRadiusY),
    outerSep: round(outerSep),
    anchorsUseEllipse,
    outlineCommands: outlineCommands.map(roundCommand),
    boundaryPoints: boundaryPoints.map(roundPoint),
    outerBoundaryPoints: outerBoundaryPoints.map(roundPoint),
    bounds: pointBounds(boundaryPoints)
  };
  geometry.anchors = Object.fromEntries([
    ["center", { x: 0, y: 0 }],
    ...puffGeometry.map((puff) => [`puff ${puff.index}`, puff.anchor]),
    ...Object.entries({
      north: { x: 0, y: 1 },
      "north east": { x: 1, y: 1 },
      east: { x: 1, y: 0 },
      "south east": { x: 1, y: -1 },
      south: { x: 0, y: -1 },
      "south west": { x: -1, y: -1 },
      west: { x: -1, y: 0 },
      "north west": { x: -1, y: 1 }
    }).map(([name, direction]) => [name, cloudBorderPoint(geometry, direction)])
  ]);
  return geometry;
}

export function cloudBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const direction = { x: Number(toward.x) || 0, y: Number(toward.y) || 0 };
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 1e-12) return { x: 0, y: 0 };
  const distance = positive(padding);
  if (geometry.anchorsUseEllipse) {
    const radiusX = positive(geometry.outerRadiusX) + distance;
    const radiusY = positive(geometry.outerRadiusY) + distance;
    const factor = 1 / Math.sqrt(
      direction.x ** 2 / Math.max(1e-12, radiusX ** 2) +
      direction.y ** 2 / Math.max(1e-12, radiusY ** 2)
    );
    return roundPoint({ x: direction.x * factor, y: direction.y * factor });
  }
  const hit = polygonRayHit(geometry.outerBoundaryPoints || geometry.boundaryPoints || [], direction);
  if (!hit) return { x: 0, y: 0 };
  const unit = { x: direction.x / length, y: direction.y / length };
  return roundPoint({
    x: hit.point.x + unit.x * distance,
    y: hit.point.y + unit.y * distance
  });
}

export function starburstLayoutSize(contentWidth, contentHeight, options = {}) {
  const pointHeight = positive(options.pointHeight ?? options.starburstPointHeight ?? 0.5);
  const usesIncircle = Boolean(options.shapeBorderUsesIncircle);
  const requestedRotation = Number(options.shapeBorderRotate) || 0;
  const rotation = usesIncircle ? normalizedDegrees(requestedRotation) : pgfQuarterRotation(requestedRotation);
  let innerRadiusX = positive(contentWidth) / 2;
  let innerRadiusY = positive(contentHeight) / 2;

  if (usesIncircle) {
    innerRadiusX = 1.41421 * Math.max(innerRadiusX, innerRadiusY);
    innerRadiusY = innerRadiusX;
  } else {
    if (rotation === 90 || rotation === 270) {
      [innerRadiusX, innerRadiusY] = [innerRadiusY, innerRadiusX];
    }
    innerRadiusX *= 1.41421;
    innerRadiusY *= 1.41421;
  }

  const minimumSize = positive(options.minimumSize);
  const minimumWidth = Math.max(positive(options.minimumWidth), minimumSize);
  const minimumHeight = Math.max(positive(options.minimumHeight), minimumSize);
  innerRadiusX = Math.max(innerRadiusX, minimumWidth / 2 - pointHeight);
  innerRadiusY = Math.max(innerRadiusY, minimumHeight / 2 - pointHeight);

  return {
    width: round(2 * (innerRadiusX + pointHeight)),
    height: round(2 * (innerRadiusY + pointHeight)),
    innerRadiusX: round(innerRadiusX),
    innerRadiusY: round(innerRadiusY),
    rotation: round(rotation)
  };
}

export function starburstGeometry(size = {}, data = {}) {
  const pointCount = normalizedStarburstPoints(data.starburstPoints ?? data.points);
  const pointHeight = positive(data.starburstPointHeight ?? data.pointHeight ?? 0.5);
  const randomSeed = normalizedStarburstSeed(data.randomStarburst ?? data.randomSeed);
  const outerSep = positive(data.starburstOuterSep ?? data.outerSep);
  const rotation = normalizedDegrees(Number(data.starburstRotation ?? data.shapeBorderRotate) || 0);
  const innerRadiusX = Math.max(1e-9,
    Number(data.starburstInnerRadiusX) || positive(size.width) / 2 - pointHeight);
  const innerRadiusY = Math.max(1e-9,
    Number(data.starburstInnerRadiusY) || positive(size.height) / 2 - pointHeight);
  const angleStep = 180 / pointCount;
  const pointHeightRatios = [];
  const points = [];
  let randomState = randomSeed;

  for (let index = 0; index < pointCount * 2; index += 1) {
    const outer = index % 2 === 0;
    let height = 0;
    if (outer) {
      if (randomSeed === 0) {
        pointHeightRatios.push(1);
        height = pointHeight;
      } else {
        const next = pgfRandomUnit(randomState);
        randomState = next.state;
        const ratio = 0.25 + 0.75 * next.value;
        pointHeightRatios.push(ratio);
        height = pointHeight * ratio;
      }
    }
    const angle = 90 + angleStep * index;
    const radians = degreesToRadians(angle);
    points.push(roundPoint({
      x: (innerRadiusX + height) * Math.cos(radians),
      y: (innerRadiusY + height) * Math.sin(radians)
    }));
  }

  const unrotatedBorderVertices = polygonMiterOffsetPoints(points, outerSep);
  const borderVertices = unrotatedBorderVertices.map((point) => rotateLocalPoint(point, rotation));
  const outlineCommands = [
    { type: "moveTo", ...points[0] },
    ...points.slice(1).map((point) => ({ type: "lineTo", ...point })),
    { type: "closePath" }
  ];
  const geometry = {
    pointCount,
    pointHeight: round(pointHeight),
    pointHeightRatios: pointHeightRatios.map(round),
    randomSeed,
    rotation: round(rotation),
    innerRadiusX: round(innerRadiusX),
    innerRadiusY: round(innerRadiusY),
    outerSep: round(outerSep),
    points,
    outerPoints: points.filter((_point, index) => index % 2 === 0),
    innerPoints: points.filter((_point, index) => index % 2 === 1),
    borderVertices: borderVertices.map(roundPoint),
    outlineCommands,
    bounds: pointBounds(points),
    anchorBounds: pointBounds(borderVertices)
  };
  geometry.anchors = { center: { x: 0, y: 0 } };
  for (let index = 0; index < pointCount; index += 1) {
    geometry.anchors[`outer point ${index + 1}`] = geometry.borderVertices[index * 2];
    geometry.anchors[`inner point ${index + 1}`] = geometry.borderVertices[index * 2 + 1];
  }
  for (const [name, direction] of Object.entries({
    north: { x: 0, y: 1 },
    "north east": { x: 1, y: 1 },
    east: { x: 1, y: 0 },
    "south east": { x: 1, y: -1 },
    south: { x: 0, y: -1 },
    "south west": { x: -1, y: -1 },
    west: { x: -1, y: 0 },
    "north west": { x: -1, y: 1 }
  })) {
    geometry.anchors[name] = starburstBorderPoint(geometry, direction);
  }
  return geometry;
}

export function starburstBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const direction = { x: Number(toward.x) || 0, y: Number(toward.y) || 0 };
  if (Math.hypot(direction.x, direction.y) <= 1e-12) return { x: 0, y: 0 };
  const extra = positive(padding);
  const points = extra > 0
    ? polygonMiterOffsetPoints(geometry.points || [], positive(geometry.outerSep) + extra)
        .map((point) => rotateLocalPoint(point, Number(geometry.rotation) || 0))
    : geometry.borderVertices || geometry.points || [];
  const hit = polygonRayHit(points, direction);
  return hit ? roundPoint(hit.point) : { x: 0, y: 0 };
}

function pgfRandomUnit(seed) {
  const quotient = Math.trunc(seed / 30845);
  const remainder = seed - quotient * 30845;
  let state = 69621 * remainder - 23902 * quotient;
  if (state < 0) state += 2147483647;
  return {
    state,
    value: (state % 100001) / 100000
  };
}

function normalizedStarburstPoints(value) {
  const number = Number(value);
  return Math.max(2, Math.min(256, Math.trunc(Number.isFinite(number) ? number : 17)));
}

function normalizedStarburstSeed(value) {
  const number = Number(value);
  return Math.trunc(Number.isFinite(number) ? number : 100);
}

function pgfQuarterRotation(value) {
  const remainder = value - Math.trunc(value / 360) * 360;
  let result = Math.trunc((Math.trunc(remainder) + 45) / 90) * 90;
  if (result < 0) result += 360;
  return result % 360;
}

function cloudConstants(puffs, puffArc) {
  const halfStep = 180 / puffs;
  return {
    cosHalfStep: Math.cos(degreesToRadians(halfStep)),
    k: Math.sin(degreesToRadians(halfStep)) * Math.tan(degreesToRadians(puffArc / 4))
  };
}

function cloudPuff(start, end, puffArc, outerSep) {
  const chord = { x: end.x - start.x, y: end.y - start.y };
  const chordLength = Math.max(1e-12, Math.hypot(chord.x, chord.y));
  const halfArcRadians = degreesToRadians(puffArc / 2);
  const radius = chordLength / (2 * Math.sin(halfArcRadians));
  const outward = { x: chord.y / chordLength, y: -chord.x / chordLength };
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const centerDistance = radius * Math.cos(halfArcRadians);
  const center = {
    x: middle.x - outward.x * centerDistance,
    y: middle.y - outward.y * centerDistance
  };
  return {
    center,
    radius,
    outerRadius: radius + outerSep,
    startAngle: radiansToDegrees(Math.atan2(start.y - center.y, start.x - center.x))
  };
}

function circleArcAtCommands(center, radius, startAngle, arc, forcedEnd) {
  const quarterArc = arc / 4;
  const arcSlope = startAngle - (90 - arc / 2);
  const controlScale = radius * Math.tan(degreesToRadians(quarterArc));
  const x = 0.55228475 * controlScale * Math.sin(degreesToRadians(quarterArc));
  const y = 0.55228475 * controlScale * Math.cos(degreesToRadians(quarterArc));
  const start = circlePointAt(center, radius, startAngle);
  const middle = circlePointAt(center, radius, startAngle + arc / 2);
  const end = forcedEnd || circlePointAt(center, radius, startAngle + arc);
  const firstRotation = arcSlope + 90 - quarterArc;
  const secondRotation = arcSlope + 90 + quarterArc;
  const firstControl = addPoint(start, rotateLocalPoint({ x, y }, firstRotation));
  const secondControl = addPoint(middle, rotateLocalPoint({ x, y: -y }, firstRotation));
  const thirdControl = addPoint(middle, rotateLocalPoint({ x, y }, secondRotation));
  const fourthControl = addPoint(end, rotateLocalPoint({ x, y: -y }, secondRotation));
  return [
    { type: "curveTo", x1: firstControl.x, y1: firstControl.y, x2: secondControl.x, y2: secondControl.y, x: middle.x, y: middle.y },
    { type: "curveTo", x1: thirdControl.x, y1: thirdControl.y, x2: fourthControl.x, y2: fourthControl.y, x: end.x, y: end.y }
  ].map(roundCommand);
}

function sampleCircleArcAt(center, radius, startDegrees, arcDegrees, count) {
  return Array.from({ length: count + 1 }, (_unused, index) =>
    circlePointAt(center, radius, startDegrees + arcDegrees * index / count));
}

function circlePointAt(center, radius, degrees) {
  const point = circlePoint(radius, degrees);
  return { x: center.x + point.x, y: center.y + point.y };
}

function rotateLocalPoint(point, degrees) {
  const radians = degreesToRadians(degrees);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine
  };
}

function addPoint(first, second) {
  return { x: first.x + second.x, y: first.y + second.y };
}

function normalizedCloudPuffs(value) {
  const number = Number(value);
  return Math.max(2, Math.min(128, Math.trunc(Number.isFinite(number) ? number : 10)));
}

function normalizedCloudPuffArc(value) {
  const number = Number(value);
  return Math.max(1, Math.min(179, Number.isFinite(number) ? number : 150));
}

export function isForbiddenSignShape(shape) {
  const normalized = String(shape || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized === "forbiddensign" || normalized === "correctforbiddensign";
}

export function forbiddenSignGeometry(size = {}, data = {}) {
  const paintedRadius = Math.max(0, positive(size.width), positive(size.height)) / 2;
  const outerSep = Math.max(positive(data.outerXSep), positive(data.outerYSep));
  const savedRadius = paintedRadius + outerSep;
  const visibleRadius = Math.max(0, savedRadius - outerSep);
  const diagonalRadius = visibleRadius * 0.707107;
  const correct = Boolean(data.correct);
  const commands = correct
    ? [
        { type: "moveTo", x: diagonalRadius, y: -diagonalRadius },
        { type: "lineTo", x: -diagonalRadius, y: diagonalRadius }
      ]
    : [
        { type: "moveTo", x: -diagonalRadius, y: -diagonalRadius },
        { type: "lineTo", x: diagonalRadius, y: diagonalRadius }
      ];
  return {
    correct,
    paintedRadius: round(paintedRadius),
    outerSep: round(outerSep),
    savedRadius: round(savedRadius),
    diagonalRadius: round(diagonalRadius),
    commands: commands.map(roundCommand)
  };
}

export function parseSignalDirections(signalFrom = "nowhere", signalTo = "east") {
  const directions = {
    north: NOWHERE,
    east: NOWHERE,
    south: NOWHERE,
    west: NOWHERE
  };
  assignSignalDirections(directions, signalFrom, "from");
  assignSignalDirections(directions, signalTo, "to");
  return directions;
}

export function signalLayoutSize(contentWidth, contentHeight, options = {}) {
  const directions = normalizedDirections(options);
  const pointerAngle = normalizedPointerAngle(options.pointerAngle ?? options.signalPointerAngle);
  const tangent = pointerTangent(pointerAngle);
  const horizontalPointers = Number(directions.east !== NOWHERE) + Number(directions.west !== NOWHERE);
  const verticalPointers = Number(directions.north !== NOWHERE) + Number(directions.south !== NOWHERE);
  const minimumSize = positive(options.minimumSize);
  const minimumWidth = Math.max(minimumSize, positive(options.minimumWidth));
  const minimumHeight = Math.max(minimumSize, positive(options.minimumHeight));

  let halfWidth = positive(contentWidth) / 2;
  let halfHeight = positive(contentHeight) / 2;
  let pointerX = tangent * halfHeight;
  let pointerY = tangent * halfWidth;

  const naturalHeight = halfHeight * 2 + pointerY * verticalPointers;
  if (naturalHeight < minimumHeight) {
    halfHeight = Math.max(0, (minimumHeight - pointerY * verticalPointers) / 2);
    pointerX = tangent * halfHeight;
  }

  const naturalWidth = halfWidth * 2 + pointerX * horizontalPointers;
  if (naturalWidth < minimumWidth) {
    halfWidth = Math.max(0, (minimumWidth - pointerX * horizontalPointers) / 2);
    pointerY = tangent * halfWidth;
  }

  return {
    width: round(halfWidth * 2 + pointerX * horizontalPointers),
    height: round(halfHeight * 2 + pointerY * verticalPointers)
  };
}

export function signalGeometry(size = {}, data = {}) {
  const directions = normalizedDirections(data);
  const pointerAngle = normalizedPointerAngle(data.pointerAngle ?? data.signalPointerAngle);
  const tangent = pointerTangent(pointerAngle);
  const horizontalPointers = Number(directions.east !== NOWHERE) + Number(directions.west !== NOWHERE);
  const verticalPointers = Number(directions.north !== NOWHERE) + Number(directions.south !== NOWHERE);
  const width = positive(size.width);
  const height = positive(size.height);

  let halfWidth;
  let halfHeight;
  let pointerX;
  let pointerY;
  if (horizontalPointers) {
    halfHeight = height / 2;
    pointerX = tangent * halfHeight;
    halfWidth = Math.max(0, (width - pointerX * horizontalPointers) / 2);
    pointerY = tangent * halfWidth;
  } else if (verticalPointers) {
    halfWidth = width / 2;
    pointerY = tangent * halfWidth;
    halfHeight = Math.max(0, (height - pointerY * verticalPointers) / 2);
    pointerX = tangent * halfHeight;
  } else {
    halfWidth = width / 2;
    halfHeight = height / 2;
    pointerX = tangent * halfHeight;
    pointerY = tangent * halfWidth;
  }

  const anchors = {
    center: { x: 0, y: 0 },
    north: { x: 0, y: halfHeight + (directions.north === "to" ? pointerY : 0) },
    "north east": {
      x: halfWidth + (directions.east === "from" ? pointerX : 0),
      y: halfHeight + (directions.north === "from" ? pointerY : 0)
    },
    east: { x: halfWidth + (directions.east === "to" ? pointerX : 0), y: 0 },
    "south east": {
      x: halfWidth + (directions.east === "from" ? pointerX : 0),
      y: -halfHeight - (directions.south === "from" ? pointerY : 0)
    },
    south: { x: 0, y: -halfHeight - (directions.south === "to" ? pointerY : 0) },
    "south west": {
      x: -halfWidth - (directions.west === "from" ? pointerX : 0),
      y: -halfHeight - (directions.south === "from" ? pointerY : 0)
    },
    west: { x: -halfWidth - (directions.west === "to" ? pointerX : 0), y: 0 },
    "north west": {
      x: -halfWidth - (directions.west === "from" ? pointerX : 0),
      y: halfHeight + (directions.north === "from" ? pointerY : 0)
    }
  };
  const points = [
    anchors.north,
    anchors["north east"],
    anchors.east,
    anchors["south east"],
    anchors.south,
    anchors["south west"],
    anchors.west,
    anchors["north west"]
  ].map(roundPoint);
  const commands = [
    { type: "moveTo", ...points[0] },
    ...points.slice(1).map((point) => ({ type: "lineTo", ...point })),
    { type: "closePath" }
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    pointerAngle,
    directions,
    halfWidth: round(halfWidth),
    halfHeight: round(halfHeight),
    pointerX: round(pointerX),
    pointerY: round(pointerY),
    points,
    commands,
    anchors: Object.fromEntries(Object.entries(anchors).map(([name, point]) => [name, roundPoint(point)])),
    bounds: {
      minX: round(Math.min(...xs)),
      minY: round(Math.min(...ys)),
      maxX: round(Math.max(...xs)),
      maxY: round(Math.max(...ys))
    }
  };
}

export function signalBorderPoint(geometry, toward, padding = 0) {
  const direction = { x: Number(toward?.x) || 0, y: Number(toward?.y) || 0 };
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 1e-12) return { x: 0, y: 0 };
  const hit = polygonRayHit(geometry?.points || [], direction);
  if (!hit) return { x: 0, y: 0 };
  const distance = positive(padding);
  if (distance <= 1e-12) return roundPoint(hit.point);

  const edge = { x: hit.b.x - hit.a.x, y: hit.b.y - hit.a.y };
  const edgeLength = Math.hypot(edge.x, edge.y);
  if (edgeLength <= 1e-12) return roundPoint(hit.point);
  const area = polygonSignedArea(geometry.points);
  const outward = area < 0
    ? { x: -edge.y / edgeLength, y: edge.x / edgeLength }
    : { x: edge.y / edgeLength, y: -edge.x / edgeLength };
  const unit = { x: direction.x / length, y: direction.y / length };
  const projection = unit.x * outward.x + unit.y * outward.y;
  if (projection <= 1e-12) return roundPoint(hit.point);
  const radialDistance = distance / projection;
  return roundPoint({
    x: hit.point.x + unit.x * radialDistance,
    y: hit.point.y + unit.y * radialDistance
  });
}

export function magneticTapeLayoutSize(contentWidth, contentHeight, options = {}) {
  const minimumDiameter = Math.max(
    positive(options.minimumSize),
    positive(options.minimumWidth),
    positive(options.minimumHeight)
  );
  const contentDiameter = Math.SQRT2 * Math.max(positive(contentWidth), positive(contentHeight));
  const diameter = Math.max(contentDiameter, minimumDiameter);
  return { width: round(diameter), height: round(diameter) };
}

export function tapeLayoutSize(contentWidth, contentHeight, options = {}) {
  const bendHeight = positive(options.bendHeight ?? options.tapeBendHeight ?? 0);
  const halfBendHeight = bendHeight / 2;
  const bendTop = normalizeTapeBendStyle(options.bendTop ?? options.tapeBendTop, "in and out");
  const bendBottom = normalizeTapeBendStyle(options.bendBottom ?? options.tapeBendBottom, "in and out");
  const bendCount = Number(bendTop !== "none") + Number(bendBottom !== "none");
  const minimumSize = positive(options.minimumSize);
  const minimumWidth = Math.max(minimumSize, positive(options.minimumWidth));
  const minimumHeight = Math.max(minimumSize, positive(options.minimumHeight));
  const halfWidth = Math.max(positive(contentWidth) / 2, minimumWidth / 2);
  const augmentedHalfHeight = Math.max(
    positive(contentHeight) / 2 + halfBendHeight * bendCount,
    minimumHeight / 2
  );
  const halfHeight = Math.max(0, augmentedHalfHeight - halfBendHeight * bendCount);
  return {
    width: round(halfWidth * 2),
    height: round(halfHeight * 2)
  };
}

export function tapeGeometry(size = {}, data = {}) {
  const halfWidth = positive(size.width) / 2;
  const halfHeight = positive(size.height) / 2;
  const bendHeight = positive(data.tapeBendHeight ?? data.bendHeight);
  const halfBendHeight = bendHeight / 2;
  const bendTop = normalizeTapeBendStyle(data.tapeBendTop ?? data.bendTop, "in and out");
  const bendBottom = normalizeTapeBendStyle(data.tapeBendBottom ?? data.bendBottom, "in and out");
  const outerXSep = positive(data.tapeOuterXSep ?? data.outerXSep);
  const outerYSep = positive(data.tapeOuterYSep ?? data.outerYSep);
  const bendXRadius = Math.SQRT1_2 * halfWidth;
  const bendYRadius = (2 + Math.SQRT2) * halfBendHeight;
  const top = tapeBendPath("top", bendTop, halfWidth, halfHeight, halfBendHeight, bendXRadius, bendYRadius);
  const bottom = tapeBendPath("bottom", bendBottom, halfWidth, halfHeight, halfBendHeight, bendXRadius, bendYRadius);
  const outlineCommands = [
    { type: "moveTo", x: -halfWidth, y: 0 },
    { type: "lineTo", x: -halfWidth, y: halfHeight },
    ...top.commands,
    { type: "lineTo", x: halfWidth, y: -halfHeight },
    ...bottom.commands,
    { type: "closePath" }
  ].map(roundCommand);
  const boundaryPoints = [
    { x: -halfWidth, y: 0 },
    { x: -halfWidth, y: halfHeight },
    ...top.points,
    { x: halfWidth, y: -halfHeight },
    ...bottom.points
  ].map(roundPoint);
  const bounds = pointBounds(boundaryPoints);
  const cornerAnchors = tapeCornerAnchors({
    halfWidth,
    halfHeight,
    halfBendHeight,
    bendXRadius,
    bendYRadius,
    bendTop,
    bendBottom,
    outerXSep,
    outerYSep
  });
  const anchors = {
    center: { x: 0, y: 0 },
    north: { x: 0, y: (cornerAnchors["north west"].y + cornerAnchors["north east"].y) / 2 },
    "north east": cornerAnchors["north east"],
    east: { x: halfWidth + outerXSep, y: 0 },
    "south east": cornerAnchors["south east"],
    south: { x: 0, y: (cornerAnchors["south west"].y + cornerAnchors["south east"].y) / 2 },
    "south west": cornerAnchors["south west"],
    west: { x: -halfWidth - outerXSep, y: 0 },
    "north west": cornerAnchors["north west"]
  };

  return {
    halfWidth: round(halfWidth),
    halfHeight: round(halfHeight),
    halfBendHeight: round(halfBendHeight),
    bendXRadius: round(bendXRadius),
    bendYRadius: round(bendYRadius),
    bendTop,
    bendBottom,
    outerXSep: round(outerXSep),
    outerYSep: round(outerYSep),
    outlineCommands,
    boundaryPoints,
    bounds,
    anchors: Object.fromEntries(Object.entries(anchors).map(([name, point]) => [name, roundPoint(point)]))
  };
}

export function tapeBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const direction = { x: Number(toward.x) || 0, y: Number(toward.y) || 0 };
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 1e-12) return { x: 0, y: 0 };
  const hit = polygonRayHit(geometry.boundaryPoints || [], direction);
  if (!hit) return { x: 0, y: 0 };

  const edge = { x: hit.b.x - hit.a.x, y: hit.b.y - hit.a.y };
  const edgeLength = Math.hypot(edge.x, edge.y);
  if (edgeLength <= 1e-12) return roundPoint(hit.point);
  const area = polygonSignedArea(geometry.boundaryPoints || []);
  const outward = area < 0
    ? { x: -edge.y / edgeLength, y: edge.x / edgeLength }
    : { x: edge.y / edgeLength, y: -edge.x / edgeLength };
  const unit = { x: direction.x / length, y: direction.y / length };
  const projection = unit.x * outward.x + unit.y * outward.y;
  if (projection <= 1e-12) return roundPoint(hit.point);
  const outerDistance = Math.hypot(
    outward.x * positive(geometry.outerXSep),
    outward.y * positive(geometry.outerYSep)
  ) + positive(padding);
  const radialDistance = outerDistance / projection;
  return roundPoint({
    x: hit.point.x + unit.x * radialDistance,
    y: hit.point.y + unit.y * radialDistance
  });
}

export function magneticTapeGeometry(size = {}, data = {}) {
  const radius = Math.max(1e-9, positive(Math.max(Number(size.width) || 0, Number(size.height) || 0)) / 2);
  const tailProportion = clamp(Number(data.magneticTapeTail ?? data.tailProportion ?? 0.15), 0, 1);
  const tailExtend = positive(data.magneticTapeTailExtend ?? data.tailExtend);
  const outerSep = positive(data.magneticTapeOuterSep ?? data.outerSep);
  const outerRadius = radius + outerSep;
  const tailHeight = tailProportion * radius;
  const tailAngle = 360 - radiansToDegrees(Math.asin(clamp((radius - tailHeight) / radius, -1, 1)));
  const start = circlePoint(radius, tailAngle);
  const tailBottom = { x: radius + tailExtend, y: -radius };
  const tailTop = { x: radius + tailExtend, y: -radius + tailHeight };
  const outlineCommands = [
    { type: "moveTo", ...start },
    ...circleArcCommands(radius, tailAngle, 360),
    ...circleArcCommands(radius, 0, 270),
    { type: "lineTo", ...tailBottom },
    { type: "lineTo", ...tailTop },
    { type: "closePath" }
  ].map(roundCommand);
  const boundaryPoints = [
    ...sampleCircleArc(radius, tailAngle, 360, 12),
    ...sampleCircleArc(radius, 0, 270, 36).slice(1),
    tailBottom,
    tailTop
  ].map(roundPoint);
  const bounds = pointBounds(boundaryPoints);
  const diagonal = outerRadius * Math.SQRT1_2;
  const anchors = {
    center: { x: 0, y: 0 },
    north: { x: 0, y: outerRadius },
    "north east": { x: diagonal, y: diagonal },
    east: { x: outerRadius, y: 0 },
    "south east": { x: outerRadius, y: -outerRadius },
    south: { x: 0, y: -outerRadius },
    "south west": { x: -diagonal, y: -diagonal },
    west: { x: -outerRadius, y: 0 },
    "north west": { x: -diagonal, y: diagonal },
    "tail east": {
      x: radius + tailExtend + outerSep,
      y: -radius + tailHeight / 2
    },
    "tail south east": {
      x: radius + tailExtend + outerSep,
      y: -outerRadius
    },
    "tail north east": {
      x: radius + tailExtend + outerSep,
      y: -radius + tailHeight + outerSep
    }
  };

  return {
    radius: round(radius),
    outerRadius: round(outerRadius),
    outerSep: round(outerSep),
    tailProportion: round(tailProportion),
    tailExtend: round(tailExtend),
    tailHeight: round(tailHeight),
    tailAngle: round(tailAngle),
    outlineCommands,
    boundaryPoints,
    bounds,
    anchors: Object.fromEntries(Object.entries(anchors).map(([name, point]) => [name, roundPoint(point)]))
  };
}

export function magneticTapeBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-12) return { x: 0, y: 0 };

  const radius = positive(geometry.radius);
  const tailHeight = clamp(Number(geometry.tailHeight) || 0, 0, radius);
  const tailExtend = positive(geometry.tailExtend);
  const outerSep = positive(geometry.outerSep) + positive(padding);
  const outerRadius = radius + outerSep;
  const angle = normalizedDegrees(radiansToDegrees(Math.atan2(dy, dx)));
  const tailBottomAngle = 360 - radiansToDegrees(Math.atan2(outerRadius, outerRadius + tailExtend));
  const tailTopRise = outerRadius - outerSep * 2 - tailHeight;
  const tailTopAngle = 360 - radiansToDegrees(Math.atan2(tailTopRise, outerRadius + tailExtend));

  if (angle < 270 || angle >= tailTopAngle) {
    return roundPoint({ x: dx / length * outerRadius, y: dy / length * outerRadius });
  }
  if (angle < tailBottomAngle) {
    const factor = -outerRadius / dy;
    return roundPoint({ x: dx * factor, y: -outerRadius });
  }
  const factor = outerRadius / dx;
  return roundPoint({ x: outerRadius, y: dy * factor });
}

function tapeBendPath(side, style, halfWidth, halfHeight, halfBendHeight, radiusX, radiusY) {
  const isTop = side === "top";
  const firstX = isTop ? -halfWidth : halfWidth;
  const lastX = -firstX;
  const edgeY = isTop ? halfHeight : -halfHeight;
  if (style === "none" || halfBendHeight <= 1e-12 || radiusX <= 1e-12 || radiusY <= 1e-12) {
    const end = { x: lastX, y: edgeY };
    return { commands: [{ type: "lineTo", ...end }], points: [end] };
  }

  const sign = isTop ? 1 : -1;
  const start = { x: firstX, y: edgeY + sign * halfBendHeight };
  const diagonalY = Math.SQRT1_2 * radiusY;
  const specs = tapeBendArcSpecs(side, style, halfWidth, edgeY, halfBendHeight, diagonalY);
  const commands = [{ type: "lineTo", ...start }];
  const points = [start];
  for (const spec of specs) {
    commands.push(...ellipseArcCommands(spec.cx, spec.cy, radiusX, radiusY, spec.start, spec.end));
    points.push(...sampleEllipseArc(spec.cx, spec.cy, radiusX, radiusY, spec.start, spec.end, 12).slice(1));
  }
  return { commands, points };
}

function tapeBendArcSpecs(side, style, halfWidth, edgeY, halfBendHeight, diagonalY) {
  if (side === "top" && style === "in and out") {
    return [
      { cx: -halfWidth / 2, cy: edgeY + halfBendHeight + diagonalY, start: 225, end: 315 },
      { cx: halfWidth / 2, cy: edgeY + halfBendHeight - diagonalY, start: 135, end: 45 }
    ];
  }
  if (side === "top") {
    return [
      { cx: -halfWidth / 2, cy: edgeY + halfBendHeight - diagonalY, start: 135, end: 45 },
      { cx: halfWidth / 2, cy: edgeY + halfBendHeight + diagonalY, start: 225, end: 315 }
    ];
  }
  if (style === "in and out") {
    return [
      { cx: halfWidth / 2, cy: edgeY - halfBendHeight - diagonalY, start: 45, end: 135 },
      { cx: -halfWidth / 2, cy: edgeY - halfBendHeight + diagonalY, start: 315, end: 225 }
    ];
  }
  return [
    { cx: halfWidth / 2, cy: edgeY - halfBendHeight + diagonalY, start: 315, end: 225 },
    { cx: -halfWidth / 2, cy: edgeY - halfBendHeight - diagonalY, start: 45, end: 135 }
  ];
}

function tapeCornerAnchors(data) {
  const {
    halfWidth,
    halfHeight,
    halfBendHeight,
    bendXRadius,
    bendYRadius,
    bendTop,
    outerXSep,
    outerYSep
  } = data;
  const ratioAngle = radiansToDegrees(Math.atan2(bendYRadius, Math.max(1e-12, bendXRadius))) / 2;
  const cotIn = cotangentDegrees(45 - ratioAngle);
  const cotOut = cotangentDegrees(90 - ratioAngle);
  const topBase = halfHeight + (bendTop === "none" ? 0 : halfBendHeight);
  // PGF 3.1.11a intentionally follows `tape bend top` in all four south
  // anchor branches too. Preserve that source behavior even when the visible
  // bottom bend uses a different style.
  const southAnchorStyle = bendTop;
  const bottomBase = -halfHeight - (southAnchorStyle === "none" ? 0 : halfBendHeight);
  const topEastOffset = bendTop === "in and out" ? cotOut : bendTop === "out and in" ? cotIn : 1;
  const topWestOffset = bendTop === "in and out" ? cotIn : bendTop === "out and in" ? cotOut : 1;
  const bottomEastOffset = southAnchorStyle === "in and out" ? cotIn : southAnchorStyle === "out and in" ? cotOut : 1;
  const bottomWestOffset = southAnchorStyle === "in and out" ? cotOut : southAnchorStyle === "out and in" ? cotIn : 1;
  return {
    "north east": { x: halfWidth + outerXSep, y: topBase + topEastOffset * outerYSep },
    "north west": { x: -halfWidth - outerXSep, y: topBase + topWestOffset * outerYSep },
    "south east": { x: halfWidth + outerXSep, y: bottomBase - bottomEastOffset * outerYSep },
    "south west": { x: -halfWidth - outerXSep, y: bottomBase - bottomWestOffset * outerYSep }
  };
}

function ellipseArcCommands(cx, cy, radiusX, radiusY, startDegrees, endDegrees) {
  const commands = [];
  let start = startDegrees;
  const direction = endDegrees >= startDegrees ? 1 : -1;
  while ((direction > 0 && start < endDegrees - 1e-9) || (direction < 0 && start > endDegrees + 1e-9)) {
    const end = direction > 0 ? Math.min(start + 90, endDegrees) : Math.max(start - 90, endDegrees);
    const startRadians = degreesToRadians(start);
    const endRadians = degreesToRadians(end);
    const delta = endRadians - startRadians;
    const factor = (4 / 3) * Math.tan(delta / 4);
    const first = ellipsePoint(cx, cy, radiusX, radiusY, start);
    const last = ellipsePoint(cx, cy, radiusX, radiusY, end);
    commands.push({
      type: "curveTo",
      x1: first.x - factor * radiusX * Math.sin(startRadians),
      y1: first.y + factor * radiusY * Math.cos(startRadians),
      x2: last.x + factor * radiusX * Math.sin(endRadians),
      y2: last.y - factor * radiusY * Math.cos(endRadians),
      x: last.x,
      y: last.y
    });
    start = end;
  }
  return commands;
}

function sampleEllipseArc(cx, cy, radiusX, radiusY, startDegrees, endDegrees, count) {
  return Array.from({ length: count + 1 }, (_unused, index) => {
    const angle = startDegrees + (endDegrees - startDegrees) * index / count;
    return ellipsePoint(cx, cy, radiusX, radiusY, angle);
  });
}

function ellipsePoint(cx, cy, radiusX, radiusY, degrees) {
  const radians = degreesToRadians(degrees);
  return {
    x: cx + radiusX * Math.cos(radians),
    y: cy + radiusY * Math.sin(radians)
  };
}

function cotangentDegrees(degrees) {
  const tangent = Math.tan(degreesToRadians(degrees));
  return Math.abs(tangent) <= 1e-12 ? 0 : 1 / tangent;
}

function normalizeTapeBendStyle(value, fallback) {
  const text = String(value === true || value === undefined || value === null ? fallback : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (text === "in and out" || text === "out and in" || text === "none") return text;
  return "none";
}

function assignSignalDirections(directions, raw, kind) {
  const text = String(raw === true || raw === undefined || raw === null ? "" : raw)
    .trim()
    .toLowerCase();
  if (!text || text.includes("nowhere")) return;
  const values = text.includes("and")
    ? text.split(/\s+and\s+/).slice(0, 2)
    : [text, text];
  for (const value of values) assignSignalDirection(directions, value.trim(), kind);
}

function circleArcCommands(radius, startDegrees, endDegrees) {
  const commands = [];
  let start = startDegrees;
  const direction = endDegrees >= startDegrees ? 1 : -1;
  while ((direction > 0 && start < endDegrees - 1e-9) || (direction < 0 && start > endDegrees + 1e-9)) {
    const end = direction > 0 ? Math.min(start + 90, endDegrees) : Math.max(start - 90, endDegrees);
    const startRadians = degreesToRadians(start);
    const endRadians = degreesToRadians(end);
    const delta = endRadians - startRadians;
    const factor = (4 / 3) * Math.tan(delta / 4);
    const first = circlePoint(radius, start);
    const last = circlePoint(radius, end);
    commands.push({
      type: "curveTo",
      x1: first.x - factor * first.y,
      y1: first.y + factor * first.x,
      x2: last.x + factor * last.y,
      y2: last.y - factor * last.x,
      x: last.x,
      y: last.y
    });
    start = end;
  }
  return commands;
}

function sampleCircleArc(radius, startDegrees, endDegrees, count) {
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = startDegrees + (endDegrees - startDegrees) * index / count;
    points.push(circlePoint(radius, angle));
  }
  return points;
}

function circlePoint(radius, degrees) {
  const radians = degreesToRadians(degrees);
  return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) };
}

function pointBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: round(Math.min(...xs)),
    minY: round(Math.min(...ys)),
    maxX: round(Math.max(...xs)),
    maxY: round(Math.max(...ys))
  };
}

function roundCommand(command) {
  if (command.type === "closePath") return command;
  const rounded = { ...command, x: round(command.x), y: round(command.y) };
  if (command.type === "curveTo") {
    rounded.x1 = round(command.x1);
    rounded.y1 = round(command.y1);
    rounded.x2 = round(command.x2);
    rounded.y2 = round(command.y2);
  }
  return rounded;
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function radiansToDegrees(value) {
  return value * 180 / Math.PI;
}

function normalizedDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function clamp(value, minimum, maximum) {
  const number = Number(value);
  const finite = Number.isFinite(number) ? number : minimum;
  return Math.min(maximum, Math.max(minimum, finite));
}

function assignSignalDirection(directions, raw, kind) {
  const direction = canonicalDirection(raw);
  if (!direction) return;
  directions[direction] = kind;
  if (direction === "east" || direction === "west") {
    directions.north = NOWHERE;
    directions.south = NOWHERE;
  } else {
    directions.east = NOWHERE;
    directions.west = NOWHERE;
  }
}

function canonicalDirection(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (["east", "right"].includes(value)) return "east";
  if (["west", "left"].includes(value)) return "west";
  if (["north", "above", "up"].includes(value)) return "north";
  if (["south", "below", "down"].includes(value)) return "south";
  return null;
}

function normalizedDirections(options = {}) {
  const explicit = options.directions ?? options.signalDirections;
  if (explicit && typeof explicit === "object") {
    return {
      north: explicit.north || NOWHERE,
      east: explicit.east || NOWHERE,
      south: explicit.south || NOWHERE,
      west: explicit.west || NOWHERE
    };
  }
  return parseSignalDirections(options.signalFrom ?? "nowhere", options.signalTo ?? "east");
}

function normalizedPointerAngle(value) {
  const number = Number(value);
  return Math.max(1, Math.min(179, Number.isFinite(number) ? number : 90));
}

function pointerTangent(pointerAngle) {
  return Math.tan(((90 - pointerAngle / 2) * Math.PI) / 180);
}

function polygonRayHit(points, direction) {
  const hits = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) <= 1e-12) continue;
    const t = cross(a, edge) / denominator;
    const u = cross(a, direction) / denominator;
    if (t >= -1e-9 && u >= -1e-9 && u <= 1 + 1e-9) {
      hits.push({ t, a, b, point: { x: direction.x * t, y: direction.y * t } });
    }
  }
  hits.sort((left, right) => left.t - right.t);
  return hits[0] || null;
}

function polygonMiterOffsetPoints(points, distance) {
  if (!Array.isArray(points) || points.length < 3 || distance <= 1e-12) {
    return (points || []).map((point) => ({ ...point }));
  }
  const clockwise = polygonSignedArea(points) < 0;
  return points.map((vertex, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousEdge = { x: vertex.x - previous.x, y: vertex.y - previous.y };
    const nextEdge = { x: next.x - vertex.x, y: next.y - vertex.y };
    const previousNormal = polygonOutwardNormal(previousEdge, clockwise);
    const nextNormal = polygonOutwardNormal(nextEdge, clockwise);
    if (!previousNormal || !nextNormal) return { ...vertex };
    const previousOffset = {
      x: vertex.x + previousNormal.x * distance,
      y: vertex.y + previousNormal.y * distance
    };
    const nextOffset = {
      x: vertex.x + nextNormal.x * distance,
      y: vertex.y + nextNormal.y * distance
    };
    return lineIntersection(previousOffset, previousEdge, nextOffset, nextEdge) || { ...vertex };
  });
}

function polygonOutwardNormal(edge, clockwise) {
  const length = Math.hypot(edge.x, edge.y);
  if (length <= 1e-12) return null;
  return clockwise
    ? { x: -edge.y / length, y: edge.x / length }
    : { x: edge.y / length, y: -edge.x / length };
}

function lineIntersection(firstPoint, firstDirection, secondPoint, secondDirection) {
  const denominator = cross(firstDirection, secondDirection);
  if (Math.abs(denominator) <= 1e-12) return null;
  const delta = { x: secondPoint.x - firstPoint.x, y: secondPoint.y - firstPoint.y };
  const t = cross(delta, secondDirection) / denominator;
  return {
    x: firstPoint.x + firstDirection.x * t,
    y: firstPoint.y + firstDirection.y * t
  };
}

function polygonSignedArea(points) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function round(value) {
  return Math.round(value * 1e9) / 1e9;
}

function roundPoint(point) {
  return { x: round(point.x), y: round(point.y) };
}
