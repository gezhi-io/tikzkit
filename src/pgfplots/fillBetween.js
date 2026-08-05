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
    const style = joinOptions([
      "axis fill between",
      fillBetweenStyle(fillBetween.plotOptions),
      "draw=none"
    ]);
    commands.push(`\\draw[${style}] ${[...clipped.first, ...clipped.second.slice().reverse()].map(formatAxisPoint).join(" -- ")} -- cycle;`);
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
      options
    });
  }
  return fills;
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

function fillBetweenStyle(options = {}) {
  const parts = [];
  if (options.fill && options.fill !== true) parts.push(`fill=${options.fill}`);
  else parts.push("fill=black");
  const rawOpacity = options["fill opacity"] ?? options.opacity;
  const opacity = Number(rawOpacity);
  if (Number.isFinite(opacity)) parts.push(`fill opacity=${Math.max(0, Math.min(1, opacity > 1 ? opacity / 100 : opacity))}`);
  return parts.join(",");
}
