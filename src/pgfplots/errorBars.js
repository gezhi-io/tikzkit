import { parseOptions, splitTopLevel, stripOuterBraces, stripTexComments } from "../engine/options.js";
import { mergePgfplotsOptionMaps } from "./namedOptions.js";
import { isLogAxis } from "./ranges.js";

const root = "/pgfplots";
const family = root + "/error bars";
const directions = new Set(["none", "plus", "minus", "both"]);
const sides = ["plus", "minus"];
const axes = ["x", "y"];

function number(value) {
  if (typeof value === "string") {
    const text = stripOuterBraces(value);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
    value = Number(text);
  }
  return Number.isFinite(value) ? value : null;
}

function mentionsFamily(options) {
  if (!options) return false;
  if (typeof options === "string") return options.includes("error bars");
  return Object.keys(options).some(k => k === "error bars" || k === family ||
    k.startsWith("error bars/") || k.startsWith(family + "/"));
}

function entries(options) {
  if (typeof options !== "string") return Object.entries(options || {});
  // Read raw groups one key at a time: repeated .cd and append operations
  // must retain their positions even though the public option map is flat.
  return splitTopLevel(stripTexComments(stripOuterBraces(options))).flatMap(part => Object.entries(parseOptions(part)));
}

function style(value) {
  if (typeof value === "string") return parseOptions(stripOuterBraces(value));
  return value && typeof value === "object" ? { ...value } : {};
}

function applyOptions(config, options, start = root) {
  let directory = start;
  const flat = typeof options === "object" && start === root;
  for (const [key, value] of entries(options)) {
    // createAxisOptions strips /pgfplots/ even from absolute keys after .cd.
    if (flat && key === ".cd") { directory = root; continue; }
    const rooted = flat && (key === "error bars" || key.startsWith("error bars/") || key.startsWith("every error bar/"));
    const path = key.startsWith("/") ? key : (rooted ? root : directory) + "/" + key;
    if (path.endsWith("/.cd")) {
      directory = path.slice(0, -4);
      continue;
    }
    if (path === family) {
      if (value === true || value === "") directory = family;
      else applyOptions(config, value, family); // scoped grouped spelling
      continue;
    }
    const every = path.match(/^\/pgfplots\/every error bar\/\.(style|append style|prefix style)$/);
    if (every) {
      const patch = style(value);
      config.barStyle = every[1] === "style" ? patch : every[1] === "prefix style"
        ? mergePgfplotsOptionMaps(patch, config.barStyle) : mergePgfplotsOptionMaps(config.barStyle, patch);
      continue;
    }
    if (!path.startsWith(family + "/")) continue;
    const name = path.slice(family.length + 1);
    if (name === "error bar style") config.barStyle = mergePgfplotsOptionMaps(config.barStyle, style(value));
    else if (name === "error mark options") config.markOptions = style(value);
    else if (name === "error mark" && typeof value === "string") config.mark = stripOuterBraces(value);
    else {
      const match = name.match(/^([xy]) (dir|fixed(?: relative)?|explicit(?: relative)?)(?:\/(plus|minus|both|none))?$/);
      if (!match) continue;
      const [, axis, mode, choice] = match;
      if (mode === "dir") {
        const dir = choice ?? stripOuterBraces(value);
        if (directions.has(dir)) config[axis].dir = dir;
      } else if (!choice) {
        config[axis].mode = mode;
        config[axis].value = mode.startsWith("fixed") ? number(value) : null;
      }
    }
  }
}

// pgfplots.code.tex: dir=none, fixed=0. "error bar style" appends to
// "every error bar"; "error mark options" is a value, not an additive style.
export function resolveErrorBarOptions(axisOptions, plotOptions) {
  if (!mentionsFamily(axisOptions) && !mentionsFamily(plotOptions)) return null;
  const axis = { dir: "none", mode: "fixed", value: 0 };
  const config = { x: { ...axis }, y: { ...axis }, barStyle: { thin: true }, mark: "-", markOptions: { rotate: "90" } };
  applyOptions(config, axisOptions);
  applyOptions(config, plotOptions);
  return config.x.dir === "none" && config.y.dir === "none" ? null : config;
}

const excludedHandlers = new Set(["pgfplots 3d surface", "pgfplots ternary axis", "xbar stacked", "ybar stacked",
  "xbar interval", "ybar interval", "xbar interval stacked", "ybar interval stacked", "hist", "pgfplots histogram",
  "stack plots/x", "stack plots/y", "stack plots/z"]);

function excludedGeometry(options, plotLocal = false) {
  for (const [rawKey, value] of entries(options)) {
    const key = rawKey.replace(/^\/(?:pgfplots|tikz)\//, "");
    if (value == null || value === false) continue;
    // A series must use the parent axis transform, not install its own scale.
    if (plotLocal && (/^[xy]mode\/log$/.test(key) || (/^(?:[xy]mode|[xy] scale)$/.test(key) &&
        String(value).trim().toLowerCase() === "log"))) return true;
    if (key === "stack plots" && !["false", "none", "off", "0"].includes(String(value).trim().toLowerCase())) return true;
    if (excludedHandlers.has(key) && value !== "false") return true;
  }
  return false;
}

// Deliberately independent of range resolution and rendering: both call this
// gate. Ordinary grouped xbar/ybar have a canvas shift, not different data.
export function resolvePlotErrorBars(axisOptions, plot, diagnostics) {
  if (!plot || plot.is3d || plot.pgfplotsStacked || plot.histogram) return null;
  const config = resolveErrorBarOptions(axisOptions, plot.options);
  if (!config || excludedGeometry(axisOptions) || excludedGeometry(plot.options, true)) return null;
  for (const axis of axes) {
    if (!isLogAxis(axisOptions, axis)) continue;
    const dim = config[axis];
    dim.logarithmic = true;
    // PGF prepares *both* fixed factors before looking at the requested
    // sides. Per-point explicit factors, in contrast, silently omit bad arms.
    if (dim.dir !== "none" && dim.mode === "fixed relative" && Math.abs(dim.value) >= 1) {
      const sign = dim.value < 0 ? "+" : "-";
      diagnostics?.push({ severity: "error", code: "PGFPLOTS_LOG_ERROR_FACTOR",
        message: `PGFPlots error bars/${axis} fixed relative=${dim.value}: log(1 ${sign} ${dim.value}) is undefined.` });
    }
  }
  return config;
}

// pgfplots.errorbars.code.tex, linear survey: relative errors multiply the
// signed coordinate by 1 +/- error. Empty/unbounded entries skip only their
// own side; a supplied zero is a real endpoint (and may paint a cap).
export function errorBarEndpoints(point, config) {
  if (!config) return [];
  const x = number(point?.x), y = number(point?.y);
  if (x === null || y === null || (config.x.logarithmic && x <= 0) || (config.y.logarithmic && y <= 0)) return [];
  const endpoints = [];
  for (const axis of axes) {
    const { dir, mode, value, logarithmic } = config[axis];
    if (dir === "none") continue;
    const origin = axis === "x" ? x : y;
    for (const side of sides) {
      if (dir !== "both" && side !== dir) continue;
      const error = mode.startsWith("explicit") ? number(point.errors?.[axis]?.[side]) : value;
      if (error === null) continue;
      const delta = side === "plus" ? error : -error;
      const target = mode.endsWith("relative") ? origin * (1 + delta) : origin + delta;
      // pgfplots.errorbars.code.tex:261-415 takes the log *after* adding the
      // absolute error or multiplying by the factor. Our geometry owns that
      // projection; pass it the raw endpoint. log(1)=0 is a valid result.
      if (Number.isFinite(target) && (!logarithmic || target > 0)) endpoints.push({ axis, side, x, y, [axis]: target || 0 });
    }
  }
  return endpoints;
}
