import { parseOptions, stripOuterBraces } from "../../engine/options.js";

export const tikzLibrary = {
  "name": "plotmarks",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/plotmarks.js:textPlotMarkModel/textPlotMarkNodeOptions/basicPlotMarkGeometry/splitFillPlotMarkGeometry/placePlotMarkGeometry/plotMarkGeometryCommands + src/pgfplots/marks.js:renderPlotMark + src/engine/evaluate.js:addPlotMarkItems/buildPlotMark",
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
    "mark=halfdiamond* / halfsquare* / halfsquare right* / halfsquare left*",
    "mark=heart",
    "mark=text / text mark / text mark style / text mark as node",
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
    "mark=halfdiamond* / halfsquare* / halfsquare right* / halfsquare left*",
    "mark=heart",
    "mark=text / text mark / text mark style / text mark as node",
    "mark color / mark options={rotate=...}"
  ],
  "notes": "Reviewed locally on 2026-09-05 against pgflibraryplotmarks.code.tex, pgfmanual-en-library-plot-marks.tex, and pgfmanual-en-base-scopes.tex. Shared geometry covers the source-defined asterisk, five-ray star, 10-pointed star, oplus/otimes, vertical/horizontal bar, square, triangle, 0.75-width diamond, pentagon, halfdiamond*, halfsquare*, halfsquare right*, halfsquare left*, and heart paths. Text marks now preserve arbitrary TeX content and current color in direct TikZ and PGFPlots. The default pgftext mode implements left/right/top/bottom/base anchors and rotate; text mark as node=true delegates draw, fill, shape, rounded corners, inner sep, font, scale, rotate, and anchor to the normal node pipeline. The heart preserves all eight source cubic segments, its 1.75-mark-size tip, independent fill/stroke paint, size, and whole-mark rotation. The split marks share current-fill/mark-color, mark color=none suppression, outline, size, and rotation semantics. Custom plot-mark declarations and general non-text affine mark-option transforms remain partial."
};

const CIRCLE_KAPPA = 0.5522847498307936;

export function textPlotMarkModel(options = {}) {
  const rawText = options["text mark"] ?? "p";
  const rawStyle = options["text mark style"] ?? options["text mark/style"];
  const style = rawStyle === undefined || rawStyle === null || rawStyle === true
    ? {}
    : parseOptions(stripOuterBraces(String(rawStyle)));
  const asNode = tikzBoolean(options["text mark as node"] ?? options["text mark/as node"]);
  return {
    text: rawText === true ? "p" : String(rawText),
    asNode,
    style,
    anchor: asNode ? String(style.anchor || "center") : pgfTextAnchor(style)
  };
}

export function textPlotMarkNodeOptions(model) {
  if (model.asNode) return { ...model.style };
  const options = {
    "inner sep": "0pt",
    "outer sep": "0pt"
  };
  if (model.anchor && model.anchor !== "center") options.anchor = model.anchor;
  if (model.style.rotate !== undefined && model.style.rotate !== true) options.rotate = model.style.rotate;
  return options;
}

function pgfTextAnchor(style = {}) {
  const horizontal = lastPresentKey(style, ["left", "right"]);
  const vertical = lastPresentKey(style, ["top", "bottom", "base"]);
  const horizontalAnchor = horizontal === "left" ? "west" : horizontal === "right" ? "east" : "";
  const verticalAnchor = vertical === "top" ? "north" : vertical === "bottom" ? "south" : vertical === "base" ? "base" : "";
  return [verticalAnchor, horizontalAnchor].filter(Boolean).join(" ") || "center";
}

function lastPresentKey(options, candidates) {
  return Object.keys(options).filter((key) => candidates.includes(key)).at(-1) || "";
}

function tikzBoolean(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true || value === "") return true;
  return !/^(?:false|0|no|off)$/i.test(String(value).trim());
}

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

function cubicPath(start, curves, closed = false) {
  return { type: "cubicPath", start, curves, closed };
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
  if (kind === "heart") {
    const point = (x, y) => ({ x: x * size, y: y * size });
    const curve = (x1, y1, x2, y2, x, y) => ({
      c1: point(x1, y1),
      c2: point(x2, y2),
      to: point(x, y)
    });
    return geometry([cubicPath(point(0, -1.75), [
      curve(0, -1.75, 0, -1.66, -0.5, -1.165),
      curve(-0.5, -1.165, -1, -0.75, -1, 0),
      curve(-1, 0, -1, 0.5825, -0.5825, 0.5825),
      curve(-0.5825, 0.5825, 0, 0.5825, 0, 0),
      curve(0, 0, 0, 0.5825, 0.5825, 0.5825),
      curve(0.5825, 0.5825, 1, 0.5825, 1, 0),
      curve(1, 0, 1, -0.75, 0.5, -1.165),
      curve(0.5, -1.165, 0, -1.66, 0, -1.75)
    ], true)], true);
  }
  return null;
}

export function splitFillPlotMarkGeometry(mark, size) {
  const kind = String(mark || "").trim().toLowerCase();
  if (!["halfdiamond*", "halfsquare*", "halfsquare right*", "halfsquare left*"].includes(kind)) {
    return null;
  }

  const xRadius = kind === "halfdiamond*" ? 0.75 * size : size;
  const top = { x: 0, y: size };
  const right = { x: xRadius, y: 0 };
  const bottom = { x: 0, y: -size };
  const left = { x: -xRadius, y: 0 };
  let primary;
  let secondary;

  if (kind === "halfsquare right*") {
    primary = [bottom, right, top];
    secondary = [bottom, left, top];
  } else if (kind === "halfsquare left*") {
    primary = [bottom, left, top];
    secondary = [bottom, right, top];
  } else {
    primary = [left, bottom, right];
    secondary = [right, top, left];
  }

  const geometry = (points, filled) => ({ kind, primitives: [polygon(points)], filled });
  return {
    kind,
    primary: geometry(primary, true),
    secondary: geometry(secondary, true),
    outline: geometry([right, top, left, bottom], false)
  };
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
    primitives: geometry.primitives.map((primitive) => {
      if (primitive.type === "circle") return { ...primitive, center: { ...center } };
      if (primitive.type === "cubicPath") {
        return {
          ...primitive,
          start: place(primitive.start),
          curves: primitive.curves.map((curve) => ({
            c1: place(curve.c1),
            c2: place(curve.c2),
            to: place(curve.to)
          }))
        };
      }
      return { ...primitive, points: primitive.points.map(place) };
    })
  };
}

export function plotMarkGeometryCommands(geometry, center = { x: 0, y: 0 }, rotation = 0) {
  const placed = placePlotMarkGeometry(geometry, center, rotation);
  return placed.primitives.flatMap((primitive) => {
    if (primitive.type === "cubicPath") {
      return [
        { type: "moveTo", x: primitive.start.x, y: primitive.start.y },
        ...primitive.curves.map((curve) => ({
          type: "curveTo",
          x1: curve.c1.x,
          y1: curve.c1.y,
          x2: curve.c2.x,
          y2: curve.c2.y,
          x: curve.to.x,
          y: curve.to.y
        })),
        ...(primitive.closed ? [{ type: "closePath" }] : [])
      ];
    }
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
