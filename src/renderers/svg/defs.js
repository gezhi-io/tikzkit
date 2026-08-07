import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPathData } from "./pathData.js";
import {
  axisGradientId,
  ballGradientId,
  mindmapConnectionGradientId,
  mixPaint,
  pathFadingGradientId,
  pathFadingIsRadial,
  pathFadingMaskId,
  pathFadingName,
  patternId,
  patternPathData,
  radialGradientId,
  svgPaint
} from "./style.js";

export function createSvgDefs(parts = []) {
  const body = parts.filter(Boolean).join("");
  return body ? `<defs>${body}</defs>` : "";
}

export function collectSvgDefs(items, unit) {
  const clipRectDefs = collectClipRectDefs(items);
  const clipCircleDefs = collectClipCircleDefs(items);
  const patternDefs = collectPatternDefs(items);
  const formOnlyPatternClipDefs = collectFormOnlyPatternClipDefs(items);
  const ballGradientDefs = collectBallGradientDefs(items);
  const axisGradientDefs = collectAxisGradientDefs(items);
  const radialGradientDefs = collectRadialGradientDefs(items);
  const mindmapConnectionGradientDefs = collectMindmapConnectionGradientDefs(items, unit);
  const pathFadingDefs = collectPathFadingDefs(items);
  const blurShadowDefs = collectBlurShadowDefs(items, unit);
  return [
    ...clipRectDefs.map((def) => renderClipRectDef(def, unit)),
    ...clipCircleDefs.map((def) => renderClipCircleDef(def, unit)),
    ...formOnlyPatternClipDefs.map((def) => renderFormOnlyPatternClipDef(def, unit)),
    ...patternDefs.map((def) => renderPatternDef(def, unit)),
    ...ballGradientDefs.map(renderBallGradientDef),
    ...axisGradientDefs.map(renderAxisGradientDef),
    ...radialGradientDefs.map(renderRadialGradientDef),
    ...mindmapConnectionGradientDefs.map(renderMindmapConnectionGradientDef),
    ...pathFadingDefs.flatMap(renderPathFadingDefs),
    ...blurShadowDefs.map(renderBlurShadowFilterDef)
  ];
}

export function collectMindmapConnectionGradientDefs(items = [], unit = 1) {
  const defs = new Map();
  for (const item of items || []) {
    const connection = item?.style?.mindmapConnection;
    const commands = item?.commands || [];
    const start = commands.find((command) => command?.type === "moveTo");
    const end = [...commands].reverse().find((command) => ["lineTo", "curveTo", "quadTo", "moveTo"].includes(command?.type));
    if (!connection || !start || !end) continue;
    const fromPoint = connection.fromPoint || start;
    const toPoint = connection.toPoint || end;
    const id = mindmapConnectionGradientId(item.style);
    defs.set(id, {
      id,
      from: connection.from,
      to: connection.to,
      x1: (Number(fromPoint.x) || 0) * unit,
      y1: -(Number(fromPoint.y) || 0) * unit,
      x2: (Number(toPoint.x) || 0) * unit,
      y2: -(Number(toPoint.y) || 0) * unit
    });
  }
  return [...defs.values()];
}

export function renderMindmapConnectionGradientDef(def) {
  return `<linearGradient id="${escapeAttribute(def.id)}" gradientUnits="userSpaceOnUse" x1="${format(def.x1)}" y1="${format(def.y1)}" x2="${format(def.x2)}" y2="${format(def.y2)}"><stop offset="0%" stop-color="${escapeAttribute(svgPaint(def.from || "black"))}" /><stop offset="100%" stop-color="${escapeAttribute(svgPaint(def.to || "black"))}" /></linearGradient>`;
}

export function formOnlyPatternClipId(index) {
  return `tikz-form-pattern-clip-${index}`;
}

function collectFormOnlyPatternClipDefs(items = []) {
  return items.flatMap((item, index) => {
    if (!item?.style?.patternDefinition || !Array.isArray(item.commands) || !item.commands.length) return [];
    return [{ id: formOnlyPatternClipId(index), commands: item.commands, fillRule: item.style.fillRule }];
  });
}

function renderFormOnlyPatternClipDef(def, unit) {
  const fillRule = def.fillRule ? ` clip-rule="${escapeAttribute(String(def.fillRule))}"` : "";
  return `<clipPath id="${escapeAttribute(def.id)}" clipPathUnits="userSpaceOnUse"><path d="${svgPathData(def.commands, unit)}"${fillRule} /></clipPath>`;
}

export function clipRectId(clipRect = {}) {
  return `tikzkit-clip-${[clipRect.minX, clipRect.minY, clipRect.maxX, clipRect.maxY]
    .map((value) => String(Math.round((Number(value) || 0) * 1e6)))
    .join("-")}`;
}

export function clipCircleId(clipCircle = {}) {
  return `tikzkit-clip-circle-${[clipCircle.x, clipCircle.y, clipCircle.radius]
    .map((value) => String(Math.round((Number(value) || 0) * 1e6)))
    .join("-")}`;
}

export function collectClipRectDefs(items = []) {
  const defs = new Map();
  for (const item of items) {
    if (!item?.clipRect) continue;
    const id = clipRectId(item.clipRect);
    defs.set(id, { id, clipRect: item.clipRect });
  }
  return [...defs.values()];
}

export function collectClipCircleDefs(items = []) {
  const defs = new Map();
  for (const item of items) {
    if (!item?.clipCircle) continue;
    const id = clipCircleId(item.clipCircle);
    defs.set(id, { id, clipCircle: item.clipCircle });
  }
  return [...defs.values()];
}

export function renderClipRectDef(def, unit) {
  const rect = def.clipRect || {};
  const minX = Number(rect.minX) || 0;
  const minY = Number(rect.minY) || 0;
  const maxX = Number(rect.maxX) || 0;
  const maxY = Number(rect.maxY) || 0;
  return `<clipPath id="${escapeAttribute(def.id)}" clipPathUnits="userSpaceOnUse"><rect x="${format(
    minX * unit
  )}" y="${format(-maxY * unit)}" width="${format((maxX - minX) * unit)}" height="${format(
    (maxY - minY) * unit
  )}" /></clipPath>`;
}

export function renderClipCircleDef(def, unit) {
  const circle = def.clipCircle || {};
  const x = Number(circle.x) || 0;
  const y = Number(circle.y) || 0;
  const radius = Math.max(0, Number(circle.radius) || 0);
  return `<clipPath id="${escapeAttribute(def.id)}" clipPathUnits="userSpaceOnUse"><circle cx="${format(x * unit)}" cy="${format(-y * unit)}" r="${format(radius * unit)}" /></clipPath>`;
}

export function collectPatternDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (!item.style?.pattern) continue;
    const id = patternId(item.style);
    defs.set(id, {
      id,
      kind: String(item.style.pattern).trim(),
      color: item.style.patternColor || item.style.stroke || "black",
      definition: item.style.patternDefinition || null
    });
  }
  return [...defs.values()];
}

export function renderPatternDef(def, unit = 1) {
  const color = escapeAttribute(svgPaint(def.color || "black"));
  const custom = renderDeclaredPatternDef(def, color, unit);
  if (custom) return custom;
  const path = patternPathData(def.kind);
  return `<pattern id="${escapeAttribute(def.id)}" patternUnits="userSpaceOnUse" width="8" height="8"><path d="${path}" stroke="${color}" stroke-width="0.7" fill="none" /></pattern>`;
}

function renderDeclaredPatternDef(def, color, unit) {
  const declaration = def.definition;
  if (!declaration || (!Array.isArray(declaration.commands) && !Array.isArray(declaration.operations))) return "";
  const width = Number(declaration.tileSize?.x) * unit;
  const height = Number(declaration.tileSize?.y) * unit;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "";
  const lineWidth = Math.max(0, Number(declaration.lineWidth) || 0) * unit;
  const operations = declaration.operations?.length
    ? declaration.operations
    : declaration.commands?.length
      ? [{ kind: "path", commands: declaration.commands, stroke: true, fill: false }]
      : [];
  if (!operations.length) return "";
  const bounds = {
    lowerLeft: declaration.lowerLeft || { x: 0, y: 0 },
    upperRight: declaration.upperRight || declaration.lowerLeft || { x: 0, y: 0 }
  };
  const content = operations.map((operation) => renderDeclaredPatternOperation(
    operation,
    color,
    lineWidth || 0.7,
    bounds,
    unit
  )).join("");
  // A PGF form-only pattern stores path coordinates in the canvas coordinate
  // system, but its bounding box determines the pattern viewport. SVG child
  // coordinates are local to that viewport, so map x from lower-left and y
  // from upper-right while retaining tileSize solely as the repetition vector.
  const originX = (Number(bounds.lowerLeft.x) || 0) * unit;
  const originY = -(Number(bounds.upperRight.y) || 0) * unit;
  return `<pattern id="${escapeAttribute(def.id)}" patternUnits="userSpaceOnUse" x="${format(originX)}" y="${format(originY)}" width="${format(width)}" height="${format(height)}" overflow="visible">${content}</pattern>`;
}

function renderDeclaredPatternOperation(operation, color, lineWidth, bounds, unit) {
  const lowerLeftX = Number(bounds.lowerLeft?.x) || 0;
  const upperRightY = Number(bounds.upperRight?.y) || 0;
  const localX = (value) => ((Number(value) || 0) - lowerLeftX) * unit;
  const localY = (value) => (upperRightY - (Number(value) || 0)) * unit;
  const commands = Array.isArray(operation.commands) ? operation.commands : [];
  const paths = commands.filter((command) => ["move", "line", "close"].includes(command.kind));
  const circles = commands.filter((command) => command.kind === "circle");
  const rectangles = commands.filter((command) => command.kind === "rectangle");
  const paint = patternPaintAttributes(operation, color, lineWidth);
  const output = [];
  if (paths.length) {
    const data = paths.map((command) => {
      if (command.kind === "close") return "Z";
      return `${command.kind === "move" ? "M" : "L"} ${format(localX(command.x))} ${format(localY(command.y))}`;
    }).join(" ");
    output.push(`<path d="${data}"${paint} />`);
  }
  for (const circle of circles) {
    output.push(`<circle cx="${format(localX(circle.x))}" cy="${format(localY(circle.y))}" r="${format(Math.max(0, Number(circle.radius) || 0) * unit)}"${paint} />`);
  }
  for (const rectangle of rectangles) {
    const width = Math.max(0, Number(rectangle.width) || 0) * unit;
    const height = Math.max(0, Number(rectangle.height) || 0) * unit;
    output.push(`<rect x="${format(localX(rectangle.x))}" y="${format(localY((Number(rectangle.y) || 0) + (Number(rectangle.height) || 0)))}" width="${format(width)}" height="${format(height)}"${paint} />`);
  }
  return output.join("");
}

function patternPaintAttributes(operation, color, lineWidth) {
  const fill = operation.fill ? color : "none";
  const stroke = operation.stroke ? color : "none";
  const strokeWidth = operation.stroke ? ` stroke-width="${format(lineWidth)}"` : "";
  return ` fill="${fill}" stroke="${stroke}"${strokeWidth}`;
}

export function collectBallGradientDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (item.style?.shading !== "ball") continue;
    const id = ballGradientId(item.style);
    defs.set(id, {
      id,
      color: item.style.ballColor || item.style.fill || "gray"
    });
  }
  return [...defs.values()];
}

export function renderBallGradientDef(def) {
  const base = svgPaint(def.color || "gray");
  const stops = [
    { offset: 0, color: mixPaint(base, "white", 0.15) },
    { offset: 36, color: mixPaint(base, "white", 0.75) },
    { offset: 72, color: mixPaint(base, "black", 0.7) },
    { offset: 100, color: mixPaint(base, "black", 0.5) }
  ];
  return `<radialGradient id="${escapeAttribute(
    def.id
  )}" cx="50%" cy="50%" r="70%" fx="30%" fy="30%">${stops
    .map((stop) => `<stop offset="${format(stop.offset)}%" stop-color="${escapeAttribute(stop.color)}" />`)
    .join("")}</radialGradient>`;
}

export function collectAxisGradientDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (item.style?.shading !== "axis") continue;
    const id = axisGradientId(item.style);
    defs.set(id, {
      id,
      topColor: item.style.topColor || "white",
      middleColor: item.style.middleColor || "gray",
      bottomColor: item.style.bottomColor || item.style.fill || "black",
      shadingAngle: item.style.shadingAngle ?? 0
    });
  }
  return [...defs.values()];
}

export function renderAxisGradientDef(def) {
  const top = svgPaint(def.topColor || "white");
  const middle = svgPaint(def.middleColor || "gray");
  const bottom = svgPaint(def.bottomColor || "black");
  const angle = Number(def.shadingAngle);
  const radians = (Number.isFinite(angle) ? angle : 0) * Math.PI / 180;
  // PGF's unrotated axis shading runs from bottom to top. pgfshadepath maps
  // the path bounds onto the declaration's central 25%-75% interval, so the
  // effective path fill interpolates bottom -> middle -> top without the
  // declaration's outer flat-color margins. Expand along the projected
  // diagonal so the same mapping covers every rotated path corner.
  const directionX = -Math.sin(radians);
  const directionY = -Math.cos(radians);
  const halfSpan = (Math.abs(directionX) + Math.abs(directionY)) / 2;
  const x1 = 50 - directionX * halfSpan * 100;
  const y1 = 50 - directionY * halfSpan * 100;
  const x2 = 50 + directionX * halfSpan * 100;
  const y2 = 50 + directionY * halfSpan * 100;
  return `<linearGradient id="${escapeAttribute(def.id)}" x1="${format(x1)}%" y1="${format(y1)}%" x2="${format(x2)}%" y2="${format(y2)}%"><stop offset="0%" stop-color="${escapeAttribute(
    bottom
  )}" /><stop offset="50%" stop-color="${escapeAttribute(middle)}" /><stop offset="100%" stop-color="${escapeAttribute(top)}" /></linearGradient>`;
}

export function collectRadialGradientDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (item.style?.shading !== "radial") continue;
    const id = radialGradientId(item.style);
    defs.set(id, {
      id,
      stops: Array.isArray(item.style.radialStops) ? item.style.radialStops : []
    });
  }
  return [...defs.values()];
}

export function renderRadialGradientDef(def) {
  const stops = def.stops.length
    ? def.stops
    : [
        { offset: 0, color: "white", opacity: 1 },
        { offset: 1, color: "black", opacity: 1 }
      ];
  const stopElements = stops.map((stop) => {
    const offset = `${format(Math.max(0, Math.min(1, Number(stop.offset) || 0)) * 100)}%`;
    const color = escapeAttribute(svgPaint(stop.color || "black"));
    const opacity = Math.max(0, Math.min(1, Number(stop.opacity ?? 1)));
    return `<stop offset="${offset}" stop-color="${color}" stop-opacity="${format(opacity)}" />`;
  });
  return `<radialGradient id="${escapeAttribute(def.id)}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">${stopElements.join("")}</radialGradient>`;
}

export function collectPathFadingDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    const styles = [item.style, ...(item.shadows || []).map((shadow) => shadow?.style)];
    for (const style of styles) {
      const fading = pathFadingName(style?.pathFading);
      if (fading) defs.set(fading, { name: fading });
    }
  }
  return [...defs.values()];
}

export function renderPathFadingDefs(def) {
  const gradientId = pathFadingGradientId(def.name);
  const maskId = pathFadingMaskId(def.name);
  const stops = pathFadingStops(def.name)
    .map(
      (stop) =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}" />`
    )
    .join("");
  const gradient = pathFadingIsRadial(def.name)
    // PGF declares these gradients with a 50bp source radius, then maps that
    // source square across the current path's full bounding box. The explicit
    // object-bounding-box radius of one makes PGF's 50% stop reach a circle's
    // boundary; SVG percentage radii use different normalization rules.
    ? `<radialGradient id="${escapeAttribute(gradientId)}" gradientUnits="objectBoundingBox" cx="0.5" cy="0.5" r="1">${stops}</radialGradient>`
    : (() => {
        const axis = pathFadingAxis(def.name);
        return `<linearGradient id="${escapeAttribute(gradientId)}" x1="${axis.x1}" y1="${axis.y1}" x2="${axis.x2}" y2="${axis.y2}">${stops}</linearGradient>`;
      })();
  const mask = `<mask id="${escapeAttribute(maskId)}" maskContentUnits="objectBoundingBox"><rect x="0" y="0" width="1" height="1" fill="url(#${escapeAttribute(
    gradientId
  )})" /></mask>`;
  return [gradient, mask];
}

export function collectBlurShadowDefs(items, unit) {
  const defs = new Map();
  for (const item of items || []) {
    for (const shadow of item.shadows || []) {
      if (!shadow.blur) continue;
      const id = blurShadowFilterId(shadow);
      defs.set(id, { id, stdDeviation: blurShadowStdDeviation(shadow.blurRadius, unit) });
    }
  }
  return [...defs.values()];
}

export function blurShadowStdDeviation(blurRadius, unit) {
  const radius = Math.max(0, (Number(blurRadius) || 0.06) * unit);
  // pgf-blur reserves exactly 2r around the source path. A Gaussian reaches
  // its practical edge at three standard deviations, hence sigma = 2r / 3.
  return Math.max(0.5, (radius * 2) / 3);
}

export function blurShadowBoundsPadding(blurRadius) {
  return Math.max(0, (Number(blurRadius) || 0.06) * 2);
}

export function renderBlurShadowFilterDef(def) {
  return `<filter id="${escapeAttribute(def.id)}" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="${format(
    def.stdDeviation
  )}" /></filter>`;
}

export function blurShadowFilterId(shadow = {}) {
  const radius = Math.max(1, Math.round((Number(shadow.blurRadius) || 0.06) * 1000));
  return `tikzkit-blur-shadow-${radius}`;
}

function pathFadingAxis(name) {
  if (name === "north" || name === "south") return { x1: "0%", y1: "0%", x2: "0%", y2: "100%" };
  return { x1: "0%", y1: "0%", x2: "100%", y2: "0%" };
}

function pathFadingStops(name) {
  if (name === "circle with fuzzy edge 10 percent") {
    return [
      { offset: "0%", color: "white" },
      { offset: "45%", color: "white" },
      { offset: "50%", color: "black" },
      { offset: "100%", color: "black" }
    ];
  }
  if (name === "circle with fuzzy edge 15 percent") {
    return [
      { offset: "0%", color: "white" },
      { offset: "42.5%", color: "white" },
      { offset: "50%", color: "black" },
      { offset: "100%", color: "black" }
    ];
  }
  if (name === "circle with fuzzy edge 20 percent") {
    return [
      { offset: "0%", color: "white" },
      { offset: "40%", color: "white" },
      { offset: "50%", color: "black" },
      { offset: "100%", color: "black" }
    ];
  }
  if (name === "fuzzy ring 15 percent") {
    return [
      { offset: "0%", color: "black" },
      { offset: "42.5%", color: "black" },
      { offset: "46.25%", color: "white" },
      { offset: "50%", color: "black" },
      { offset: "100%", color: "black" }
    ];
  }
  if (name === "west" || name === "north") {
    return [
      { offset: "0%", color: "black" },
      { offset: "25%", color: "black" },
      { offset: "75%", color: "white" },
      { offset: "100%", color: "white" }
    ];
  }
  return [
    { offset: "0%", color: "white" },
    { offset: "25%", color: "white" },
    { offset: "75%", color: "black" },
    { offset: "100%", color: "black" }
  ];
}
