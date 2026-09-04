import { parseOptions } from "../engine/options.js";
import { currentPlotMappedPoints } from "./addplotLowering.js";
import { transformAxisStatementCoordinates } from "./axisOverlay.js";
import { formatAxisPoint, joinOptions } from "./format.js";

// PGFPlots' fillbetween library builds a closed area from two named paths.
// This focused lowering supports the common 2D function/coordinate case and
// keeps the area below the named plots, matching the library's pre-main layer.
export function renderAxisFillBetween(body, addplots, axisOptions, ranges, geometry, options = {}) {
  const namedPaths = new Map();
  for (const plot of addplots || []) {
    const name = namedPlotPathName(plot?.options);
    if (!name) continue;
    const points = currentPlotMappedPoints(plot, axisOptions, ranges, geometry, options);
    if (points.length >= 2) namedPaths.set(name, points);
  }
  for (const [name, points] of namedAxisOverlayPaths(body, ranges, geometry)) {
    namedPaths.set(name, points);
  }

  const commands = [];
  for (const fillBetween of parsePgfplotsFillBetween(body)) {
    const firstPath = namedPaths.get(fillBetween.first);
    const secondPath = namedPaths.get(fillBetween.second);
    if (!firstPath || !secondPath) continue;
    const clipped = softlyClipFillBetweenPaths(firstPath, secondPath, fillBetween.options, ranges, geometry);
    if (!clipped) continue;
    const fallbackRegion = { first: clipped.first, second: clipped.second };
    const splitRegions = fillBetweenSplitEnabled(fillBetween.options)
      ? splitXMonotoneFillBetweenPaths(clipped.first, clipped.second)
      : [];
    const regions = splitRegions.length ? splitRegions : [fallbackRegion];
    for (const [index, region] of regions.entries()) {
      const style = fillBetweenSegmentStyle(fillBetween, index, regions.length);
      const points = [...region.first, ...region.second.slice().reverse()];
      commands.push(`\\fill[${style}] ${points.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
  }
  return commands;
}

export function parsePgfplotsFillBetween(body) {
  const fills = [];
  // Plot options cannot span a preceding `\addplot` statement. Restrict the
  // lightweight matcher to this statement's option brackets so the normal
  // named curve and its fill-between command stay independent.
  const pattern = /\\addplot\s*(?:\[([^\]]*)\])?\s*fill\s+between\s*\[([^\]]*)\]\s*;/g;
  let match;
  while ((match = pattern.exec(String(body || "")))) {
    const plotOptions = parseOptions(match[1] || "");
    const options = parseOptions(match[2] || "");
    const names = String(options.of || "").match(/^\s*([^\s]+)\s+and\s+([^\s]+)\s*$/i);
    if (!names) continue;
    fills.push({
      first: names[1],
      second: names[2],
      plotOptions,
      plotOptionsSource: String(match[1] || "").trim(),
      options
    });
  }
  return fills;
}

export function splitXMonotoneFillBetweenPaths(firstPath, secondPath) {
  // For single-valued curves, PGF's path-intersection times reduce to ordered
  // x crossings. Split both polylines at the same crossings before pairing them.
  const first = orientPathByIncreasingX(firstPath);
  const second = orientPathByIncreasingX(secondPath);
  if (!isXMonotonePath(first) || !isXMonotonePath(second)) return [];

  const minX = Math.max(first[0]?.x ?? Infinity, second[0]?.x ?? Infinity);
  const maxX = Math.min(first.at(-1)?.x ?? -Infinity, second.at(-1)?.x ?? -Infinity);
  if (!(maxX > minX)) return [];

  const clippedFirst = clipPolylineToXRange(first, minX, maxX);
  const clippedSecond = clipPolylineToXRange(second, minX, maxX);
  if (clippedFirst.length < 2 || clippedSecond.length < 2) return [];

  const sampleXs = uniqueSortedNumbers([
    minX,
    maxX,
    ...clippedFirst.map((point) => point.x),
    ...clippedSecond.map((point) => point.x)
  ]);
  const intersections = [];
  for (let index = 1; index < sampleXs.length; index += 1) {
    const fromX = sampleXs[index - 1];
    const toX = sampleXs[index];
    if (!(toX > fromX)) continue;
    const firstFrom = pointOnXMonotonePath(clippedFirst, fromX);
    const firstTo = pointOnXMonotonePath(clippedFirst, toX);
    const secondFrom = pointOnXMonotonePath(clippedSecond, fromX);
    const secondTo = pointOnXMonotonePath(clippedSecond, toX);
    if (!firstFrom || !firstTo || !secondFrom || !secondTo) continue;
    const fromDifference = firstFrom.y - secondFrom.y;
    const toDifference = firstTo.y - secondTo.y;
    if (Math.abs(fromDifference) <= 1e-9) intersections.push(fromX);
    if (Math.abs(toDifference) <= 1e-9) intersections.push(toX);
    if (fromDifference * toDifference < 0) {
      const ratio = fromDifference / (fromDifference - toDifference);
      intersections.push(fromX + (toX - fromX) * ratio);
    }
  }

  const boundaries = uniqueSortedNumbers([
    minX,
    ...intersections.filter((x) => x > minX + 1e-8 && x < maxX - 1e-8),
    maxX
  ]);
  const regions = [];
  for (let index = 1; index < boundaries.length; index += 1) {
    const regionFirst = sliceXMonotonePath(clippedFirst, boundaries[index - 1], boundaries[index]);
    const regionSecond = sliceXMonotonePath(clippedSecond, boundaries[index - 1], boundaries[index]);
    if (regionFirst.length < 2 || regionSecond.length < 2) continue;
    const polygon = [...regionFirst, ...regionSecond.slice().reverse()];
    if (Math.abs(polygonSignedArea(polygon)) <= 1e-8) continue;
    regions.push({ first: regionFirst, second: regionSecond });
  }
  return regions;
}

function namedPlotPathName(plotOptions = {}) {
  const value = plotOptions["name path global"] ?? plotOptions["name path"];
  if (value === undefined || value === null || value === true) return "";
  return String(value).trim();
}

function namedAxisOverlayPaths(body, ranges, geometry) {
  const paths = new Map();
  const pattern = /\\(?:path|draw)\s*\[([^\]]*)\]([\s\S]*?);/g;
  let match;
  while ((match = pattern.exec(String(body || "")))) {
    const name = namedPlotPathName(parseOptions(match[1] || ""));
    if (!name) continue;
    const statement = `\\path[${match[1]}]${match[2]};`;
    const transformed = transformAxisStatementCoordinates(statement, ranges, geometry);
    const points = transformedCoordinatePairs(transformed);
    if (points.length >= 2) paths.set(name, points);
  }
  return paths;
}

function transformedCoordinatePairs(statement) {
  const points = [];
  const pattern = /\(\s*([-+]?(?:\d+\.?\d*|\.\d+))\s*,\s*([-+]?(?:\d+\.?\d*|\.\d+))\s*\)/g;
  let match;
  while ((match = pattern.exec(String(statement || "")))) {
    points.push({ x: Number(match[1]), y: Number(match[2]) });
  }
  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function softlyClipFillBetweenPaths(firstPath, secondPath, options, ranges, geometry) {
  const domain = fillBetweenDomain(options["soft clip"]);
  if (!domain) return { first: firstPath, second: secondPath };
  const start = geometry.mapPoint({ x: domain.start, y: ranges.yMin });
  const end = geometry.mapPoint({ x: domain.end, y: ranges.yMin });
  if (![start?.x, end?.x].every(Number.isFinite)) return null;
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const first = clipPolylineToXRange(firstPath, minX, maxX);
  const second = clipPolylineToXRange(secondPath, minX, maxX);
  return first.length >= 2 && second.length >= 2 ? { first, second } : null;
}

function fillBetweenDomain(value) {
  const match = String(value || "").match(/domain\s*=\s*([-+]?(?:\d+\.?\d*|\.\d+))\s*:\s*([-+]?(?:\d+\.?\d*|\.\d+))/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

function clipPolylineToXRange(points, minX, maxX) {
  const clipped = [];
  for (let index = 1; index < points.length; index += 1) {
    const segment = clipSegmentToXRange(points[index - 1], points[index], minX, maxX);
    if (!segment) continue;
    appendPoint(clipped, segment[0]);
    appendPoint(clipped, segment[1]);
  }
  return clipped;
}

function clipSegmentToXRange(start, end, minX, maxX) {
  const dx = end.x - start.x;
  if (Math.abs(dx) < 1e-12) {
    return start.x >= minX - 1e-9 && start.x <= maxX + 1e-9 ? [start, end] : null;
  }
  const atMin = (minX - start.x) / dx;
  const atMax = (maxX - start.x) / dx;
  const from = Math.max(0, Math.min(atMin, atMax));
  const to = Math.min(1, Math.max(atMin, atMax));
  if (from > to) return null;
  return [
    interpolatePoint(start, end, from),
    interpolatePoint(start, end, to)
  ];
}

function interpolatePoint(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  };
}

function appendPoint(points, point) {
  const previous = points.at(-1);
  if (previous && Math.abs(previous.x - point.x) < 1e-9 && Math.abs(previous.y - point.y) < 1e-9) return;
  points.push(point);
}

function orientPathByIncreasingX(points) {
  const path = (points || []).filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (path.length < 2) return path;
  return path[0].x <= path.at(-1).x ? path.slice() : path.slice().reverse();
}

function isXMonotonePath(points) {
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && Math.abs(dy) > 1e-9)) return false;
  }
  return points.length >= 2;
}

function pointOnXMonotonePath(points, x) {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const minX = Math.min(start.x, end.x) - 1e-9;
    const maxX = Math.max(start.x, end.x) + 1e-9;
    if (x < minX || x > maxX) continue;
    const dx = end.x - start.x;
    if (Math.abs(dx) <= 1e-12) return Math.abs(x - start.x) <= 1e-9 ? { ...start } : null;
    return interpolatePoint(start, end, Math.max(0, Math.min(1, (x - start.x) / dx)));
  }
  return null;
}

function sliceXMonotonePath(points, fromX, toX) {
  const start = pointOnXMonotonePath(points, fromX);
  const end = pointOnXMonotonePath(points, toX);
  if (!start || !end) return [];
  const result = [start];
  for (const point of points) {
    if (point.x > fromX + 1e-9 && point.x < toX - 1e-9) appendPoint(result, point);
  }
  appendPoint(result, end);
  return result;
}

function uniqueSortedNumbers(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const unique = [];
  for (const value of sorted) {
    if (!unique.length || Math.abs(value - unique.at(-1)) > 1e-8) unique.push(value);
  }
  return unique;
}

function polygonSignedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function fillBetweenSplitEnabled(options = {}) {
  const value = options.split;
  if (value === undefined || value === null || value === false) return false;
  if (value === true) return true;
  return !["false", "0", "off", "no"].includes(String(value).trim().toLowerCase());
}

function fillBetweenSegmentStyle(fillBetween, index, segmentCount) {
  const options = fillBetween.options || {};
  return joinOptions([
    "axis fill between",
    "fill",
    fillBetweenStyleLayer(options, "every segment"),
    fillBetween.plotOptionsSource,
    fillBetweenStyleLayer(options, `every segment no ${index}`),
    fillBetweenStyleLayer(options, index % 2 === 0 ? "every even segment" : "every odd segment"),
    index === segmentCount - 1 ? fillBetweenStyleLayer(options, "every last segment") : ""
  ]);
}

function fillBetweenStyleLayer(options, name) {
  const value = options[`${name}/.style`] ?? options[`/tikz/fill between/${name}/.style`];
  return value === undefined || value === null || value === true ? "" : String(value).trim();
}
