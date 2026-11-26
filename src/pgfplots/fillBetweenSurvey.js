import { parseOptions, stripOuterBraces } from "../engine/options.js";
import { sampledAddplotData } from "./addplotData.js";
import { errorBarEndpoints, resolvePlotErrorBars } from "./errorBars.js";
import { fillBetweenRectangleBox } from "./fillBetweenBox.js";
import { axisPointIsValidForScale, nativeLogRegisterBase } from "./logAxis.js";
import { isLogAxis } from "./ranges.js";

const surveys = new WeakMap();
const decimal = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export function bindFillBetweenSurvey(geometry, addplots, axis, renderOptions) {
  let result;
  const read = () => result ??= collectSurvey(geometry, addplots, axis, renderOptions);
  surveys.set(geometry, read);
  return read;
}

export function fillBetweenSurveyForGeometry(geometry) {
  return surveys.get(geometry)?.();
}

function collectSurvey(geometry, plots, axis, options) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  const visit = p => {
    xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
    yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
  };
  // Consume the model's prepared 2D data, not overlay paths, bar widths or
  // stack baselines. Custom TeX survey handlers/filters are not executed here.
  for (const plot of plots) {
    if (plot.is3d || !["coordinates", "function", "parametric"].includes(plot.type)) continue;
    const points = plot.type === "coordinates"
      ? plot.matrixSurvey?.rangePoints ?? plot.boxplotSurveyPoints ?? plot.points
      : sampledAddplotData(plot, axis, geometry, options);
    const errorBars = resolvePlotErrorBars(axis, plot);
    for (const p of points) {
      // stacked ignores zero affects paint, not the native data register.
      if (!axisPointIsValidForScale(p, axis)) continue;
      visit(p);
      if (errorBars) for (const tip of errorBarEndpoints(p, errorBars)) visit(tip);
    }
  }
  return Object.freeze(Number.isFinite(xMin) ? { xMin, xMax, yMin, yMax } : {});
}

export function numericFillBetweenClipBox(value, ranges, geometry, axisOptions = {}, survey) {
  if (typeof value !== "string" || geometry?.is3d || typeof geometry?.mapPoint !== "function") return null;
  const entries = Object.entries(parseOptions(stripOuterBraces(value.trim())));
  if (entries.length !== 1) return null;
  const [[key, raw]] = entries;
  if (!["domain", "domain y", "y domain y"].includes(key) || typeof raw !== "string") return null;
  const ends = raw.split(":").map(v => v.trim());
  if (ends.length !== 2 || !ends.every(v => decimal.test(v) && Number.isFinite(Number(v)))) return null;
  const dim = key === "domain" ? "x" : "y", other = dim === "x" ? "y" : "x";
  const log = isLogAxis(axisOptions, other);
  const transform = log ? v => Math.log(v) / Math.log(nativeLogRegisterBase(axisOptions, other)) : v => v;
  const minKey = other + "Min", maxKey = other + "Max";
  let lo = transform(geometry.lineRanges?.[minKey] ?? ranges?.[minKey]);
  let hi = transform(geometry.lineRanges?.[maxKey] ?? ranges?.[maxKey]);
  // Both selectors test yislinear. With any explicit limit PGF only
  // accumulates separate data min/max registers for *linear* dimensions.
  const explicit = ["xmin", "xmax", "ymin", "ymax", "zmin", "zmax"].some(k => axisOptions[k] != null && axisOptions[k] !== "");
  if (!isLogAxis(axisOptions, "y") && (!log || !explicit)) {
    survey ??= fillBetweenSurveyForGeometry(geometry);
    const min = transform(survey?.[minKey]), max = transform(survey?.[maxKey]);
    if (Number.isFinite(min)) lo = Math.min(lo, min);
    if (Number.isFinite(max)) hi = Math.max(hi, max);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  const pad = hi === lo ? 1 : .1 * Math.abs(hi - lo);
  // Axis cs logs each component again. Its empty TeX coefficient for a
  // nonpositive log argument multiplies the corresponding unit vector by 1.
  const argument = (v, d) => isLogAxis(axisOptions, d) && v <= 0 ? nativeLogRegisterBase(axisOptions, d) : v;
  const corner = (v, w) => geometry.mapPoint({ [dim]: argument(v, dim), [other]: argument(w, other) });
  return fillBetweenRectangleBox(corner(Number(ends[0]), lo - pad), corner(Number(ends[1]), hi + pad));
}
