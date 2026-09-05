import { parseOptions, stripOuterBraces } from "../../engine/options.js";
import { evaluateMath, parseDimension, roundNumber } from "../../engine/math.js";

export const tikzLibrary = {
  "name": "plotmarks",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/plotmarks.js:parsePgfPlotMarkDeclaration/collectPgfPlotMarkDeclarations/customPlotMarkOperations/placePlotMarkCommands/plotMarkLocalOptions/transformPlotMarkCommands/textPlotMarkModel/textPlotMarkNodeOptions/basicPlotMarkGeometry/splitFillPlotMarkGeometry/placePlotMarkGeometry/plotMarkGeometryCommands + src/frontend/parser.js + src/frontend/latex-shell.js + src/pgfplots/axisTikzLowering.js + src/pgfplots/marks.js:renderPlotMark + src/engine/evaluate.js:addPlotMarkItems/buildPlotMark",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplothandlers.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplotmarks.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-plot-handlers.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-plots.tex",
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
    "mark scale/xscale/yscale/rotate/xshift/yshift/xslant/yslant",
    "custom \\pgfdeclareplotmark path declarations in TikZ and PGFPlots"
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
    "mark scale/xscale/yscale/rotate/xshift/yshift/xslant/yslant",
    "custom \\pgfdeclareplotmark path declarations in TikZ and PGFPlots"
  ],
  "notes": "Reviewed locally on 2026-09-06 against pgflibraryplothandlers.code.tex, pgflibraryplotmarks.code.tex, pgfmanual-en-library-plot-handlers.tex, pgfmanual-en-tikz-plots.tex, tikz.code.tex, pgfcoretransformations.code.tex, pgfplots.markers.code.tex, and pgfmanual-en-library-plot-marks.tex. Shared geometry covers the source-defined asterisk, five-ray star, 10-pointed star, oplus/otimes, vertical/horizontal bar, square, triangle, 0.75-width diamond, pentagon, split marks, and heart paths. Text marks preserve arbitrary TeX content and current color. General marks resolve local paint and ordered transforms in direct TikZ and PGFPlots, including legends. Custom \\pgfdeclareplotmark names now register and execute a bounded PGF path vocabulary: move/line/cubic/circle/ellipse/rectangle/close, origin/cartesian/polar/add/diff/scale points, \\pgfplotmarksize scalar products, and stroke/fill/fillstroke actions. Arbitrary TeX programs, conditionals, register assignments, clipping, low-level transform/color/line-state commands, document-order declaration scoping, and non-uniform affine halfcircle arc conversion remain partial."
};

const CIRCLE_KAPPA = 0.5522847498307936;

export function parsePgfPlotMarkDeclaration(source, start = 0) {
  const text = String(source || "");
  const command = "\\pgfdeclareplotmark";
  if (!text.startsWith(command, start)) return null;
  let cursor = skipPlotMarkWhitespace(text, start + command.length);
  const name = extractPlotMarkGroup(text, cursor);
  if (!name) return null;
  cursor = skipPlotMarkWhitespace(text, name.end);
  const body = extractPlotMarkGroup(text, cursor);
  if (!body) return null;
  return {
    statement: {
      type: "pgfdeclareplotmark",
      name: name.content.trim(),
      body: body.content,
      raw: text.slice(start, body.end)
    },
    end: body.end
  };
}

export function collectPgfPlotMarkDeclarations(source) {
  const declarations = {};
  const text = String(source || "");
  const command = "\\pgfdeclareplotmark";
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf(command, cursor);
    if (start < 0) break;
    const parsed = parsePgfPlotMarkDeclaration(text, start);
    if (!parsed) {
      cursor = start + command.length;
      continue;
    }
    const name = normalizePlotMarkName(parsed.statement.name);
    if (name) declarations[name] = parsed.statement;
    cursor = parsed.end;
  }
  return declarations;
}

export function customPlotMarkOperations(mark, declarations = {}, size = parseDimension("2pt", {}), variables = {}) {
  const declaration = declarations?.[normalizePlotMarkName(mark)];
  if (!declaration) return null;
  const source = String(declaration.body || "");
  const localVariables = { ...(variables || {}), pgfplotmarksize: size };
  const operations = [];
  let pending = [];
  const commandPattern = /\\(pgfpathcurveto|pgfpathmoveto|pgfpathlineto|pgfpathcircle|pgfpathellipse|pgfpathrectangle|pgfpathclose|pgfusepathqfillstroke|pgfusepathqstroke|pgfusepathqfill|pgfusepath)\b/g;
  let match;
  while ((match = commandPattern.exec(source))) {
    const kind = match[1];
    let cursor = commandPattern.lastIndex;
    if (kind === "pgfpathclose") {
      pending.push({ type: "closePath" });
      continue;
    }
    if (kind.startsWith("pgfusepathq")) {
      const action = kind.slice("pgfusepathq".length);
      flushCustomPlotMarkPath(operations, pending, action);
      pending = [];
      continue;
    }
    if (kind === "pgfusepath") {
      const group = extractPlotMarkGroup(source, skipPlotMarkWhitespace(source, cursor));
      if (!group) continue;
      const actions = group.content.toLowerCase();
      const action = actions.includes("fill") && actions.includes("stroke")
        ? "fillstroke"
        : actions.includes("fill")
          ? "fill"
          : "stroke";
      flushCustomPlotMarkPath(operations, pending, action);
      pending = [];
      commandPattern.lastIndex = group.end;
      continue;
    }
    const requiredGroups = kind === "pgfpathcurveto" || kind === "pgfpathellipse"
      ? 3
      : kind === "pgfpathcircle" || kind === "pgfpathrectangle"
        ? 2
        : 1;
    const groups = [];
    for (let index = 0; index < requiredGroups; index += 1) {
      const group = extractPlotMarkGroup(source, skipPlotMarkWhitespace(source, cursor));
      if (!group) break;
      groups.push(group.content);
      cursor = group.end;
    }
    if (groups.length !== requiredGroups) continue;
    if (kind === "pgfpathmoveto" || kind === "pgfpathlineto") {
      const point = parsePlotMarkPoint(groups[0], size, localVariables);
      if (point) pending.push({ type: kind === "pgfpathmoveto" ? "moveTo" : "lineTo", ...point });
    } else if (kind === "pgfpathcurveto") {
      const points = groups.map((group) => parsePlotMarkPoint(group, size, localVariables));
      if (points.every(Boolean)) {
        pending.push({
          type: "curveTo",
          x1: points[0].x,
          y1: points[0].y,
          x2: points[1].x,
          y2: points[1].y,
          x: points[2].x,
          y: points[2].y
        });
      }
    } else if (kind === "pgfpathcircle") {
      const center = parsePlotMarkPoint(groups[0], size, localVariables);
      const radius = parsePlotMarkDimension(groups[1], size, localVariables);
      if (center && Number.isFinite(radius) && radius >= 0) pending.push(...plotMarkCircleCommands(center, radius));
    } else if (kind === "pgfpathellipse") {
      const center = parsePlotMarkPoint(groups[0], size, localVariables);
      const xAxis = parsePlotMarkPoint(groups[1], size, localVariables);
      const yAxis = parsePlotMarkPoint(groups[2], size, localVariables);
      if (center && xAxis && yAxis) pending.push(...plotMarkEllipseCommands(center, xAxis, yAxis));
    } else if (kind === "pgfpathrectangle") {
      const origin = parsePlotMarkPoint(groups[0], size, localVariables);
      const dimensions = parsePlotMarkPoint(groups[1], size, localVariables);
      if (origin && dimensions) pending.push(...plotMarkRectangleCommands(origin, dimensions));
    }
    commandPattern.lastIndex = cursor;
  }
  if (pending.length) flushCustomPlotMarkPath(operations, pending, "stroke");
  return operations;
}

export function placePlotMarkCommands(commands = [], center = { x: 0, y: 0 }) {
  return commands.map((command) => {
    const placed = { ...command };
    for (const [xKey, yKey] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) {
      if (!Number.isFinite(command[xKey]) || !Number.isFinite(command[yKey])) continue;
      placed[xKey] = roundNumber(center.x + command[xKey]);
      placed[yKey] = roundNumber(center.y + command[yKey]);
    }
    return placed;
  });
}

function flushCustomPlotMarkPath(operations, commands, action) {
  if (!commands.length) return;
  operations.push({
    commands: commands.map((command) => ({ ...command })),
    stroke: action === "stroke" || action === "fillstroke",
    fill: action === "fill" || action === "fillstroke"
  });
}

function parsePlotMarkPoint(value, size, variables) {
  const text = stripOuterBraces(String(value || "").trim());
  if (text === "\\pgfpointorigin") return { x: 0, y: 0 };
  for (const command of ["pgfpointadd", "pgfpointdiff"]) {
    const prefix = `\\${command}`;
    if (!text.startsWith(prefix)) continue;
    let cursor = skipPlotMarkWhitespace(text, prefix.length);
    const first = extractPlotMarkGroup(text, cursor);
    if (!first) return null;
    cursor = skipPlotMarkWhitespace(text, first.end);
    const second = extractPlotMarkGroup(text, cursor);
    if (!second) return null;
    const a = parsePlotMarkPoint(first.content, size, variables);
    const b = parsePlotMarkPoint(second.content, size, variables);
    if (!a || !b) return null;
    const sign = command === "pgfpointdiff" ? -1 : 1;
    return { x: roundNumber(a.x + sign * b.x), y: roundNumber(a.y + sign * b.y) };
  }
  if (text.startsWith("\\pgfpointscale")) {
    let cursor = skipPlotMarkWhitespace(text, "\\pgfpointscale".length);
    const factor = extractPlotMarkGroup(text, cursor);
    if (!factor) return null;
    cursor = skipPlotMarkWhitespace(text, factor.end);
    const point = extractPlotMarkGroup(text, cursor);
    if (!point) return null;
    const resolved = parsePlotMarkPoint(point.content, size, variables);
    const scale = evaluateMath(factor.content, variables);
    return resolved && Number.isFinite(scale)
      ? { x: roundNumber(resolved.x * scale), y: roundNumber(resolved.y * scale) }
      : null;
  }
  const polarMatch = /^\\pgf(?:q)?pointpolar\s*/.exec(text);
  if (polarMatch) {
    let cursor = polarMatch[0].length;
    const angle = extractPlotMarkGroup(text, cursor);
    if (!angle) return null;
    cursor = skipPlotMarkWhitespace(text, angle.end);
    const radius = extractPlotMarkGroup(text, cursor);
    if (!radius) return null;
    const radians = evaluateMath(angle.content, variables) * Math.PI / 180;
    const length = parsePlotMarkDimension(radius.content, size, variables);
    return { x: roundNumber(Math.cos(radians) * length), y: roundNumber(Math.sin(radians) * length) };
  }
  const pointMatch = /^\\pgf(?:q)?point(?![A-Za-z])\s*/.exec(text);
  if (pointMatch) {
    let cursor = pointMatch[0].length;
    const x = extractPlotMarkGroup(text, cursor);
    if (!x) return null;
    cursor = skipPlotMarkWhitespace(text, x.end);
    const y = extractPlotMarkGroup(text, cursor);
    if (!y) return null;
    return {
      x: parsePlotMarkDimension(x.content, size, variables),
      y: parsePlotMarkDimension(y.content, size, variables)
    };
  }
  return null;
}

function parsePlotMarkDimension(value, size, variables) {
  let text = stripOuterBraces(String(value || "").trim());
  text = text.replace(/([0-9.)])\s*(\\pgfplotmarksize\b)/g, "$1*$2");
  text = text.replace(/\\pgfplotmarksize\b/g, `(${size})`);
  text = text.replace(/\bsp\b/g, "pt/65536");
  return roundNumber(parseDimension(text, variables));
}

function plotMarkCircleCommands(center, radius) {
  return plotMarkEllipseCommands(center, { x: radius, y: 0 }, { x: 0, y: radius });
}

function plotMarkEllipseCommands(center, xAxis, yAxis) {
  const point = (xFactor, yFactor) => ({
    x: roundNumber(center.x + xAxis.x * xFactor + yAxis.x * yFactor),
    y: roundNumber(center.y + xAxis.y * xFactor + yAxis.y * yFactor)
  });
  const start = point(1, 0);
  const top = point(0, 1);
  const left = point(-1, 0);
  const bottom = point(0, -1);
  return [
    { type: "moveTo", ...start },
    { type: "curveTo", ...plotMarkCurveFields(point(1, CIRCLE_KAPPA), point(CIRCLE_KAPPA, 1), top) },
    { type: "curveTo", ...plotMarkCurveFields(point(-CIRCLE_KAPPA, 1), point(-1, CIRCLE_KAPPA), left) },
    { type: "curveTo", ...plotMarkCurveFields(point(-1, -CIRCLE_KAPPA), point(-CIRCLE_KAPPA, -1), bottom) },
    { type: "curveTo", ...plotMarkCurveFields(point(CIRCLE_KAPPA, -1), point(1, -CIRCLE_KAPPA), start) },
    { type: "closePath" }
  ];
}

function plotMarkCurveFields(first, second, end) {
  return { x1: first.x, y1: first.y, x2: second.x, y2: second.y, x: end.x, y: end.y };
}

function plotMarkRectangleCommands(origin, dimensions) {
  return [
    { type: "moveTo", x: origin.x, y: origin.y },
    { type: "lineTo", x: roundNumber(origin.x + dimensions.x), y: origin.y },
    { type: "lineTo", x: roundNumber(origin.x + dimensions.x), y: roundNumber(origin.y + dimensions.y) },
    { type: "lineTo", x: origin.x, y: roundNumber(origin.y + dimensions.y) },
    { type: "closePath" }
  ];
}

function normalizePlotMarkName(name) {
  return stripOuterBraces(String(name || "")).trim().toLowerCase();
}

function skipPlotMarkWhitespace(source, start) {
  let cursor = start;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function extractPlotMarkGroup(source, start) {
  if (source[start] !== "{") return null;
  let depth = 0;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] !== "}") continue;
    depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, cursor), end: cursor + 1 };
    if (depth < 0) return null;
  }
  return null;
}
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
