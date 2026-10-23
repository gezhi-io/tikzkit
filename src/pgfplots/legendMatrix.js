import { normalizeOptions, parseOptions } from "../engine/options.js";
import { parseDimension } from "../engine/math.js";
import { TIKZ_UNIT } from "../tikz/metrics.js";
import { estimateFormulaBox, parseMathText } from "../tikz/textMetrics.js";
import { createFontSpec, parseTikzFontPatch } from "../tex/fontSpec.js";
import { shouldRenderPlotMarks } from "./marks.js";
import { selectPlotStyle } from "./plotStyle.js";

const PT_PER_CM = 72.27 / 2.54;

// pgfplots.code.tex: every axis legend is a matrix of alternating line-image
// and text-node cells. pgfmodulematrix uses picture bounds, not node outer sep,
// for column widths and row heights. Keep all dimensions in physical cm here.
export function layoutMathLegend(entries, { font: fontCommand, fontScale, columns, axisOptions, plots, mathOptions }) {
  const font = createFontSpec({ ...parseTikzFontPatch(fontCommand), sizePt: 10 * fontScale,
    mathExtension: mathOptions.mathExtension });
  const style = parseOptions(axisOptions["legend style"] || "");
  const nodes = parseOptions(style.nodes || "");
  // tikz@textfont is scoped inside the text hbox. Shape dimensions are
  // evaluated afterwards (tikz.code.tex), using node font, not font=\tiny.
  const dimensionFont = createFontSpec({ ...parseTikzFontPatch(axisOptions["node font"]),
    ...parseTikzFontPatch(style["node font"]), ...parseTikzFontPatch(nodes["node font"]) });
  const length = (value, fallback) => value === undefined ? fallback : parseDimension(value, {}, { font: dimensionFont });
  const innerX = length(style["inner xsep"] ?? style["inner sep"], 3 / PT_PER_CM);
  const innerY = length(style["inner ysep"] ?? style["inner sep"], 2 / PT_PER_CM);
  const cellX = length(nodes["inner xsep"] ?? nodes["inner sep"], 2 / PT_PER_CM);
  const cellY = length(nodes["inner ysep"] ?? nodes["inner sep"], 2 / PT_PER_CM);
  const fixedDepth = length(nodes["text depth"], length("0.15em"));
  const rowSep = length(style["row sep"], 0);
  const columnSep = length(style["column sep"], 0);
  const text = entries.map(entry => {
    const math = parseMathText(entry);
    return estimateFormulaBox(math.tex, { scale: fontScale * (math.scale || 1),
      displayMode: math.displayMode, mathVersion: font.mathVersion,
      mathExtension: font.mathExtension, baselineSkipPt: font.baselineSkipPt,
      preferNativeMath: true, minWidth: 0, widthPadding: 0, texTextMetrics: true });
  });
  const imageWidth = 0.6;
  const images = entries.map((_entry, index) => {
    const options = plots[index]?.options || {};
    const style = selectPlotStyle(options, index) + (axisOptions.thick ? ",thick" : "");
    const stroke = normalizeOptions("draw", parseOptions(style), { variables: {}, styles: {} }).style.lineWidth / TIKZ_UNIT;
    const radius = shouldRenderPlotMarks(options) ? length(options["mark size"] || "2pt") : 0;
    return { overhang: Math.max(stroke / 2, radius - imageWidth / 2), height: Math.max(stroke, 2 * radius + stroke) };
  });
  const imageOverhangs = Array.from({ length: columns }, (_, col) => Math.max(
    ...images.filter((_, i) => i % columns === col).map(image => image.overhang)));
  const textWidths = Array.from({ length: columns }, (_, col) => Math.max(
    ...text.filter((_, i) => i % columns === col).map(box => box.width)));
  const widths = textWidths.map((width, col) => imageWidth + 2 * imageOverhangs[col] + width + 2 * cellX + columnSep);
  const rows = Array.from({ length: Math.ceil(entries.length / columns) }, (_, row) => Math.max(
    ...text.slice(row * columns, (row + 1) * columns).map((box, col) => Math.max(
      length(nodes["text height"], box.height) + fixedDepth + 2 * cellY, images[row * columns + col].height))));
  const cells = text.map((box, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const left = innerX + widths.slice(0, col).reduce((a, b) => a + b, 0) + col * columnSep;
    const top = innerY + rows.slice(0, row).reduce((a, b) => a + b, 0) + row * rowSep;
    const x0 = left + imageOverhangs[col];
    const textLeft = left + imageWidth + 2 * imageOverhangs[col] + columnSep + cellX;
    return { x0, x1: x0 + imageWidth, textLeft, textRight: textLeft + textWidths[col],
      down: top + rows[row] / 2,
      // TikZ centers the node using its forced text depth; the glyphs retain
      // their real TeX depth. Fractions must not share the sample's paint center.
      textOffset: (fixedDepth - box.depth + box.height - length(nodes["text height"], box.height)) / 2 };
  });
  const borderStyle = normalizeOptions("draw", parseOptions(`line width=${style["line width"] || "0.4pt"}`), { variables: {}, styles: {} }).style;
  return { width: 2 * innerX + widths.reduce((a, b) => a + b, 0) + (columns - 1) * columnSep,
    height: 2 * innerY + rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * rowSep,
    outerSep: borderStyle.lineWidth / TIKZ_UNIT / 2, cells };
}
