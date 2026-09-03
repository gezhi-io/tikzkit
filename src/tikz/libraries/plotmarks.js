export const tikzLibrary = {
  "name": "plotmarks",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/plotmarks.js:basicPlotMarkGeometry/placePlotMarkGeometry/plotMarkGeometryCommands + src/pgfplots/marks.js:renderPlotMark + src/engine/evaluate.js:buildPlotMark",
  "features": [
    "mark=x",
    "mark=+",
    "mark=*",
    "mark=o",
    "square/triangle/diamond/pentagon open and filled marks",
    "asterisk/star/10-pointed star marks",
    "oplus/otimes open and filled marks",
    "vertical and horizontal bar marks",
    "mark size",
    "mark=halfcircle / halfcircle*",
    "mark color / mark options={rotate=...}"
  ],
  "implements": [
    "mark=x",
    "mark=+",
    "mark=*",
    "mark=o",
    "square/triangle/diamond/pentagon open and filled marks",
    "asterisk/star/10-pointed star marks",
    "oplus/otimes open and filled marks",
    "vertical and horizontal bar marks",
    "mark size",
    "mark=halfcircle / halfcircle*",
    "mark color / mark options={rotate=...}"
  ],
  "notes": "Reviewed locally on 2026-09-04 against pgflibraryplotmarks.code.tex. The shared geometry now covers the source-defined asterisk, five-ray star, 10-pointed star, oplus/otimes, vertical/horizontal bar, square, triangle, 0.75-width diamond, and pentagon paths, including filled variants and mark rotation in both direct TikZ plots and PGFPlots lowering. `mark=halfcircle` paints its lower semicircle white by default or with `mark color`, skips it for `mark color=none`, then strokes a diameter and circle. `mark=halfcircle*` fills its upper half with the plot fill and its lower half with `mark color`, and strokes only the outer circle. Text, halfdiamond, halfsquare, heart, custom declarations, and general mark-option transforms remain partial."
};

const CIRCLE_KAPPA = 0.5522847498307936;

function polarPoint(angle, radius) {
  const radians = angle * Math.PI / 180;
  return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius };
}

function segment(from, to) {
  return { type: "polyline", points: [from, to], closed: false };
}

function polygon(points) {
  return { type: "polyline", points, closed: true };
}

function circle(radius) {
  return { type: "circle", radius };
}

export function basicPlotMarkGeometry(mark, size) {
  const kind = String(mark || "").trim().toLowerCase();
  const origin = { x: 0, y: 0 };
  const radialPoints = (angles) => angles.map((angle) => polarPoint(angle, size));
  const geometry = (primitives, filled = false) => ({ kind, primitives, filled });

  if (kind === "asterisk") {
    return geometry([
      segment({ x: 0, y: -size }, { x: 0, y: size }),
      segment(polarPoint(30, size), polarPoint(210, size)),
      segment(polarPoint(-30, size), polarPoint(150, size))
    ]);
  }
  if (kind === "star") {
    return geometry(radialPoints([90, 18, -54, 234, 162]).map((point) => segment(origin, point)));
  }
  if (kind === "10-pointed star") {
    return geometry([90, 18, -54, 234, 162].map((angle) => segment(polarPoint(angle + 180, size), polarPoint(angle, size))));
  }
  if (kind === "oplus" || kind === "oplus*") {
    return geometry([
      circle(size),
      segment({ x: -size, y: 0 }, { x: size, y: 0 }),
      segment({ x: 0, y: size }, { x: 0, y: -size })
    ], kind.endsWith("*"));
  }
  if (kind === "otimes" || kind === "otimes*") {
    const diagonal = Math.SQRT1_2 * size;
    return geometry([
      circle(size),
      segment({ x: -diagonal, y: -diagonal }, { x: diagonal, y: diagonal }),
      segment({ x: -diagonal, y: diagonal }, { x: diagonal, y: -diagonal })
    ], kind.endsWith("*"));
  }
  if (kind === "|") return geometry([segment({ x: 0, y: size }, { x: 0, y: -size })]);
  if (kind === "-") return geometry([segment({ x: size, y: 0 }, { x: -size, y: 0 })]);
  if (kind === "square" || kind === "square*") {
    return geometry([polygon([
      { x: -size, y: -size },
      { x: size, y: -size },
      { x: size, y: size },
      { x: -size, y: size }
    ])], kind.endsWith("*"));
  }
  if (kind === "triangle" || kind === "triangle*") {
    return geometry([polygon(radialPoints([90, -30, -150]))], kind.endsWith("*"));
  }
  if (kind === "diamond" || kind === "diamond*") {
    return geometry([polygon([
      { x: 0, y: size },
      { x: 0.75 * size, y: 0 },
      { x: 0, y: -size },
      { x: -0.75 * size, y: 0 }
    ])], kind.endsWith("*"));
  }
  if (kind === "pentagon" || kind === "pentagon*") {
    return geometry([polygon(radialPoints([90, 18, -54, 234, 162]))], kind.endsWith("*"));
  }
  return null;
}

export function placePlotMarkGeometry(geometry, center = { x: 0, y: 0 }, rotation = 0) {
  const radians = rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const place = (point) => ({
    x: center.x + point.x * cosine - point.y * sine,
    y: center.y + point.x * sine + point.y * cosine
  });
  return {
    ...geometry,
    primitives: geometry.primitives.map((primitive) => primitive.type === "circle"
      ? { ...primitive, center: { ...center } }
      : { ...primitive, points: primitive.points.map(place) })
  };
}

export function plotMarkGeometryCommands(geometry, center = { x: 0, y: 0 }, rotation = 0) {
  const placed = placePlotMarkGeometry(geometry, center, rotation);
  return placed.primitives.flatMap((primitive) => {
    if (primitive.type !== "circle") {
      const [first, ...rest] = primitive.points;
      return [
        { type: "moveTo", x: first.x, y: first.y },
        ...rest.map((point) => ({ type: "lineTo", x: point.x, y: point.y })),
        ...(primitive.closed ? [{ type: "closePath" }] : [])
      ];
    }
    const { x, y } = primitive.center;
    const radius = primitive.radius;
    const k = CIRCLE_KAPPA * radius;
    return [
      { type: "moveTo", x: x + radius, y },
      { type: "curveTo", x1: x + radius, y1: y + k, x2: x + k, y2: y + radius, x, y: y + radius },
      { type: "curveTo", x1: x - k, y1: y + radius, x2: x - radius, y2: y + k, x: x - radius, y },
      { type: "curveTo", x1: x - radius, y1: y - k, x2: x - k, y2: y - radius, x, y: y - radius },
      { type: "curveTo", x1: x + k, y1: y - radius, x2: x + radius, y2: y - k, x: x + radius, y },
      { type: "closePath" }
    ];
  });
}
