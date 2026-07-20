import { axisNumber } from "./coordinates.js";
import { formatAxisNumber, formatAxisPoint } from "./format.js";

export function renderAxisOverlayStatements(body, ranges, geometry) {
  const commands = [];
  let cursor = 0;
  while (cursor < body.length) {
    const start = findNextAxisOverlayStatementStart(body, cursor);
    if (start === -1) break;
    const end = findStatementEnd(body, start);
    if (end === -1) break;
    const statement = body.slice(start, end + 1);
    commands.push(...lowerAxisOverlayStatement(statement, ranges, geometry));
    cursor = end + 1;
  }
  return commands;
}

function lowerAxisOverlayStatement(statement, ranges, geometry) {
  const ellipse = lowerPgfExtraPathellipse(statement, ranges, geometry);
  if (ellipse) return [ellipse];
  return [transformAxisStatementCoordinates(statement, ranges, geometry)];
}

export function transformAxisStatementCoordinates(statement, ranges, geometry) {
  const resolvedStatement = String(statement).replace(/\\pgfkeysvalueof\s*\{\s*\/pgfplots\/([xyz])\s*(min|max)\s*\}/gi, (_match, axis, bound) => {
    const key = `${axis.toLowerCase()}${bound.toLowerCase() === "min" ? "Min" : "Max"}`;
    return Number.isFinite(ranges[key]) ? String(ranges[key]) : "0";
  });
  const clampCoordinates = !axisOverlayStatementAllowsDataOverflow(resolvedStatement);
  const protectedText = protectOverlayMathText(resolvedStatement);
  const component = String.raw`(?:\{[^{}]*\}|[^,()[\]{}]+?)`;
  const coordinatePattern = new RegExp(
    String.raw`\(\s*(?:(normalized\s+axis\s+cs|rel\s+axis\s+cs|axis\s+description\s+cs|axis\s+direction\s+cs|axis\s+cs)\s*:\s*)?(${component})\s*,\s*(${component})(?:\s*,\s*(${component}))?\s*\)`,
    "gi"
  );
  const transformed = protectedText.source.replace(coordinatePattern, (match, coordinateSystem, rawX, rawY, rawZ) => {
    const x = axisNumber(rawX, NaN);
    const y = axisNumber(rawY, NaN);
    const hasZ = rawZ !== undefined;
    const z = hasZ ? axisNumber(rawZ, NaN) : 0;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return match;
    const normalizedCoordinateSystem = String(coordinateSystem || "").toLowerCase().replace(/\s+/g, " ").trim();
    const point = normalizedCoordinateSystem === "axis direction cs"
      ? mapAxisDirectionVector({ x, y, z }, ranges, geometry, hasZ)
      : normalizedCoordinateSystem === "axis description cs"
      ? typeof geometry.mapAxisDescriptionPoint === "function"
        ? geometry.mapAxisDescriptionPoint({ x, y })
        : {
          x: geometry.origin.x + x * geometry.width,
          y: geometry.origin.y + y * geometry.height
        }
      : normalizedCoordinateSystem === "normalized axis cs"
      ? mapNormalizedAxisPoint({ x, y, z }, geometry, hasZ)
      : normalizedCoordinateSystem === "rel axis cs"
      ? mapRelativeAxisPoint({ x, y, z }, geometry, hasZ)
      : mapAxisPoint({
          x: clampCoordinates ? clampAxisCoordinate(x, ranges.xMin, ranges.xMax) : x,
          y: clampCoordinates ? clampAxisCoordinate(y, ranges.yMin, ranges.yMax) : y,
          z: clampCoordinates && hasZ ? clampAxisCoordinate(z, ranges.zMin, ranges.zMax) : z
        }, geometry, hasZ);
    if (!point) return match;
    return formatAxisPoint(point);
  });
  return restoreOverlayMathText(transformed, protectedText.values);
}

function protectOverlayMathText(statement) {
  const values = [];
  const text = String(statement || "");
  let source = "";
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length) {
      source += char + text[index + 1];
      index += 1;
      continue;
    }
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    if (char !== "$" || (braceDepth === 0 && bracketDepth === 0)) {
      source += char;
      continue;
    }
    const end = findOverlayMathEnd(text, index + 1);
    if (end === -1) {
      source += char;
      continue;
    }
    const token = `__TIKZKIT_OVERLAY_MATH_${values.length}__`;
    values.push(text.slice(index, end + 1));
    source += token;
    index = end;
  }
  return { source, values };
}

function findOverlayMathEnd(source, cursor) {
  for (let index = cursor; index < source.length; index += 1) {
    if (source[index] === "\\") index += 1;
    else if (source[index] === "$") return index;
  }
  return -1;
}

function restoreOverlayMathText(statement, values) {
  return values.reduce(
    (source, value, index) => source.replace(`__TIKZKIT_OVERLAY_MATH_${index}__`, value),
    statement
  );
}

function findNextAxisOverlayStatementStart(body, cursor) {
  let best = -1;
  for (const command of ["\\coordinate", "\\node", "\\draw", "\\filldraw", "\\fill", "\\path"]) {
    const index = body.indexOf(command, cursor);
    if (index !== -1 && (best === -1 || index < best)) {
      best = index;
    }
  }
  return best;
}

function findStatementEnd(source, start) {
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (char === ";" && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) return index;
  }
  return -1;
}

function axisOverlayStatementAllowsDataOverflow(statement) {
  return /\baxis\s+candlestick\s+(?:body|wick)\b/i.test(String(statement)) || /\baxis\s+(?:pin\s+edge|label)\b/i.test(String(statement));
}

function lowerPgfExtraPathellipse(statement, ranges, geometry) {
  const text = String(statement || "").trim();
  const drawMatch = text.match(/^\\(draw|path)\s*(\[[\s\S]*?\])?\s*\\pgfextra\s*\{/);
  if (!drawMatch) return null;
  const primitiveIndex = text.indexOf("\\pgfpathellipse");
  if (primitiveIndex === -1) return null;
  const groups = readCommandGroups(text, primitiveIndex + "\\pgfpathellipse".length, 3);
  if (!groups) return null;
  const center = parsePgfplotsPointAxisxy(groups[0]);
  const xDirection = parsePgfplotsPointAxisdirectionxy(groups[1]);
  const yDirection = parsePgfplotsPointAxisdirectionxy(groups[2]);
  if (!center || !xDirection || !yDirection) return null;

  const centerPoint = geometry.mapPoint(center);
  const xVector = mapAxisDirectionVector(xDirection, ranges, geometry);
  const yVector = mapAxisDirectionVector(yDirection, ranges, geometry);
  if (!xVector || !yVector) return null;

  const xSkew = Math.abs(xVector.y);
  const ySkew = Math.abs(yVector.x);
  const xRadius = Math.hypot(xVector.x, xVector.y);
  const yRadius = Math.hypot(yVector.x, yVector.y);
  if (!Number.isFinite(xRadius) || !Number.isFinite(yRadius) || xRadius <= 0 || yRadius <= 0) return null;
  if (xSkew > 1e-9 || ySkew > 1e-9) return null;

  const command = drawMatch[1];
  const options = drawMatch[2] || "";
  return `\\${command}${options ? options : ""} ${formatAxisPoint(centerPoint)} ellipse (${formatAxisNumber(xRadius)} and ${formatAxisNumber(yRadius)});`;
}

function readCommandGroups(source, cursor, count) {
  const groups = [];
  let index = cursor;
  while (groups.length < count) {
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (source[index] !== "{") return null;
    const group = readBalancedGroup(source, index);
    if (!group) return null;
    groups.push(group.content);
    index = group.end + 1;
  }
  return groups;
}

function readBalancedGroup(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { content: source.slice(start + 1, index), end: index };
      }
    }
  }
  return null;
}

function parsePgfplotsPointAxisxy(raw) {
  const match = String(raw || "").trim().match(/^\\pgfplotspointaxisxy\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}$/);
  if (!match) return null;
  const x = axisNumber(match[1], NaN);
  const y = axisNumber(match[2], NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function parsePgfplotsPointAxisdirectionxy(raw) {
  const match = String(raw || "").trim().match(/^\\pgfplotspointaxisdirectionxy\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}$/);
  if (!match) return null;
  const x = axisNumber(match[1], NaN);
  const y = axisNumber(match[2], NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function mapAxisPoint(point, geometry, hasZ) {
  if ((geometry.is3d || hasZ) && typeof geometry.mapPoint3d === "function") {
    return geometry.mapPoint3d(point);
  }
  return geometry.mapPoint(point);
}

function mapNormalizedAxisPoint(point, geometry, hasZ) {
  if ((geometry.is3d || hasZ) && typeof geometry.mapNormalizedAxisPoint3d === "function") {
    return geometry.mapNormalizedAxisPoint3d(point);
  }
  if (typeof geometry.mapNormalizedAxisPoint === "function") {
    return geometry.mapNormalizedAxisPoint(point);
  }
  return mapRelativeAxisPoint(point, { ...geometry, allowRelativeAxisReversal: true }, hasZ);
}

function mapRelativeAxisPoint(point, geometry, hasZ) {
  if ((geometry.is3d || hasZ) && typeof geometry.mapRelativePoint3d === "function") {
    return geometry.mapRelativePoint3d(point);
  }
  if ((geometry.is3d || hasZ) && typeof geometry.mapNormalizedPoint3d === "function") {
    return geometry.mapNormalizedPoint3d(applyRelativeAxisDirections(point, geometry));
  }
  if (typeof geometry.mapRelativePoint === "function") {
    return geometry.mapRelativePoint(point);
  }
  const relative = applyRelativeAxisDirections(point, geometry);
  return {
    x: geometry.origin.x + relative.x * geometry.width,
    y: geometry.origin.y + relative.y * geometry.height
  };
}

function applyRelativeAxisDirections(point, geometry) {
  if (geometry.allowRelativeAxisReversal !== false) return point;
  return {
    ...point,
    x: geometry.axisDirections?.x < 0 ? 1 - point.x : point.x,
    y: geometry.axisDirections?.y < 0 ? 1 - point.y : point.y,
    z: geometry.axisDirections?.z < 0 ? 1 - (point.z ?? 0) : (point.z ?? 0)
  };
}

function mapAxisDirectionVector(vector, ranges, geometry, hasZ = false) {
  if ((geometry.is3d || hasZ) && typeof geometry.mapAxisDirection3d === "function") {
    const vectorRanges = geometry.transformRanges || ranges;
    const xSpan = vectorRanges.xMax - vectorRanges.xMin || 1;
    const ySpan = vectorRanges.yMax - vectorRanges.yMin || 1;
    const zSpan = vectorRanges.zMax - vectorRanges.zMin || 1;
    return geometry.mapAxisDirection3d({
      x: vector.x / xSpan,
      y: vector.y / ySpan,
      z: vector.z / zSpan
    });
  }
  const vectorRanges = geometry.transformRanges || ranges;
  const xSpan = vectorRanges.xMax - vectorRanges.xMin || 1;
  const ySpan = vectorRanges.yMax - vectorRanges.yMin || 1;
  if (!Number.isFinite(xSpan) || !Number.isFinite(ySpan) || !Number.isFinite(geometry.width) || !Number.isFinite(geometry.height)) {
    return null;
  }
  return {
    x: (vector.x / xSpan) * geometry.width * (geometry.axisDirections?.x || 1),
    y: (vector.y / ySpan) * geometry.height * (geometry.axisDirections?.y || 1)
  };
}

function clampAxisCoordinate(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return value;
  return Math.max(Math.min(value, max), min);
}
