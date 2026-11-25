import { normalizeOptions, parseOptions } from "../engine/options.js";
import { parseDimension } from "../engine/math.js";
import { TIKZ_UNIT } from "../tikz/metrics.js";
import { estimateFormulaBox, parseMathText } from "../tikz/textMetrics.js";
import { createFontSpec, parseTikzFontPatch } from "../tex/fontSpec.js";
import { layoutNativeMixedText, layoutNativeText } from "../tex/textBox.js";
import { includeLegendMark, legendHalfPen, LINE_LEGEND_WIDTH } from "./legendImages.js";
import { emptyBoundingBox, includePoint } from "../scene/bbox.js";

const PT_PER_CM = 72.27 / 2.54;

function lineImageBounds({ options, onlyMarks, fractions }, index, thick) {
  const pen = legendHalfPen(options, index, thick);
  const bounds = emptyBoundingBox();
  if (!onlyMarks) {
    includePoint(bounds, { x: -pen, y: -pen });
    includePoint(bounds, { x: LINE_LEGEND_WIDTH + pen, y: pen });
  }
  for (const f of fractions) {
    if (!includeLegendMark(bounds, options, { x: f * LINE_LEGEND_WIDTH, y: 0 })) return null;
  }
  if (!Number.isFinite(bounds.minX)) includePoint(bounds, { x: 0, y: 0 });
  return bounds;
}

export function legendDimensionFont(axisOptions, style = parseOptions(axisOptions["legend style"] || ""),
  nodes = parseOptions(style.nodes || "")) {
  return createFontSpec({ ...parseTikzFontPatch(axisOptions["node font"]),
    ...parseTikzFontPatch(style["node font"]), ...parseTikzFontPatch(nodes["node font"]) });
}

// pgfmodulematrix uses picture bounds, not node outer sep, for columns and
// rows of alternating image and text cells. Dimensions here are physical cm.
export function layoutLineLegend(entries, { font: fontCommand, fontScale, columns, axisOptions, mathOptions,
  images, dimensionFont = legendDimensionFont(axisOptions) }) {
  const font = createFontSpec({ ...parseTikzFontPatch(fontCommand), sizePt: 10 * fontScale,
    mathExtension: mathOptions.mathExtension });
  const style = parseOptions(axisOptions["legend style"] || "");
  const nodes = parseOptions(style.nodes || "");
  // tikz@textfont is scoped inside the text hbox. Shape dimensions are
  // evaluated afterwards (tikz.code.tex), using node font, not font=\tiny.
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
    if (!math) {
      const source = entry.trim();
      if (source.split("$").some((span, i) => !(i % 2) && /[\\#%&^_~{}]/.test(span))) return null;
      const box = source.includes("$") ? layoutNativeMixedText(source, font) : layoutNativeText(source, font);
      return box && { width: box.width / PT_PER_CM, height: box.height / PT_PER_CM, depth: box.depth / PT_PER_CM };
    }
    return estimateFormulaBox(math.tex, { scale: fontScale * (math.scale || 1),
      displayMode: math.displayMode, mathVersion: font.mathVersion,
      mathExtension: font.mathExtension, baselineSkipPt: font.baselineSkipPt,
      preferNativeMath: true, minWidth: 0, widthPadding: 0, texTextMetrics: true });
  });
  if (text.some(box => !box)) return null;
  const bounds = images.map((image, i) => image.filled?.bounds ?? lineImageBounds(image, i, axisOptions.thick));
  if (bounds.some(b => !b)) return null;
  const imageColumns = Array.from({ length: columns }, (_, col) => {
    const column = bounds.filter((_, i) => i % columns === col);
    return { left: Math.min(...column.map(b => b.minX)), right: Math.max(...column.map(b => b.maxX)) };
  });
  const textWidths = Array.from({ length: columns }, (_, col) => Math.max(
    ...text.filter((_, i) => i % columns === col).map(box => box.width)));
  const widths = textWidths.map((width, col) => imageColumns[col].right - imageColumns[col].left + width + 2 * cellX + columnSep);
  const rows = Array.from({ length: Math.ceil(entries.length / columns) }, (_, row) => {
    let above = 0, below = 0;
    for (let i = row * columns; i < Math.min(text.length, (row + 1) * columns); i++) {
      const half = (length(nodes["text height"], text[i].height) + fixedDepth) / 2 + cellY;
      above = Math.max(above, half, bounds[i].maxY);
      below = Math.max(below, half, -bounds[i].minY);
    }
    return { above, height: above + below };
  });
  const cells = text.map((box, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const left = innerX + widths.slice(0, col).reduce((a, b) => a + b, 0) + col * columnSep;
    const top = innerY + rows.slice(0, row).reduce((a, b) => a + b.height, 0) + row * rowSep;
    const x0 = left - imageColumns[col].left;
    const textLeft = x0 + imageColumns[col].right + columnSep + cellX;
    return { x0, x1: x0 + LINE_LEGEND_WIDTH, textLeft, textRight: textLeft + textWidths[col],
      down: top + rows[row].above,
      // TikZ centers the node using its forced text depth; the glyphs retain
      // their real TeX depth. Fractions must not share the sample's paint center.
      textOffset: (fixedDepth - box.depth + box.height - length(nodes["text height"], box.height)) / 2 };
  });
  const borderStyle = normalizeOptions("draw", parseOptions(`line width=${style["line width"] || "0.4pt"}`), { variables: {}, styles: {} }).style;
  return { width: 2 * innerX + widths.reduce((a, b) => a + b, 0) + (columns - 1) * columnSep,
    height: 2 * innerY + rows.reduce((a, b) => a + b.height, 0) + (rows.length - 1) * rowSep,
    outerSep: borderStyle.lineWidth / TIKZ_UNIT / 2, cells };
}
