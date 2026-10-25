import { parseDimension } from "../../engine/math.js";
import { parseOptions, splitTopLevel } from "../../engine/options.js";
import { parseMathText } from "../textMetrics.js";
import { normalizeTikzText } from "../text.js";
import { createFontSpec, parseTikzFontPatch } from "../../tex/fontSpec.js";
import { nativeMathFont } from "../../tex/mathFonts.js";
import { layoutNativeMath } from "../../tex/mathBox.js";
import { layoutNativeTextRun } from "../../tex/textBox.js";

const PT_PER_CM = 72.27 / 2.54;
const number = value => Number(value.toFixed(8));
const point = (x, y) => `(${number(x / PT_PER_CM)},${number(y / PT_PER_CM)})`;

function measureLabel(plot, defaultFont, mathExtension, ignoredOptions = []) {
  const style = parseOptions((plot.legendNodeStyle || []).join(","));
  if (Object.keys(style).some(key => !["font", "text", ...ignoredOptions].includes(key))) return null;
  const fontCommand = style.font || defaultFont;
  const font = createFontSpec({ ...parseTikzFontPatch(fontCommand), mathExtension });
  if (font.family !== "serif" || font.style !== "normal" || font.variant !== "normal") return null;
  const math = parseMathText(plot.legendLabel);
  const box = math
    ? layoutNativeMath(math.tex, { fontSizePt: font.sizePt, mathVersion: font.mathVersion,
      mathExtension: font.mathExtension, preferNativeMath: true })
    : layoutNativeTextRun(normalizeTikzText(plot.legendLabel), font);
  const metrics = nativeMathFont(font.weight >= 700 ? "CMBX" : "CMR", font.sizePt);
  if (!box || !metrics) return null;
  return { style, fontCommand, box, quad: metrics.parameters.QUAD * font.sizePt };
}

// Replay the legend object's keys in source order: a placement sets the
// preferred row/column count, and a later max key can change its orientation.
function insideMatrixOptions(raw) {
  const result = { mode: "columns", ideal: 1, max: 100, strategy: "down then right", fill: "white" };
  for (const part of splitTopLevel(raw || "", ",")) {
    for (const [key, value] of Object.entries(parseOptions(part))) {
      if (/^(north east|south east|north west|south west|north|south|east|west) inside$/.test(key)) {
        result.anchor = key.slice(0, -7);
        result.mode = /^(north|south)$/.test(result.anchor) ? "rows" : "columns";
        result.ideal = 1;
        result.fill = "white";
      } else if (/^(?:ideal number of )?(rows|columns)$/.test(key)) {
        result.mode = key.endsWith("rows") ? "rows" : "columns";
        result.ideal = Number(value);
      } else if (/^max (rows|columns)$/.test(key)) {
        result.mode = key.endsWith("rows") ? "columns" : "rows";
        result.max = Number(value);
      } else if (/^(down|up) then (right|left)$|^(right|left) then (down|up)$/.test(key)) {
        result.strategy = key;
      } else if (key === "opaque") result.fill = value === true ? "white" : value;
      else if (key === "transparent") result.fill = "none";
      else if (key !== "label style") return null;
    }
  }
  return result.anchor && [result.ideal, result.max].every(n => Number.isInteger(n) && n > 0) ? result : null;
}

function arrangeCells(cells, options) {
  const { ideal, max, mode, strategy } = options;
  const count = cells.length;
  const target = count <= ideal ? count : ideal * max > count ? ideal : Math.ceil(count / max);
  const perTarget = count <= ideal ? 1 : ideal * max > count ? Math.ceil(count / ideal) : max;
  const rows = mode === "rows" ? target : perTarget;
  const columns = mode === "columns" ? target : perTarget;
  const matrix = Array.from({ length: rows }, () => Array(columns).fill(null));
  const up = strategy.includes("up");
  const left = strategy.includes("left");
  const vertical = /^(up|down)/.test(strategy);
  let row = up ? rows - 1 : 0;
  let column = left ? columns - 1 : 0;
  for (const cell of cells) {
    if (matrix[row] && column >= 0 && column < columns) matrix[row][column] = cell;
    if (vertical) {
      row += up ? -1 : 1;
      // The installed PGF down-then-left updater compares to the column
      // count (unlike down-then-right). Retain its actual wrap behavior.
      const rowLimit = strategy === "down then left" ? columns : rows;
      if (row < 0 || row >= rowLimit) {
        row = up ? rows - 1 : 0;
        column += left ? -1 : 1;
      }
    } else {
      column += left ? -1 : 1;
      if (column < 0 || column >= columns) {
        column = left ? columns - 1 : 0;
        row += up ? -1 : 1;
      }
    }
  }
  return matrix;
}

export function renderNativeTextOnlyInsideLegend(entries, dataBoxName, options = {}) {
  if (!entries.length || new Set(entries.map(entry => entry.plot.legendName)).size > 1) return null;
  const settings = insideMatrixOptions(entries[0].plot.legendPosition);
  if (!settings) return null;
  const ex = nativeMathFont("CMR", 10).parameters.XHEIGHT * 10;
  const cells = [];
  for (const entry of entries) {
    const { plot } = entry;
    if (!plot.legendInside || !plot.legendTextOnly || plot.legendTextLeft ||
      plot.legendPosition !== entries[0].plot.legendPosition) return null;
    const measured = measureLabel(plot, String.raw`\footnotesize`, options.mathExtension, ["text only"]);
    if (!measured) return null;
    const { box, quad } = measured;
    const baseline = -.5 * ex;
    // text-only resets text-right's .333em shift. The outer node sep
    // moves the glyphs, but is not part of the cell's painted bounds.
    const x = .1666 * 10;
    cells.push({ ...entry, ...measured, x, baseline,
      minX: x, maxX: x + box.width,
      minY: baseline - Math.max(box.depth, .25 * quad) - 1,
      maxY: baseline + Math.max(box.height, .75 * quad) + 1 });
  }
  const matrix = arrangeCells(cells, settings);
  const rowBounds = matrix.map(row => ({
    min: Math.min(0, ...row.filter(Boolean).map(cell => cell.minY)),
    max: Math.max(0, ...row.filter(Boolean).map(cell => cell.maxY))
  }));
  const columnBounds = matrix[0].map((_, column) => ({
    min: Math.min(...matrix.map(row => row[column]?.minX ?? 0)),
    max: Math.max(...matrix.map(row => row[column]?.maxX ?? 0))
  }));
  const xs = [0], ys = [0];
  for (let i = 1; i < columnBounds.length; i++) xs.push(xs[i - 1] + columnBounds[i - 1].max - columnBounds[i].min + 8);
  for (let i = 1; i < rowBounds.length; i++) ys.push(ys[i - 1] + rowBounds[i - 1].min - rowBounds[i].max);
  const inner = .333 * ex, outer = .5 * ex;
  const minX = columnBounds[0].min - inner;
  const maxX = xs.at(-1) + columnBounds.at(-1).max + inner;
  const minY = ys.at(-1) + rowBounds.at(-1).min - inner;
  const maxY = rowBounds[0].max + inner;
  const { anchor } = settings;
  const dx = anchor.includes("west") ? outer - minX : anchor.includes("east") ? -outer - maxX : -(minX + maxX) / 2;
  const dy = anchor.includes("south") ? outer - minY : anchor.includes("north") ? -outer - maxY : -(minY + maxY) / 2;
  const shift = anchor.includes("west") || anchor === "east" ? 3 : anchor.includes("east") ? -3 : 0;
  const commands = [
    `{[shift={([xshift=${shift}pt]${dataBoxName}.${anchor})},tikzkit native math,tikzkit tex node anchors]`,
    `\\node[axis legend background,rectangle,draw=none,fill=${settings.fill},rounded corners=3pt,inner sep=0pt,outer sep=0pt,minimum width=${number(maxX - minX)}pt,minimum height=${number(maxY - minY)}pt] at ${point(dx + (minX + maxX) / 2, dy + (minY + maxY) / 2)} {};`
  ];
  matrix.forEach((row, i) => row.forEach((cell, j) => {
    if (cell) commands.push(`\\node[axis legend,anchor=base west,inner sep=0pt,outer sep=0pt,font=${cell.fontCommand},text=${cell.style.text || cell.labelColor}] at ${point(dx + xs[j] + cell.x, dy + ys[i] + cell.baseline)} {${cell.plot.legendLabel}};`);
  }));
  commands.push("}");
  return commands;
}

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
    const measured = measureLabel(plot, String.raw`\small`, options.mathExtension);
    if (!measured) return null;
    const { style: nodeStyle, fontCommand, box, quad } = measured;
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
