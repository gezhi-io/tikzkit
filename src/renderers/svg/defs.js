import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import {
  axisGradientId,
  ballGradientId,
  mixPaint,
  pathFadingGradientId,
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
  const patternDefs = collectPatternDefs(items);
  const ballGradientDefs = collectBallGradientDefs(items);
  const axisGradientDefs = collectAxisGradientDefs(items);
  const radialGradientDefs = collectRadialGradientDefs(items);
  const pathFadingDefs = collectPathFadingDefs(items);
  const blurShadowDefs = collectBlurShadowDefs(items, unit);
  return [
    ...clipRectDefs.map((def) => renderClipRectDef(def, unit)),
    ...patternDefs.map(renderPatternDef),
    ...ballGradientDefs.map(renderBallGradientDef),
    ...axisGradientDefs.map(renderAxisGradientDef),
    ...radialGradientDefs.map(renderRadialGradientDef),
    ...pathFadingDefs.flatMap(renderPathFadingDefs),
    ...blurShadowDefs.map(renderBlurShadowFilterDef)
  ];
}

export function clipRectId(clipRect = {}) {
  return `tikzkit-clip-${[clipRect.minX, clipRect.minY, clipRect.maxX, clipRect.maxY]
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

export function collectPatternDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (!item.style?.pattern) continue;
    const id = patternId(item.style);
    defs.set(id, {
      id,
      kind: String(item.style.pattern).trim(),
      color: item.style.patternColor || item.style.stroke || "black"
    });
  }
  return [...defs.values()];
}

export function renderPatternDef(def) {
  const color = escapeAttribute(svgPaint(def.color || "black"));
  const path = patternPathData(def.kind);
  return `<pattern id="${escapeAttribute(def.id)}" patternUnits="userSpaceOnUse" width="8" height="8"><path d="${path}" stroke="${color}" stroke-width="0.7" fill="none" /></pattern>`;
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
      bottomColor: item.style.bottomColor || item.style.fill || "black"
    });
  }
  return [...defs.values()];
}

export function renderAxisGradientDef(def) {
  const top = svgPaint(def.topColor || "white");
  const bottom = svgPaint(def.bottomColor || "black");
  return `<linearGradient id="${escapeAttribute(def.id)}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${escapeAttribute(
    top
  )}" /><stop offset="100%" stop-color="${escapeAttribute(bottom)}" /></linearGradient>`;
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
    const fading = pathFadingName(item.style?.pathFading);
    if (!fading) continue;
    defs.set(fading, { name: fading });
  }
  return [...defs.values()];
}

export function renderPathFadingDefs(def) {
  const gradientId = pathFadingGradientId(def.name);
  const maskId = pathFadingMaskId(def.name);
  const axis = pathFadingAxis(def.name);
  const stops = pathFadingStops(def.name)
    .map(
      (stop) =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}" />`
    )
    .join("");
  const gradient = `<linearGradient id="${escapeAttribute(gradientId)}" x1="${axis.x1}" y1="${axis.y1}" x2="${axis.x2}" y2="${axis.y2}">${stops}</linearGradient>`;
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
      const radius = Math.max(0.8, (Number(shadow.blurRadius) || 0.06) * unit);
      defs.set(id, { id, radius });
    }
  }
  return [...defs.values()];
}

export function renderBlurShadowFilterDef(def) {
  return `<filter id="${escapeAttribute(def.id)}" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="${format(
    def.radius
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
