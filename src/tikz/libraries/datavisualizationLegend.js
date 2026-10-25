import { parseDimension } from "../../engine/math.js";
import { parseOptions } from "../../engine/options.js";
import { parseMathText } from "../textMetrics.js";
import { normalizeTikzText } from "../text.js";
import { createFontSpec, parseTikzFontPatch } from "../../tex/fontSpec.js";
import { nativeMathFont } from "../../tex/mathFonts.js";
import { layoutNativeMath } from "../../tex/mathBox.js";
import { layoutNativeTextRun } from "../../tex/textBox.js";

const PT_PER_CM = 72.27 / 2.54;
const number = value => Number(value.toFixed(8));
const point = (x, y) => `(${number(x / PT_PER_CM)},${number(y / PT_PER_CM)})`;

// PGF legends are matrices of pictures, not fixed fractions of the axis.
// This slice covers ordinary one-column east-outside circular scatter entries.
// Leave custom cell pictures, other placements and matrix styles to their
// existing lowering until they have independent native-layout coverage.
export function renderNativeScatterLegend(entries, axisBoxName, options = {}) {
  if (!entries.length || new Set(entries.map(entry => entry.plot.legendName)).size > 1) return null;
  const cells = [];
  for (const entry of entries) {
    const { plot } = entry;
    const position = plot.legendExplicit ? String(plot.legendPosition).trim() : "east outside";
    if (entry.kind !== "scatter" || !["east outside", "right"].includes(position) ||
      plot.legendTextOnly || plot.legendTextLeft || plot.legendMarkCount > 1 ||
      plot.legendMarkCoordinates?.length || !["*", "o"].includes(String(plot.mark || "*"))) return null;
    const nodeStyle = parseOptions((plot.legendNodeStyle || []).join(","));
    if (Object.keys(nodeStyle).some(key => !["font", "text"].includes(key))) return null;
    const fontCommand = nodeStyle.font || String.raw`\small`;
    const font = createFontSpec({ ...parseTikzFontPatch(fontCommand), mathExtension: options.mathExtension });
    if (font.family !== "serif" || font.style !== "normal" || font.variant !== "normal") return null;
    const math = parseMathText(plot.legendLabel);
    const box = math
      ? layoutNativeMath(math.tex, { fontSizePt: font.sizePt, mathVersion: font.mathVersion,
        mathExtension: font.mathExtension, preferNativeMath: true })
      : layoutNativeTextRun(normalizeTikzText(plot.legendLabel), font);
    if (!box) return null;
    const metrics = nativeMathFont(font.weight >= 700 ? "CMBX" : "CMR", font.sizePt);
    if (!metrics) return null;
    const quad = metrics.parameters.QUAD * font.sizePt;
    const radius = parseDimension(plot.markSize || "2pt", {}) * PT_PER_CM;
    if (!Number.isFinite(radius) || radius < 0) return null;

    // tikzlibrarydatavisualization: every ticks supplies outer sep=.1666em;
    // text right adds .333em, while mid uses the *surrounding* font's .5ex.
    // The cell's hbox struts use its selected fontdimen6 (cmr9 is 9.25pt).
    const x = (.333 + .1666) * 10;
    const baseline = -.5 * nativeMathFont("CMR", 10).parameters.XHEIGHT * 10;
    const height = Math.max(box.height, .75 * quad);
    const depth = Math.max(box.depth, .25 * quad);
    cells.push({ ...entry, labelColor: nodeStyle.text || entry.labelColor, fontCommand, radius, x, baseline,
      minX: Math.min(-radius, x), maxX: Math.max(radius, x + box.width),
      minY: Math.min(-radius, baseline - depth - 1),
      maxY: Math.max(radius, baseline + height + 1) });
  }

  // pgfmodulematrix aligns cell origins and packs rows using their individual
  // height/depth. A tall fraction must expand both adjacent row gaps.
  let y = 0;
  for (let i = 0; i < cells.length; i++) {
    if (i) y += cells[i - 1].minY - cells[i].maxY;
    cells[i].y = y;
  }
  const minX = Math.min(0, ...cells.map(cell => cell.minX));
  const maxX = Math.max(0, ...cells.map(cell => cell.maxX));
  const minY = Math.min(...cells.map(cell => cell.y + cell.minY));
  const maxY = Math.max(...cells.map(cell => cell.y + cell.maxY));
  const innerSep = .3333 * 10;
  const outerSep = .2;
  const dx = .8 * 10 + outerSep + innerSep - minX;
  const dy = -(minY + maxY) / 2;
  const commands = [
    `{[shift={(${axisBoxName}.east)},tikzkit native math,tikzkit tex node anchors]`,
    `\\path[use as bounding box] ${point(dx + minX - innerSep, dy + minY - innerSep)} rectangle ${point(dx + maxX + innerSep, dy + maxY + innerSep)};`
  ];
  for (const cell of cells) {
    const mark = String(cell.plot.mark || "*");
    commands.push(`\\draw[axis legend example,${cell.sampleStyle},fill=${mark === "o" ? "none" : cell.sampleColor}] ${point(dx, dy + cell.y)} circle (${number(cell.radius)}pt);`);
    commands.push(`\\node[axis legend,anchor=base west,inner sep=0pt,outer sep=0pt,font=${cell.fontCommand},text=${cell.labelColor}] at ${point(dx + cell.x, dy + cell.y + cell.baseline)} {${cell.plot.legendLabel}};`);
  }
  commands.push("}");
  return commands;
}
