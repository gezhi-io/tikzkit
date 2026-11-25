import { parseOptions } from "../engine/options.js";
import { axisNumber } from "./coordinates.js";
import { isLogAxis } from "./ranges.js";
import { pgfplotsOptionEnabled } from "./axisOptions.js";
import { expandPgfplotsNamedOptions, mergePgfplotsOptionMaps } from "./namedOptions.js";
import { matrixPlotKind, matrixPlotSettings, surveyMatrixPlot } from "./matrixSurvey.js";

function metaRange(values, options) {
  let min = Infinity, max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  min = axisNumber(options["point meta min"], min);
  max = axisNumber(options["point meta max"], max);
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

// Ordinary coordinate plots with explicit numeric metadata can share a
// color scale with a matrix even though they do not own any image cells.
function* otherMetaValues(plot, options) {
  const key = options["point meta"] ?? (options.scatter ? "y" : null);
  if (!key || key === "explicit symbolic") return;
  for (const point of plot.points ?? []) {
    if (key === "explicit") yield point.meta;
    else if (key === "x" || key === "y" || key === "z") yield point[key];
    else if (typeof key !== "boolean") yield Number(key);
  }
}

function unsupportedMatrixMode(plot, settings) {
  if (plot.is3d || plot.type !== "coordinates") return "requires two-dimensional coordinate or table data";
  if (isLogAxis(settings, "x") || isLogAxis(settings, "y")) return "logarithmic cell projection is not implemented";
  if (settings.shader && settings.shader !== "flat corner") return "unsupported shader: " + settings.shader;
  if (settings["z buffer"] && settings["z buffer"] !== "none") return "unsupported z buffer: " + settings["z buffer"];
  if (Number(settings["patch refines"]) > 0) return "patch refinement is not implemented";
}

function everyPlotStyle(axis, definitions) {
  let style = definitions["every axis plot"];
  for (const [key, value] of Object.entries(axis)) {
    if (!/^every axis plot\/\.(?:style|append style)$/.test(key)) continue;
    const options = expandPgfplotsNamedOptions(parseOptions(String(value)), definitions);
    style = key.endsWith("/.style") ? options : mergePgfplotsOptionMaps(style, options);
  }
  return style;
}

export function prepareMatrixPlots(axis, plots, diagnostics = [], definitions = {}) {
  // Handler and metadata styles take effect before the survey. Waiting for
  // the paint cycle would already have lost the half-cell axis limits.
  const style = everyPlotStyle(axis, definitions);
  const optionsByPlot = plots.map(plot => style ? mergePgfplotsOptionMaps(style, plot.options) : plot.options);
  const kinds = optionsByPlot.map(options => matrixPlotKind(axis, options));
  if (!kinds.some(Boolean)) return { axisOptions: axis, addplots: plots };

  const allMeta = [];
  let colorbarSource = null;
  const prepared = plots.map((source, i) => {
    const plot = kinds[i] ? { ...source, options: Object.fromEntries(
      Object.entries(optionsByPlot[i]).map(([k, v]) => [k.replace(/^\/pgfplots\//, ""), v])) } : source;
    const options = kinds[i] ? matrixPlotSettings(axis, plot.options) : { ...axis, ...plot.options };
    let survey = null;
    if (kinds[i]) {
      const reason = unsupportedMatrixMode(plot, options);
      if (reason) diagnostics.push({ severity: "warning", code: "PGFPLOTS_MATRIX_MODE", message: "PGFPlots matrix plot: " + reason });
      else survey = surveyMatrixPlot(plot, axis, diagnostics);
      // An invalid matrix must never be replayed as a plausible-looking
      // polyline through the original observations.
      if (!survey) return { ...plot, type: "coordinates", is3d: false, points: [], coordinateRows: [],
        matrixSurvey: { rangePoints: [], cells: [] } };
    }
    const local = metaRange(survey ? survey.cells.map(cell => cell.meta) : otherMetaValues(plot, options), options);
    if (local) {
      allMeta.push(local.min, local.max);
      if (pgfplotsOptionEnabled(options["colorbar source"])) colorbarSource = local;
    }
    return survey ? { ...plot, matrixSurvey: { ...survey, metaRange: local } } : plot;
  });
  const shared = metaRange(allMeta, axis);
  for (const plot of prepared) {
    if (!plot.matrixSurvey) continue;
    const relative = plot.options["point meta rel"] ?? axis["point meta rel"];
    if (relative !== "per plot" && !pgfplotsOptionEnabled(plot.options["colorbar source"])) {
      plot.matrixSurvey.metaRange = shared;
    }
  }
  // Native matrix plot installs these as late *axis* options. They move
  // ticks, overlays and neighboring plots together, not just the colored grid.
  const reverse = kinds.includes("matrix") || matrixPlotKind(axis, {}) === "matrix";
  return { axisOptions: { ...axis, ...(reverse ? { "y dir": "reverse", "axis on top": true } : {}),
    "pgfplots matrix meta range": colorbarSource ?? shared }, addplots: prepared };
}
