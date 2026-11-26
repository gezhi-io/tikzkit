import { parseOptions, stripTexComments } from "../engine/options.js";
import { parseOptionalOptions } from "./addplotParser.js";
import { axisViewportClipOption } from "./clipping.js";
import { prepareFillBetweenPaths, joinFillBetweenPaths } from "./fillBetweenAssembly.js";
import { namedFillBetweenBoundaries } from "./fillBetweenBoundaries.js";
import { softClipFillBetweenBoundary } from "./fillBetweenSoftClip.js";
import { splitFillBetweenRegions } from "./fillBetweenSplit.js";
import { formatAxisPathCommands, joinOptions } from "./format.js";

export { splitXMonotoneFillBetweenPaths } from "./fillBetweenSplit.js";

export function renderAxisFillBetween(body, addplots, axisOptions, ranges, geometry, options = {}) {
  const fills = parsePgfplotsFillBetween(body);
  if (!fills.length) return [];
  const boundaries = namedFillBetweenBoundaries(body, addplots, axisOptions, ranges, geometry, options);
  const commands = [];
  for (const fill of fills) {
    const a = boundaries.get(fill.first), b = boundaries.get(fill.second);
    if (!a?.length || !b?.length) continue;
    // PGF infers direction from the *uncut* paths. A clip can remove the very
    // first segment (or add a moveto), so it must not change that decision.
    const prepared = prepareFillBetweenPaths(a, b, fill.options);
    const clips = boundaryClipOptions(fill.options);
    const first = softClipFillBetweenBoundary(prepared.first, clips.first, ranges, geometry);
    const second = softClipFillBetweenBoundary(prepared.second, clips.second, ranges, geometry);
    if (!first.length || !second.length) continue;
    const split = fillBetweenSplitEnabled(fill.options)
      ? splitFillBetweenRegions(first, second, prepared.reverse, fill.options) : null;
    const regions = split ?? [{ first, second, reverse: prepared.reverse }];
    // The pre-main layer needs its own axis clip; a soft clip changes the
    // actual boundary, whereas this clip only masks the finished area.
    const clip = axisViewportClipOption(axisOptions["clip mode"] === "individual"
      ? { ...axisOptions, clip: fill.plotOptions.clip ?? axisOptions.clip } : axisOptions, ranges, geometry);
    for (const [index, region] of regions.entries()) {
      const path = formatAxisPathCommands(joinFillBetweenPaths(region.first, region.second, region.reverse));
      if (path) commands.push("\\fill[" + joinOptions([fillBetweenSegmentStyle(fill, index, regions.length), clip]) + "] " + path + ";");
    }
  }
  return commands;
}

function boundaryClipOptions(options) {
  let first, second;
  for (const [key, value] of Object.entries(options)) {
    if (key === "soft clip" || key === "soft clip first") first = value;
    if (key === "soft clip" || key === "soft clip second") second = value;
  }
  return { first, second };
}

function parseFillBetweenOptions(raw) {
  const ordered = new Map();
  for (const [key, value] of Object.entries(parseOptions(raw))) {
    const name = key
      .replace(/^\/pgf\/fill between\/(reverse|inner moveto|split|omit empty segments)$/, "$1")
      .replace(/^\/tikz\/fill between\/(of|soft clip(?: first| second)?|every [^/]+\/\.style)$/, "$1");
    // A qualified alias can override a bare key *after* a common soft clip.
    ordered.delete(name);
    ordered.set(name, value);
  }
  return Object.fromEntries(ordered);
}

export function parsePgfplotsFillBetween(body) {
  if (!/\bfill\s+between\b/.test(body || "")) return [];
  const source = stripTexComments(body);
  const fills = [];
  const addplot = /\\addplot(?![a-zA-Z@])\s*\+?\s*/g;
  for (let match; (match = addplot.exec(source));) {
    const paint = parseOptionalOptions(source, addplot.lastIndex);
    const operation = /^\s*fill\s+between\s*(?=\[)/.exec(source.slice(paint.end));
    if (!operation) continue;
    const group = parseOptionalOptions(source, paint.end + operation[0].length);
    if (!group.raw || !/^\s*;/.test(source.slice(group.end))) continue;
    addplot.lastIndex = group.end;
    const options = parseFillBetweenOptions(group.raw);
    const names = String(options.of || "").trim().match(/^(.+?)\s+and\s+(.+)$/);
    if (names) fills.push({ first: names[1], second: names[2], options,
      plotOptions: parseOptions(paint.raw), plotOptionsSource: paint.raw.trim() });
  }
  return fills;
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
  const value = options[`${name}/.style`];
  return value === undefined || value === null || value === true ? "" : String(value).trim();
}
