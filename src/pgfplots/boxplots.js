import { parseOptions } from "../engine/options.js";
import { pgfplotsOptionEnabled } from "./axisOptions.js";
import { boxplotPoint, boxplotSurveyPoints } from "./boxplotGeometry.js";
import { summarizeBoxplot } from "./boxplotStatistics.js";
import { pgfplotsCompatAtLeast, pgfplotsCompatLevel } from "./compat.js";
import { mergePgfplotsOptionMaps } from "./namedOptions.js";
import { scalarSurveyNumber, scalarSurveyRows } from "./scalarSurvey.js";

const fields = {
  "lower whisker": "lowerWhisker", "lower quartile": "lowerQuartile", median: "median",
  "upper quartile": "upperQuartile", "upper whisker": "upperWhisker", average: "average",
  "sample size": "sampleSize"
};

function optionMap(value) {
  if (typeof value === "object" && value) return value;
  return typeof value === "string" ? parseOptions(value) : {};
}

function boxplotSettings(axis, plot, styles) {
  let kind, every = styles["every boxplot"] || {}, paint = {};
  const settings = {}, partStyles = { average: { mark: "diamond*" } };
  function set(key, value) {
    key = key.replace(/^\/pgfplots\/boxplot\/|^boxplot\//, "");
    const part = /^every (box|whisker|median|average)\/\.(style|append style|prefix style)$/.exec(key);
    if (part) {
      const patch = optionMap(value), old = partStyles[part[1]];
      partStyles[part[1]] = part[2] === "style" ? patch : part[2] === "prefix style"
        ? mergePgfplotsOptionMaps(patch, old) : mergePgfplotsOptionMaps(old, patch);
    } else {
      if (key === "data") delete settings["data value"];
      if (key === "data value") delete settings.data;
      settings[key] = value;
    }
  }
  for (const name of ["whisker", "box", "median", "average"]) {
    const style = styles["boxplot/every " + name];
    if (style) partStyles[name] = optionMap(style);
  }
  for (const [rawKey, value] of Object.entries(mergePgfplotsOptionMaps(axis, plot))) {
    const key = rawKey.replace(/^\/pgfplots\//, "");
    if (key === "every boxplot/.style") { every = optionMap(value); continue; }
    if (key === "every boxplot/.append style") { every = mergePgfplotsOptionMaps(every, optionMap(value)); continue; }
    if (key === "boxplot" || key === "boxplot prepared") {
      kind = key;
      for (const [k, v] of Object.entries(every)) {
        if (/^(?:\/pgfplots\/)?boxplot\//.test(k)) set(k, v);
        else paint = mergePgfplotsOptionMaps(paint, { [k]: v });
      }
      for (const [k, v] of Object.entries(optionMap(value))) set(k, v);
    } else if (key.startsWith("boxplot/")) set(key, value);
  }
  return { kind, settings, partStyles, paint };
}

function numeric(raw, point, context, index) {
  const value = typeof raw === "string" ? raw.replace(
    /\\(?:pgfkeysvalueof\s*\{\/pgfplots\/boxplot\/|boxplotvalue\s*\{)box extend\}/g,
    () => `(${context.boxExtend ?? "nan"})`) : raw;
  return scalarSurveyNumber(value, point, context, index);
}

function emptyCoordinates(plot) {
  return { ...plot, type: "coordinates", is3d: false, points: [], coordinateRows: [] };
}

function prepareBoxplot(plot, config, context, options, diagnostics) {
  const { kind, settings, partStyles, paint } = config;
  const { axis, ordinal } = context;
  const direction = String(settings["draw direction"] ?? "x").trim();
  const unsupported = reason => {
    diagnostics.push({ severity: "warning", message: "PGFPlots boxplot: " + reason });
    return emptyCoordinates(plot);
  };
  if (!["x", "y"].includes(direction)) return unsupported("draw direction must be x or y");
  if (plot.is3d || pgfplotsOptionEnabled(plot.options?.["stack plots"] ?? axis["stack plots"]))
    return unsupported("stacked and 3D boxplots are not supported");
  const customHook = Object.keys(settings).find(key => key.startsWith("draw/") ||
    key.startsWith("variable width expr") || key.startsWith("data filter"));
  if (customHook) return unsupported("custom TeX hook '" + customHook + "' is not supported");
  const rows = scalarSurveyRows(plot, axis, options);
  if (!rows) return unsupported("unsupported sample source");
  const read = (key, fallback) => settings[key] === undefined ? fallback
    : numeric(settings[key], rows.at(-1), context, Math.max(0, rows.length - 1));
  const boxExtend = read("box extend", 0.8);
  context.boxExtend = boxExtend;
  const whiskerExtend = read("whisker extend", boxExtend * 0.8);
  const relativeAnchor = read("draw relative anchor", 0.5);
  const position = read("draw position", 1 + ordinal);
  if (![boxExtend, whiskerExtend, relativeAnchor, position].every(Number.isFinite))
    return unsupported("invalid draw position, anchor or extent");
  const compat = pgfplotsCompatLevel(axis, plot.options);
  const computed = kind === "boxplot";
  const data = settings["data value"] ?? settings.data;
  const valueOf = (row, index) => data === undefined ? row.y : numeric(data, row, context, index);
  const values = rows.map(valueOf);
  const stats = {};
  for (const [key, field] of Object.entries(fields)) {
    const value = settings[key] ?? (field === "average" ? "" : "auto");
    stats[field] = value === "auto" ? (computed ? "auto" : null) : value === "" ? null : read(key);
    if (typeof stats[field] === "number" && !Number.isFinite(stats[field])) return unsupported("invalid " + key);
  }
  let summary;
  if (computed) {
    try {
      summary = summarizeBoxplot(values, {
        ...stats, compat, estimator: settings.estimator, lowerProbability: read("lower quartile off", 0.25),
        upperProbability: read("upper quartile off", 0.75), whiskerRange: read("whisker range", 1.5)
      });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return unsupported(error.message);
    }
  } else summary = { ...stats, outliers: values.filter(Number.isFinite) };
  const box = {
    ...summary, direction, position, boxExtend, whiskerExtend, relativeAnchor, partStyles,
    ensureMark: settings["ensure mark"] === undefined ? pgfplotsCompatAtLeast(compat, "1.12") : pgfplotsOptionEnabled(settings["ensure mark"])
  };
  // Prepared outliers can read their own row's category. The box itself uses
  // the last row; a computed handler replays only the sorted scalar values.
  const points = computed ? box.outliers.map(value => boxplotPoint(box, value))
    : rows.flatMap((row, i) => {
      if (!Number.isFinite(values[i])) return [];
      const lane = settings["draw position"] === undefined ? position : numeric(settings["draw position"], row, context, i);
      return Number.isFinite(lane) ? [{ ...row, ...boxplotPoint({ ...box, position: lane }, values[i]) }] : [];
    });
  if (pgfplotsOptionEnabled(settings["variable width"]) && Number.isFinite(box.sampleSize) && box.sampleSize >= 0) {
    const min = read("sample size min"), max = read("sample size max");
    const survey = context.widthSurvey;
    if (max === undefined) {
      survey.min = Math.min(min ?? survey.min, box.sampleSize);
      survey.max = Math.max(survey.max, box.sampleSize);
    }
    survey.entries.push({ box, min, max,
      target: read("variable width min target", 0.2),
      effectiveWhisker: width => {
        context.boxExtend = width;
        return read("whisker extend", 0.8 * width);
      }
    });
  }
  return { ...emptyCoordinates(plot), options: mergePgfplotsOptionMaps(paint, plot.options), boxplot: box,
    points, coordinateRows: points.length ? [points] : [], boxplotSurveyPoints: boxplotSurveyPoints(box, points) };
}

export function preparePgfplotsBoxplots(axis, plots, options = {}, diagnostics = []) {
  if (![axis, ...plots.map(p => p.options)].some(map => map &&
    Object.keys(map).some(k => /^(?:\/pgfplots\/)?boxplot(?: prepared)?$/.test(k)))) return plots;
  const counts = new Map(), widthSurvey = { min: Infinity, max: -Infinity, entries: [] };
  const result = plots.map((plot, plotIndex) => {
    const config = boxplotSettings(axis, plot.options, options.pgfplotsStyleDefinitions || {});
    if (!config.kind) return plot;
    const ordinal = counts.get(config.kind) || 0;
    counts.set(config.kind, ordinal + 1);
    // Native starts a fresh width range at the first plot of *each handler
    // type*, including a transition from prepared summaries to raw samples.
    if (!ordinal) { widthSurvey.min = Infinity; widthSurvey.max = -Infinity; }
    return prepareBoxplot(plot, config, { axis, ordinal, plotIndex, widthSurvey }, options, diagnostics);
  });
  // Native survey uses the full category width. Only visualization uses the
  // sample-size scale; otherwise adding another series would change the limits.
  for (const { box, min, max, target, effectiveWhisker } of widthSurvey.entries) {
    const lo = Math.sqrt(min ?? widthSurvey.min), hi = Math.sqrt(max ?? widthSurvey.max);
    const t = hi > lo ? Math.max(0, Math.min(1, (Math.sqrt(box.sampleSize) - lo) / (hi - lo))) : 0;
    box.boxExtend *= target + t * (1 - target);
    box.whiskerExtend = effectiveWhisker(box.boxExtend);
  }
  return result;
}
