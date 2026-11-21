import { parseDimension } from "../engine/math.js";
import { normalizeOptions, parseOptions } from "../engine/options.js";
import { TIKZ_UNIT } from "../tikz/metrics.js";
import { pgfplotsUsesAreaLegend } from "./areaPlots.js";
import { barPlotStyle, selectPlotStyle } from "./plotStyle.js";

const PT = 2.54 / 72.27;

export function legendHalfPen(options, index, thick) {
  const style = selectPlotStyle(options, index) + (thick ? ",thick" : "");
  const pen = normalizeOptions("draw", parseOptions(style), { variables: {}, styles: {} }).style;
  return pen.stroke === "none" ? 0 : pen.lineWidth / TIKZ_UNIT / 2;
}

// Return geometry about the image-cell origin, not the center of its ink.
// pgfplots.code.tex installs a miniature plot with its own widths and shifts.
export function filledLegendImage(axis, plot, index = 0, font) {
  if (plot["line legend"]) return null;
  const kind = pgfplotsUsesAreaLegend(plot) ? "area" : barPlotStyle(plot) ??
    (axis["line legend"] ? undefined : pgfplotsUsesAreaLegend(axis) ? "area" : barPlotStyle(axis));
  if (!kind) return null;
  const halfPen = legendHalfPen(plot, index, axis.thick);
  const rects = [];
  const rect = (x0, y0, x1, y1) => rects.push({
    minX: Math.min(x0, x1), maxX: Math.max(x0, x1),
    minY: Math.min(y0, y1), maxY: Math.max(y0, y1)
  });
  if (kind === "area") rect(0, -.1, .6, .1);
  else {
    const em = parseDimension("1em", {}, { font });
    const horizontal = kind[0] === "x";
    const single = kind.endsWith("stacked");
    const shift = horizontal && single ? parseDimension(".2ex", {}, { font }) : -.2 * em;
    const bar = (center, breadth, value) => {
      const a = center - breadth / 2, b = center + breadth / 2;
      if (horizontal) rect(0, a + shift, value, b + shift);
      else rect(a, shift, b, value + shift);
    };
    if (kind.includes("interval")) {
      // The first coordinate only starts an interval. The single-point
      // stacked image is an empty cell; do not invent a swatch or pen bounds.
      const points = single ? [] : [[0, .8 * em], [5 * PT, .6 * em], [10 * PT, .6 * em]];
      for (let i = 1; i < points.length; i++) {
        const along = horizontal ? 1 : 0;
        const a = points[i - 1][along], b = points[i][along];
        bar((a + b) / 2, .7 * (b - a), points[i - 1][1 - along]);
      }
    } else {
      const width = (single ? 6 : 3) * PT;
      bar(0, width, .8 * em);
      if (!single) bar(2 * width, width, .6 * em);
    }
  }
  const bounds = rects.length ? {
    minX: Math.min(...rects.map(r => r.minX)) - halfPen,
    minY: Math.min(...rects.map(r => r.minY)) - halfPen,
    maxX: Math.max(...rects.map(r => r.maxX)) + halfPen,
    maxY: Math.max(...rects.map(r => r.maxY)) + halfPen
  } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { rects, bounds };
}
