import { parseOptions, stripOuterBraces } from "../../engine/options.js";
import { evaluateMath, parseDimension, roundNumber } from "../../engine/math.js";

export const tikzLibrary = {
  "name": "plotmarks",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/plotmarks.js:plotMarkLocalOptions/transformPlotMarkCommands/textPlotMarkModel/textPlotMarkNodeOptions/basicPlotMarkGeometry/splitFillPlotMarkGeometry/placePlotMarkGeometry/plotMarkGeometryCommands + src/pgfplots/marks.js:renderPlotMark + src/engine/evaluate.js:addPlotMarkItems/buildPlotMark",
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
    "mark color / mark options and every mark local paint",
    "mark scale/xscale/yscale/rotate/xshift/yshift/xslant/yslant"
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
    "mark color / mark options and every mark local paint",
    "mark scale/xscale/yscale/rotate/xshift/yshift/xslant/yslant"
  ],
  "notes": "Reviewed locally on 2026-09-05 against tikz.code.tex, pgflibraryplothandlers.code.tex, pgfcoretransformations.code.tex, pgfplots.markers.code.tex, pgflibraryplotmarks.code.tex, pgfmanual-en-tikz-plots.tex, and pgfmanual-en-library-plot-marks.tex. Shared geometry covers the source-defined asterisk, five-ray star, 10-pointed star, oplus/otimes, vertical/horizontal bar, square, triangle, 0.75-width diamond, pentagon, halfdiamond*, halfsquare*, halfsquare right*, halfsquare left*, and heart paths. Text marks preserve arbitrary TeX content and current color in direct TikZ and PGFPlots. General non-text marks now resolve mark options and every mark replacement/append semantics, local draw/fill/line styling, and ordered scale/xscale/yscale/rotate/xshift/yshift/xslant/yslant matrices in direct TikZ and PGFPlots, including transformed shifts and legend samples. The heart preserves all eight source cubic segments and its asymmetric tip. The split marks share current-fill/mark-color and outline semantics. Arbitrary custom plot-mark declarations and non-uniform affine halfcircle arc conversion remain partial."
};

const CIRCLE_KAPPA = 0.5522847498307936;
export function plotMarkLocalOptions(options = {}, baseOptions = {}) {
  let local = { ...(baseOptions || {}) };
  for (const [key, value] of Object.entries(options || {})) {
    if (key === "mark options" || key === "every mark/.style") {
      local = parsePlotMarkStyle(value);
      continue;
    }
    if (key === "every mark/.append style") {
      for (const entry of optionValues(value)) {
        local = { ...local, ...parsePlotMarkStyle(entry) };
      }
    }
  }
  return local;
}

export function transformPlotMarkCommands(commands = [], center = { x: 0, y: 0 }, options = {}, variables = {}) {
  const transform = plotMarkTransform(options, variables);
  if (isIdentityPlotMarkTransform(transform)) return commands;
  const place = (x, y) => ({
    x: roundNumber(center.x + transform.a * (x - center.x) + transform.c * (y - center.y) + transform.x),
    y: roundNumber(center.y + transform.b * (x - center.x) + transform.d * (y - center.y) + transform.y)
  });
  return commands.map((command) => {
    const transformed = { ...command };
    for (const [xKey, yKey] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) {
      if (!Number.isFinite(command[xKey]) || !Number.isFinite(command[yKey])) continue;
      const point = place(command[xKey], command[yKey]);
      transformed[xKey] = point.x;
      transformed[yKey] = point.y;
    }
    return transformed;
  });
}

function parsePlotMarkStyle(value) {
  if (value === undefined || value === null || value === true) return {};
  return parseOptions(stripOuterBraces(String(value)));
}

function optionValues(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function plotMarkTransform(options = {}, variables = {}) {
  let current = identityPlotMarkTransform();
  for (const [key, value] of Object.entries(options || {})) {
    const operation = plotMarkTransformOperation(key, value, variables);
    if (operation) current = multiplyPlotMarkTransforms(current, operation);
  }
  return current;
}

function plotMarkTransformOperation(key, value, variables) {
  if (key === "scale" || key === "xscale" || key === "yscale") {
    const parsed = evaluateMath(value ?? 1, variables);
    const scale = Number.isFinite(parsed) ? parsed : 1;
    if (key === "xscale") return { a: scale, b: 0, c: 0, d: 1, x: 0, y: 0 };
    if (key === "yscale") return { a: 1, b: 0, c: 0, d: scale, x: 0, y: 0 };
    return { a: scale, b: 0, c: 0, d: scale, x: 0, y: 0 };
  }
  if (key === "rotate") {
    const parsed = evaluateMath(value ?? 0, variables);
    const radians = ((Number.isFinite(parsed) ? parsed : 0) * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return { a: cosine, b: sine, c: -sine, d: cosine, x: 0, y: 0 };
  }
  if (key === "xshift" || key === "yshift") {
    const shift = parseDimension(value ?? "0pt", variables);
    const amount = Number.isFinite(shift) ? shift : 0;
    return key === "xshift"
      ? { a: 1, b: 0, c: 0, d: 1, x: amount, y: 0 }
      : { a: 1, b: 0, c: 0, d: 1, x: 0, y: amount };
  }
  if (key === "xslant" || key === "yslant") {
    const parsed = evaluateMath(value ?? 0, variables);
    const slant = Number.isFinite(parsed) ? parsed : 0;
    return key === "xslant"
      ? { a: 1, b: 0, c: slant, d: 1, x: 0, y: 0 }
      : { a: 1, b: slant, c: 0, d: 1, x: 0, y: 0 };
  }
  return null;
}

function multiplyPlotMarkTransforms(first, second) {
  return {
    a: first.a * second.a + first.c * second.b,
    b: first.b * second.a + first.d * second.b,
    c: first.a * second.c + first.c * second.d,
    d: first.b * second.c + first.d * second.d,
    x: first.a * second.x + first.c * second.y + first.x,
    y: first.b * second.x + first.d * second.y + first.y
  };
}

function identityPlotMarkTransform() {
  return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
}

function isIdentityPlotMarkTransform(transform) {
  return Math.abs(transform.a - 1) < 1e-12 && Math.abs(transform.b) < 1e-12 &&
    Math.abs(transform.c) < 1e-12 && Math.abs(transform.d - 1) < 1e-12 &&
    Math.abs(transform.x) < 1e-12 && Math.abs(transform.y) < 1e-12;
}

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
